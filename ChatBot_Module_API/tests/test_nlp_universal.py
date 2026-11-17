"""
Comprehensive Test Suite for Universal Data-Driven NLP Microservice.
Verifies all 13 Acceptance Criteria.
"""
import json
from pathlib import Path
import re
import sys
import pytest

root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir / "python"))

from nlp.entity_extractor import extract_entities
from nlp.intent_detector import detect_intent
from nlp.preprocessing import clean_unicode_and_limit, preprocess_text
from nlp.profile_loader import build_profile_context, load_profile
from nlp.profile_models import ProjectProfile
from nlp.tokenizer import tokenize_and_lemmatize


@pytest.fixture(scope="module")
def sample_profile_ctx():
    fixture_path = root_dir / "tests" / "fixtures" / "sample_profile.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    profile = ProjectProfile(**data)
    return build_profile_context(profile)


@pytest.fixture(scope="module")
def second_profile_ctx():
    fixture_path = root_dir / "tests" / "fixtures" / "second_profile.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    profile = ProjectProfile(**data)
    return build_profile_context(profile)


def run_pipeline(text: str, ctx):
    cleaned = clean_unicode_and_limit(text)
    norm = preprocess_text(
        cleaned,
        lexicon=ctx.profile.normalization_lexicon,
        symspell=ctx.symspell,
        vocabulary=ctx.vocabulary,
    )
    entities = extract_entities(
        original_question=cleaned,
        normalized_text=norm,
        profile=ctx.profile,
    )
    intent_res = detect_intent(
        normalized_question=norm,
        raw_question=cleaned,
        entities=entities,
        profile=ctx.profile,
        intent_model=ctx.intent_model,
    )
    return {
        "cleaned": cleaned,
        "normalized": norm,
        "entities": entities,
        "intent": intent_res.intent_name,
        "confidence": intent_res.confidence,
        "alternatives": intent_res.alternatives,
        "matched_by": intent_res.matched_by,
    }


# ----------------------------------------------------------------------
# 1. Typo tolerance
# ----------------------------------------------------------------------
def test_criterion_1_typo_tolerance(sample_profile_ctx):
    """'overal reprt' -> OverallReport (typo corrected via vocabulary symspell, matched to intent)."""
    res = run_pipeline("overal reprt", sample_profile_ctx)
    assert "overall" in res["normalized"]
    assert "report" in res["normalized"]
    assert res["intent"] == "OverallReport"
    assert res["confidence"] >= sample_profile_ctx.profile.thresholds.intent


# ----------------------------------------------------------------------
# 2. Multi-entity
# ----------------------------------------------------------------------
def test_criterion_2_multi_entity(sample_profile_ctx):
    """'show me vehicle active' -> Category=Vehicle, Status=active."""
    res = run_pipeline("show me vehicle active", sample_profile_ctx)
    assert res["entities"].get("Category") == "Vehicle"
    assert res["entities"].get("Status") == "active"


# ----------------------------------------------------------------------
# 3. Alias normalization
# ----------------------------------------------------------------------
def test_criterion_3_alias_normalization(sample_profile_ctx):
    """'cattle expired' -> Category=Cattle, Status=lapsed."""
    res = run_pipeline("cattle expired", sample_profile_ctx)
    assert res["entities"].get("Category") == "Cattle"
    assert res["entities"].get("Status") == "lapsed"


# ----------------------------------------------------------------------
# 4. Relative duration
# ----------------------------------------------------------------------
def test_criterion_4_relative_duration(sample_profile_ctx):
    """'next 15 days' -> days=15."""
    res = run_pipeline("policies expiring in next 15 days", sample_profile_ctx)
    assert res["entities"].get("days") == 15


# ----------------------------------------------------------------------
# 5. Tanglish alias
# ----------------------------------------------------------------------
def test_criterion_5_tanglish_alias(sample_profile_ctx):
    """'mudinjathu' -> Status=lapsed."""
    res = run_pipeline("mudinjathu", sample_profile_ctx)
    assert res["entities"].get("Status") == "lapsed"


# ----------------------------------------------------------------------
# 6. Pattern regex: vehicle number
# ----------------------------------------------------------------------
def test_criterion_6_vehicle_number_pattern(sample_profile_ctx):
    """'TN 33 AX 5799' -> vehicle_number='TN33AX5799'."""
    res = run_pipeline("check vehicle TN 33 AX 5799 details", sample_profile_ctx)
    assert res["entities"].get("vehicle_number") == "TN33AX5799"


# ----------------------------------------------------------------------
# 7. Policy number pattern
# ----------------------------------------------------------------------
def test_criterion_7_policy_number_pattern(sample_profile_ctx):
    """'POL-12345678' or '123456789012' -> policy_number extracted cleanly."""
    res1 = run_pipeline("lookup policy POL-12345678", sample_profile_ctx)
    assert res1["entities"].get("policy_number") == "POL-12345678"

    res2 = run_pipeline("find policy 123456789012", sample_profile_ctx)
    assert res2["entities"].get("policy_number") == "123456789012"


# ----------------------------------------------------------------------
# 8. Small-talk isolation
# ----------------------------------------------------------------------
def test_criterion_8_small_talk_isolation(sample_profile_ctx):
    """'hi', 'hello' -> Greeting, entities.greeting=true. 'this is nice' -> NOT Greeting."""
    res_hi = run_pipeline("hi", sample_profile_ctx)
    assert res_hi["intent"] == "Greeting"
    assert res_hi["entities"].get("greeting") is True

    res_hello = run_pipeline("hello", sample_profile_ctx)
    assert res_hello["intent"] == "Greeting"
    assert res_hello["entities"].get("greeting") is True

    res_nice = run_pipeline("this is nice", sample_profile_ctx)
    assert res_nice["intent"] != "Greeting"
    assert res_nice["entities"].get("greeting") is not True


# ----------------------------------------------------------------------
# 9. Out-of-domain
# ----------------------------------------------------------------------
def test_criterion_9_out_of_domain(sample_profile_ctx):
    """'asdfgh qwerty' -> intent='Unknown', confidence < threshold, alternatives has 3 items."""
    res = run_pipeline("asdfgh qwerty", sample_profile_ctx)
    assert res["intent"] == "Unknown"
    assert res["confidence"] < sample_profile_ctx.profile.thresholds.intent
    assert len(res["alternatives"]) == 3
    for alt in res["alternatives"]:
        assert "intent" in alt
        assert "score" in alt


# ----------------------------------------------------------------------
# 10. Conflict resolution
# ----------------------------------------------------------------------
def test_criterion_10_conflict_resolution(sample_profile_ctx):
    """'policy details' -> does NOT extract Category='LIC'."""
    res = run_pipeline("policy details", sample_profile_ctx)
    assert res["entities"].get("Category") != "LIC"


# ----------------------------------------------------------------------
# 11. Gazetteer isolation
# ----------------------------------------------------------------------
def test_criterion_11_gazetteer_isolation(sample_profile_ctx):
    """Words matching any gazetteer value or alias NEVER appear in name."""
    res_vehicle = run_pipeline("show vehicle active", sample_profile_ctx)
    assert "name" not in res_vehicle["entities"]
    assert "person" not in res_vehicle["entities"]

    res_party = run_pipeline("party Karthik policies", sample_profile_ctx)
    assert res_party["entities"].get("person") == "Karthik"
    assert res_party["entities"].get("name") == "Karthik"


# ----------------------------------------------------------------------
# 12. Zero hard-coded domain words lint test
# ----------------------------------------------------------------------
def test_criterion_12_zero_domain_words_lint():
    """A lint test scans nlp/*.py and fails if any domain keyword appears in source code."""
    nlp_dir = root_dir / "python" / "nlp"
    py_files = list(nlp_dir.glob("*.py"))
    assert len(py_files) > 0

    # Domain words that MUST NOT exist in nlp/*.py
    banned_keywords = [
        r"\bpolicy\b",
        r"\bpolicies\b",
        r"\bvehicle\b",
        r"\bcattle\b",
        r"\blapsed\b",
        r"\bprotect\b",
        r"\binsurance\b",
        r"\bmudinjathu\b",
        r"\btheerthathu\b",
        r"\bkannukutti\b",
    ]
    pattern = re.compile("|".join(banned_keywords), re.IGNORECASE)

    violations = []
    for f in py_files:
        content = f.read_text(encoding="utf-8")
        lines = content.splitlines()
        for idx, line in enumerate(lines, 1):
            # Allow comments referring to user instructions or general docstrings if needed,
            # but strictly fail if any code or data table uses domain words
            match = pattern.search(line)
            if match:
                violations.append(f"{f.name}:{idx} '{match.group(0)}' in: {line.strip()}")

    assert not violations, f"Banned domain keywords found in nlp/*.py:\n" + "\n".join(violations)


# ----------------------------------------------------------------------
# 13. Second project: Job Portal
# ----------------------------------------------------------------------
def test_criterion_13_second_project(second_profile_ctx):
    """Load second profile (Job Portal) -> extracts skills, job_title, candidate_id without code changes."""
    assert second_profile_ctx.profile.project_code == "JOB_PORTAL"
    assert "resume" in second_profile_ctx.profile.modules

    # Query with skills and candidate ID
    query = "Candidate John with Python, React and 5 years experience applying for CAND-12345"
    res = run_pipeline(query, second_profile_ctx)

    assert res["entities"].get("candidate_id") == "CAND-12345"
    assert "skills" in res["entities"]
    skills = [s.lower() for s in res["entities"]["skills"]]
    assert "python" in skills
    assert "react" in skills
