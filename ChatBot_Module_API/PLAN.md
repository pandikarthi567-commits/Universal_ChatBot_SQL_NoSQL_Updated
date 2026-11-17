# Universal NLP Chatbot Microservice - Implementation Plan

## 1. Architecture Overview
Transition from hard-coded domain keywords to a **100% data-driven, profile-based NLP architecture**.
The Python NLP microservice remains strictly **NLP-ONLY** (`database_access = false`), containing **ZERO** hard-coded domain words, categories, statuses, Tanglish terms, or typo dictionaries in its Python code.

All domain understanding is loaded at runtime from a **Project Profile** (stored in MongoDB `project_profiles` or loaded from JSON in `profiles/`), with an in-memory cache that automatically builds and caches a per-project machine learning intent classifier and a SymSpell typo correction vocabulary.

---

## 2. Real Files to Create and Modify

### A. Dependencies & Configuration
- **`requirements.txt` & `python/requirements.txt`**: Add `nltk`, `scikit-learn`, `rapidfuzz`, `symspellpy`, `dateparser`, `contractions`, `langdetect`, `numpy`, `ftfy`, `pymongo`, `pytest`.
- **`pytest.ini`**: Update `testpaths` to include `tests`.

### B. Core Data Models & Profile Loader
- **`python/nlp/profile_models.py`** [NEW]:
  - Pydantic models: `ProjectProfile`, `IntentSpec`, `EntityTypeSpec`, `GazetteerValue`, `ThresholdsSpec`.
  - Schema validation with default fallback values (default thresholds: intent=0.40, entity_fuzzy=0.85).
- **`python/nlp/profile_loader.py`** [NEW]:
  - `load_profile(project_code)`: Retrieves profile from memory cache -> MongoDB collection `project_profiles` -> fallback `profiles/{project_code}.json` -> minimal generic profile fallback.
  - `invalidate_profile_cache(project_code)`: Clears cache and triggers retrain.
  - `build_profile_vocabulary(profile)`: Compiles all intent examples, canonical values, aliases, lexicon keys, and NLTK words into a custom SymSpell dictionary for typo correction.
  - Per-project profile caching structure: `{ profile, intent_model, symspell, vocabulary }`.

### C. NLP Pipeline Refactoring (Zero Hard-Coded Domain Keywords)
- **`python/nlp/preprocessing.py`** [REFACTOR]:
  - Unicode NFKC and control-character cleanup (`unicodedata`, `ftfy` fallback).
  - Language/script detection with `langdetect` -> `language_hint` ("en" vs "tanglish" when profile contains `ta-Latn` and Latin script is detected).
  - Contraction expansion (`contractions` library).
  - SymSpell typo correction against project-derived vocabulary only.
  - Normalization lexicon application (whole-word replacement from profile).
  - Output preserving original text while exposing cleaned text.
- **`python/nlp/tokenizer.py`** [REFACTOR]:
  - Remove all hardcoded domain words from `_KEEP_WORDS`.
  - Safe NLTK tokenization, POS tagging, and WordNet lemmatization.
- **`python/nlp/entity_extractor.py`** [REFACTOR]:
  - Completely remove `_NON_NAME_WORDS`, `_DEFAULT_STATUS_KEYWORDS`, and any domain strings.
  - Implement dynamic builtins:
    - `number`, `top_n`, `days`: Regex + `dateparser` duration parsing ("next 15 days", "within 7 days", "this week", "this month" -> integer days).
    - `date_from`, `date_to`: `dateparser.search.search_dates` or standard ISO/date regexes.
    - `id`: generic shape-based regex (10+ digits, or alphanumeric tokens with `/` or `-`).
    - `person`/`org`/`name`: NLTK `ne_chunk` or POS NNP chunking. Filter out any tokens matching ANY active gazetteer canonical value or alias (purely data-driven exclusion).
  - Gazetteer entity matcher:
    - Lemmatized whole-word token/n-gram boundary matching against profile aliases.
    - Fuzzy matching via `rapidfuzz.fuzz.ratio` >= `thresholds.entity_fuzzy` for tokens of 5+ letters.
    - Distance-based and profile-priority tie-breaking.
  - Pattern entity matcher:
    - Compiled regex from profile.
    - Normalization rules: `remove_spaces`, `remove_hyphens`, `uppercase`, etc.
  - Resume extraction gating:
    - Runs ONLY if `"resume"` is in `profile.modules` or explicitly in query.
- **`python/nlp/intent_detector.py`** [REFACTOR]:
  - Completely remove `_SYNONYM_HINTS` and static tables.
  - Train a TF-IDF vectorizer (word 1-2 ngrams + char_wb 2-5 ngrams) + `LogisticRegression` / `CalibratedClassifierCV` per project from intent examples.
  - Intent scoring with entities-expected bonus.
  - Threshold guard: If confidence < `thresholds.intent`, return `intent="Unknown"`, confidence score, and top 3 `alternatives: [{"intent", "score"}]`.
  - Greeting / small-talk handling: Token-count guard evaluated before stopword removal. If intent is `Greeting`, set `entities.greeting = true`.
  - `matched_by`: `classifier` | `exact_example` | `fuzzy_example`.

### D. Microservice & API Layer
- **`python/main.py`** [REFACTOR]:
  - Support `project_code` in `NLPProcessRequest` and `AnalyzeRequest`.
  - `POST /api/nlp/process`: Load profile, execute data-driven pipeline, return full contract with new fields (`alternatives`, `matched_by`, `normalized_question`, `language_hint`).
  - `PUT /admin/profile/{project}` and `GET /admin/profile/{project}`: Manage project profiles dynamically and trigger in-memory model rebuild.
- **`backend/services/nlpService.js`** [UPDATE]:
  - Forward `project_code` to Python microservice.
- **`backend/routes/chat.js` & `backend/server.js`** [VERIFY]:
  - Ensure `GET /api/:appSlug` passes `project_code` and retains all existing contract fields (`intent`, `confidence`, `entities`, `clean_data`, `extracted_data`, `analyzed_data`, `chatbot_language`, `session_id`).
  - Maintain MongoDB `chat_history` logging (one user row, one assistant row).

### E. Profiles, Scripts & Testing
- **`profiles/protect.json`** [NEW]:
  - Comprehensive Insurance example profile with 19 intents (Greeting, Help, OverallReport, CategoryDetail, PolicyStatusList, PolicyLookup, VehicleLookup, LastPolicyEntry, PremiumReport, SumInsuredReport, PartyPolicies, AssetSummary, MemoSummary, HowToAddPolicy, HowToEditPolicy, HowToRenewPolicy, HowToClaim, HowToReports, ProtectDataCheck), 15+ examples per intent including Tanglish and typos.
  - Gazetteer entities (`Category`, `Status`), pattern entities (`vehicle_number`, `policy_number`).
- **`tests/fixtures/sample_profile.json`** [NEW]: Insurance test fixture.
- **`tests/fixtures/second_profile.json`** [NEW]: Job portal test fixture (`modules: ["resume"]`).
- **`scripts/seed_profile.py`** [NEW]: CLI tool to seed profile into MongoDB/local files and train model.
- **`scripts/evaluate.py`** [NEW]: Model evaluation tool with cross-validation, per-intent precision/recall, confusion matrix, and warning if intent < 10 examples.
- **`tests/test_nlp_universal.py`** [NEW]: Comprehensive pytest suite covering all 13 acceptance criteria.
- **`README.md` & `CHANGELOG.md`** [NEW/UPDATE]: Documentation on profile schema, configuration, and architectural upgrade.

---

## 3. Verification & Acceptance Criteria
1. Typo tolerance: "overal reprt" -> OverallReport.
2. Multi-entity: "show me vehicle active" -> Category=Vehicle, Status=active.
3. Alias normalization: "cattle expired" -> Category=Cattle, Status=lapsed.
4. Relative duration: "next 15 days" -> days=15.
5. Tanglish: "mudinjathu" -> Status=lapsed.
6. Pattern regex: "TN 33 AX 5799" -> vehicle_number="TN33AX5799".
7. Policy number: "POL-12345678" or "123456789012" -> policy_number.
8. Small-talk isolation: "hi" -> Greeting, entities.greeting=true. "this is nice" -> NOT Greeting.
9. Out-of-domain: "asdfgh qwerty" -> intent="Unknown", 3 alternatives.
10. Conflict resolution: "policy details" -> does NOT extract Category="LIC".
11. Gazetteer isolation: gazetteer tokens NEVER appear in name.
12. Zero hard-coded domain words: Lint test scanning `python/nlp/*.py` ensuring 0 domain words.
13. Second project: `tests/fixtures/second_profile.json` works seamlessly without code changes.
