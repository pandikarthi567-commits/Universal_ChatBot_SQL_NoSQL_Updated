"""
Data-driven Entity Extractor.
Builtins, profile gazetteers, profile patterns, and module-gated resume extraction.
ZERO domain-specific words.
"""
import logging
import re
from typing import Any

from rapidfuzz import fuzz

from nlp.preprocessing import clean_unicode_and_limit
from nlp.profile_models import ProjectProfile
from nlp.tokenizer import safe_pos_tag, safe_word_tokenize

logger = logging.getLogger("entity_extractor")

_DATE_RANGE_RE = re.compile(
    r"\b(?:from|between)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4})\s+(?:to|and)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4})\b",
    re.IGNORECASE,
)
_DAYS_RE = re.compile(r"\b(?:next|within|last|in)\s+(\d{1,4})\s+days?\b", re.IGNORECASE)
_TOP_N_RE = re.compile(r"\b(?:top|first|last|limit)\s+(\d{1,4})\b", re.IGNORECASE)
_GENERIC_ID_RE = re.compile(r"\b([A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)+|\d{10,20})\b")
_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
_PHONE_RE = re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")
_NAMED_CUE_RE = re.compile(
    r"\b(?:for|named|name|customer|client|party|user|holder)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b"
)
_GENERIC_STOP_WORDS = {
    "a", "an", "the", "in", "on", "at", "to", "for", "of", "with", "by", "from",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "can", "could", "should", "would", "will", "show",
    "get", "list", "find", "view", "display", "fetch", "check", "how", "what",
    "who", "where", "which", "why", "details", "detail", "report", "reports",
    "summary", "data", "info", "information", "record", "records",
}


def _extract_builtins(
    original_text: str,
    normalized_text: str,
    builtins_requested: set[str],
    gazetteer_tokens: set[str],
) -> dict[str, Any]:
    found: dict[str, Any] = {}

    # 1. days / relative duration
    if "days" in builtins_requested or "number" in builtins_requested:
        try:
            m_days = _DAYS_RE.search(normalized_text)
            if m_days:
                found["days"] = int(m_days.group(1))
            elif re.search(r"\bthis\s+week\b", normalized_text, re.IGNORECASE):
                found["days"] = 7
            elif re.search(r"\bthis\s+month\b", normalized_text, re.IGNORECASE):
                found["days"] = 30
        except Exception as e:
            logger.debug("Error extracting days: %s", e)

    # 2. top_n
    if "top_n" in builtins_requested or "number" in builtins_requested:
        try:
            m_top = _TOP_N_RE.search(normalized_text)
            if m_top:
                found["top_n"] = int(m_top.group(1))
        except Exception as e:
            logger.debug("Error extracting top_n: %s", e)

    # 3. date_from / date_to / date_range
    if "date_range" in builtins_requested or "date_from" in builtins_requested:
        try:
            m_range = _DATE_RANGE_RE.search(original_text)
            if m_range:
                found["date_from"] = m_range.group(1)
                found["date_to"] = m_range.group(2)
            else:
                try:
                    import dateparser.search
                    dates = dateparser.search.search_dates(original_text)
                    if dates and len(dates) >= 2:
                        found["date_from"] = dates[0][1].strftime("%Y-%m-%d")
                        found["date_to"] = dates[1][1].strftime("%Y-%m-%d")
                except Exception:
                    pass
        except Exception as e:
            logger.debug("Error extracting date range: %s", e)

    # 4. email & phone
    if "email" in builtins_requested:
        try:
            m_mail = _EMAIL_RE.search(original_text)
            if m_mail:
                found["email"] = m_mail.group(0)
        except Exception as e:
            logger.debug("Error extracting email: %s", e)

    if "phone" in builtins_requested:
        try:
            m_phone = _PHONE_RE.search(original_text)
            if m_phone:
                found["phone"] = m_phone.group(0)
        except Exception as e:
            logger.debug("Error extracting phone: %s", e)

    # 5. Generic ID shape
    if "id" in builtins_requested:
        try:
            m_id = _GENERIC_ID_RE.search(original_text)
            if m_id:
                val = m_id.group(0)
                # Ensure it's not a pure 4-digit year or small number
                if len(val) >= 6 or ("-" in val or "/" in val):
                    found["id"] = val
        except Exception as e:
            logger.debug("Error extracting ID: %s", e)

    # 6. Person / Name / Org
    if "person" in builtins_requested or "name" in builtins_requested or "org" in builtins_requested:
        try:
            m_cue = _NAMED_CUE_RE.search(original_text)
            if m_cue:
                cand = m_cue.group(1).strip()
                cand_lower = cand.lower()
                cand_words = set(re.findall(r"\w+", cand_lower))
                # Exclude if cand or any word matches project gazetteer tokens or generic stops
                if not (cand_words & gazetteer_tokens) and not (cand_words & _GENERIC_STOP_WORDS):
                    found["person"] = cand
                    found["name"] = cand
            else:
                # NLTK chunking fallback
                tokens = safe_word_tokenize(original_text)
                pos_tags = safe_pos_tag(tokens)
                try:
                    import nltk
                    chunks = nltk.ne_chunk(pos_tags)
                    for chunk in chunks:
                        if hasattr(chunk, "label") and chunk.label() in ("PERSON", "ORGANIZATION", "GPE"):
                            name = " ".join(c[0] for c in chunk)
                            name_words = set(re.findall(r"\w+", name.lower()))
                            if not (name_words & gazetteer_tokens) and not (name_words & _GENERIC_STOP_WORDS):
                                if chunk.label() == "PERSON":
                                    found["person"] = name
                                    found["name"] = name
                                    break
                                elif chunk.label() == "ORGANIZATION":
                                    found["org"] = name
                                    break
                except Exception:
                    pass
        except Exception as e:
            logger.debug("Error extracting person/org: %s", e)

    # 7. Generic number
    if "number" in builtins_requested and "number" not in found and "days" not in found and "top_n" not in found:
        try:
            m_num = re.search(r"\b\d+(?:\.\d+)?\b", normalized_text)
            if m_num:
                val_str = m_num.group(0)
                if len(val_str) < 8 and val_str not in found.values():
                    found["number"] = float(val_str) if "." in val_str else int(val_str)
        except Exception as e:
            logger.debug("Error extracting number: %s", e)

    return found


def _extract_patterns(original_text: str, pattern_specs: list[Any]) -> dict[str, str]:
    found: dict[str, str] = {}
    for spec in pattern_specs:
        if not spec.regex:
            continue
        try:
            m = re.search(spec.regex, original_text, re.IGNORECASE)
            if m:
                val = m.group(0)
                for rule in spec.normalize_rule:
                    if rule == "remove_spaces":
                        val = re.sub(r"\s+", "", val)
                    elif rule == "remove_hyphens":
                        val = val.replace("-", "")
                    elif rule == "uppercase":
                        val = val.upper()
                    elif rule == "lowercase":
                        val = val.lower()
                found[spec.name] = val
        except Exception as e:
            logger.debug("Error extracting pattern entity %s: %s", spec.name, e)
    return found


def _extract_gazetteers(
    normalized_text: str,
    gazetteer_specs: list[Any],
    fuzzy_threshold: float,
) -> dict[str, Any]:
    """
    Multi-value gazetteer matching.

    For every gazetteer entity type, ALL matching canonical values are collected
    (exact whole-word match on canonical/aliases first, then fuzzy match on the
    remaining tokens). Values are returned in the order they appear in the text.

    Return shape per entity type:
      - one match   -> "Locker"                (str, backward compatible)
      - many matches -> ["Marine", "Locker"]   (list[str])
    """
    found: dict[str, Any] = {}
    tokens = normalized_text.split()
    sorted_specs = sorted(gazetteer_specs, key=lambda s: getattr(s, "priority", 10))

    for spec in sorted_specs:
        hits: dict[str, int] = {}          # canonical -> position in text
        consumed: list[tuple[int, int]] = []  # char spans already matched exactly

        # 1. Exact whole-word matching: check EVERY value, do not stop at first hit
        for val in spec.values:
            for cand in [val.canonical] + list(val.aliases):
                if not cand:
                    continue
                pattern = rf"\b{re.escape(cand.lower())}\b"
                m = re.search(pattern, normalized_text)
                if m:
                    consumed.append(m.span())
                    if val.canonical not in hits or m.start() < hits[val.canonical]:
                        hits[val.canonical] = m.start()
                    break  # next value (one alias hit is enough for this value)

        # 2. Fuzzy matching for typos, only on tokens not already matched exactly
        offset = 0
        for tok in tokens:
            tok_start = normalized_text.find(tok, offset)
            offset = tok_start + len(tok) if tok_start >= 0 else offset
            clean_tok = tok.strip(".,!?:;\"'()[]{}")
            if len(clean_tok) < 5 or clean_tok.isdigit():
                continue
            if any(s <= tok_start < e for s, e in consumed):
                continue
            best_score, best_val = 0.0, None
            for val in spec.values:
                if val.canonical in hits:
                    continue
                for cand in [val.canonical] + list(val.aliases):
                    if len(cand) >= 5:
                        score = fuzz.ratio(clean_tok.lower(), cand.lower())
                        if score > best_score:
                            best_score, best_val = score, val.canonical
            if best_val and best_score >= fuzzy_threshold * 100:
                hits[best_val] = max(tok_start, 0)

        if hits:
            ordered = [c for c, _ in sorted(hits.items(), key=lambda kv: kv[1])]
            found[spec.name] = ordered[0] if len(ordered) == 1 else ordered

    return found


def extract_entities(
    original_question: str,
    normalized_text: str,
    profile: ProjectProfile | None = None,
    extra_statuses: set[str] | None = None,
) -> dict[str, Any]:
    if not original_question and not normalized_text:
        return {}

    cleaned_orig = clean_unicode_and_limit(original_question)
    entities: dict[str, Any] = {}

    if profile is None:
        from nlp.profile_loader import load_profile
        profile_ctx = load_profile(None)
        profile = profile_ctx.profile

    fuzzy_thresh = profile.thresholds.entity_fuzzy if profile and profile.thresholds else 0.85

    # 1. Collect gazetteer tokens for exclusion in person extraction
    gaz_tokens: set[str] = set()
    gaz_specs = []
    pat_specs = []
    builtin_names = set()

    for et in profile.entity_types:
        if et.kind == "gazetteer":
            gaz_specs.append(et)
            for v in et.values:
                gaz_tokens.add(v.canonical.lower())
                gaz_tokens.update(re.findall(r"\w+", v.canonical.lower()))
                for a in v.aliases:
                    gaz_tokens.add(a.lower())
                    gaz_tokens.update(re.findall(r"\w+", a.lower()))
        elif et.kind == "pattern":
            pat_specs.append(et)
        elif et.kind == "builtin":
            builtin_names.add(et.builtin or et.name)

    # 2. Extract Patterns
    pat_entities = _extract_patterns(cleaned_orig, pat_specs)
    entities.update(pat_entities)

    # 3. Extract Gazetteers
    gaz_entities = _extract_gazetteers(normalized_text, gaz_specs, fuzzy_thresh)
    entities.update(gaz_entities)

    # 4. Extract Builtins
    builtin_entities = _extract_builtins(cleaned_orig, normalized_text, builtin_names, gaz_tokens)
    for k, v in builtin_entities.items():
        if k not in entities:
            entities[k] = v

    # 5. Module Gating for Resume / Skills / Candidate Analysis
    is_resume_module_active = "resume" in (profile.modules or [])
    if is_resume_module_active:
        try:
            from nlp.resume_analyzer import extract_resume_entities
            resume_data = extract_resume_entities(cleaned_orig)
            extracted_skills = resume_data.get("skills") or (
                resume_data.get("technical_skills", []) + resume_data.get("soft_skills", [])
            )
            if extracted_skills:
                entities["skills"] = extracted_skills
            if resume_data.get("candidate_name") and "person" not in entities:
                entities["candidate_name"] = resume_data["candidate_name"]
            if resume_data.get("experience_years"):
                entities["experience_years"] = resume_data["experience_years"]
        except Exception as e:
            logger.debug("Error in resume entity extraction: %s", e)

    return entities
