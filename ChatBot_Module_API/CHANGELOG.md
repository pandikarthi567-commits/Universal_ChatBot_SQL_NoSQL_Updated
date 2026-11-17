# Changelog

All notable changes to the Universal NLP Chatbot Microservice are documented here.

## [2.1.0] - 2026-11-16

### Architectural Upgrade: Zero Hard-Coded Domain Keywords (Profile-Driven Architecture)

#### Added
- **Project Profile Engine (`python/nlp/profile_models.py`, `python/nlp/profile_loader.py`)**:
  - Declarative Pydantic profile schema with gazetteer, pattern, and builtin entity types.
  - Multi-tier profile loading: In-memory cache -> MongoDB Atlas (`project_profiles`) -> local `profiles/*.json` fallback -> minimal generic profile.
  - Cache invalidation and automatic retraining on profile update.
- **Dynamic Vocabulary & SymSpell Typo Correction (`python/nlp/preprocessing.py`)**:
  - Typo correction built dynamically at runtime from project intent examples, aliases, canonical entities, and NLTK word list.
  - No static typo tables or dictionaries in source code.
  - Contraction expansion (`contractions`) and language hint detection (`langdetect`, "en" vs "tanglish").
- **Trained Intent Classifier (`python/nlp/intent_detector.py`)**:
  - TF-IDF (word 1-2 ngrams + char_wb 2-5 ngrams) with Logistic Regression / Calibrated Classifier trained per project.
  - Out-of-domain detection returning `Unknown` with top-3 `alternatives` when below threshold.
  - Short-utterance token count guard for greeting / small-talk isolation before stopword removal.
- **Data-Driven Entity Extraction (`python/nlp/entity_extractor.py`)**:
  - Dynamic gazetteer matching with whole-word token boundaries and `rapidfuzz` fuzzy matching.
  - Pattern matching with configurable normalization rules (`remove_spaces`, `remove_hyphens`, `uppercase`).
  - Dynamic name/person extraction with automatic exclusion of all active project gazetteer tokens (zero static exclusion lists).
  - Module gating: Resume/skills extraction runs strictly when `"resume"` is enabled in the profile's modules.
- **Admin Endpoints**:
  - `GET /admin/profile/{project}` and `PUT /admin/profile/{project}` in Python microservice and proxied in Node.js backend.
- **Tooling & Scripts**:
  - `scripts/seed_profile.py`: CLI tool for idempotent profile upsert and model retraining.
  - `scripts/evaluate.py`: Evaluation tool executing stratified K-fold cross-validation, precision/recall per intent, and confusion matrix.
- **Example Profiles & Test Fixtures**:
  - `profiles/protect.json`: Comprehensive insurance example profile with 19 intents, 305+ examples (including Tanglish and typos), 15 category gazetteers, status gazetteers, vehicle and policy number patterns.
  - `tests/fixtures/sample_profile.json` and `tests/fixtures/second_profile.json` (Job Portal).
  - `tests/test_nlp_universal.py`: Comprehensive test suite testing all 13 acceptance criteria.

#### Removed
- Removed all hard-coded domain word lists (`_NON_NAME_WORDS`, `_DEFAULT_STATUS_KEYWORDS`, `_SYNONYM_HINTS`) from `python/nlp/`.
- Removed domain-specific rules and static keyword mappings from code.
- Passed 100% on AST/regex lint test verifying zero domain keywords in `python/nlp/*.py`.

#### Changed
- Enhanced API contract with backward-compatible fields: `alternatives`, `matched_by`, `normalized_question`, `language_hint`.
- Node.js backend (`backend/server.js`, `backend/routes/chat.js`, `backend/services/nlpService.js`) updated to forward `project_code`.
