"""
Trained, data-driven Intent Detector.
TF-IDF + Calibrated/Logistic regression per profile, greeting short-utterance guard,
and out-of-domain fallback with top-3 alternatives.
ZERO domain-specific words.
"""
from dataclasses import dataclass, field
import logging
from typing import Any

import numpy as np
from rapidfuzz import fuzz
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion, Pipeline

from nlp.profile_models import ProjectProfile

logger = logging.getLogger("intent_detector")


@dataclass
class IntentCandidate:
    intent_id: int = 0
    intent_name: str = ""
    endpoint_id: int | None = None
    endpoint_name: str | None = None
    keywords: list[str] = field(default_factory=list)
    phrases: list[str] = field(default_factory=list)
    endpoint_keywords: list[str] = field(default_factory=list)
    description: str | None = None
    parameter_mappings: dict[str, Any] = field(default_factory=dict)


@dataclass
class IntentDetectionResult:
    intent_name: str
    confidence: float
    matched_by: str = "classifier"
    alternatives: list[dict[str, Any]] = field(default_factory=list)
    all_scores: dict[str, float] = field(default_factory=dict)
    endpoint_id: int | None = None
    endpoint_name: str | None = None


@dataclass
class TrainedIntentModel:
    pipeline: Pipeline | None = None
    exact_map: dict[str, str] = field(default_factory=dict)
    example_list: list[tuple[str, str]] = field(default_factory=list)
    intent_entities_expected: dict[str, list[str]] = field(default_factory=dict)


def train_intent_model(profile: ProjectProfile) -> TrainedIntentModel:
    exact_map: dict[str, str] = {}
    example_list: list[tuple[str, str]] = []
    expected_entities: dict[str, list[str]] = {}

    X: list[str] = []
    y: list[str] = []

    for it in profile.intents:
        expected_entities[it.name] = it.entities_expected or []
        for ex in it.examples:
            norm_ex = ex.lower().strip()
            exact_map[norm_ex] = it.name
            example_list.append((norm_ex, it.name))
            X.append(norm_ex)
            y.append(it.name)

    unique_classes = set(y)
    if len(unique_classes) < 2:
        return TrainedIntentModel(
            pipeline=None,
            exact_map=exact_map,
            example_list=example_list,
            intent_entities_expected=expected_entities,
        )

    try:
        word_vec = TfidfVectorizer(analyzer="word", ngram_range=(1, 2), min_df=1)
        char_vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=1)
        union = FeatureUnion([("word", word_vec), ("char", char_vec)])
        clf = LogisticRegression(C=5.0, max_iter=600, solver="lbfgs")
        pipe = Pipeline([("feats", union), ("clf", clf)])
        pipe.fit(X, y)
        return TrainedIntentModel(
            pipeline=pipe,
            exact_map=exact_map,
            example_list=example_list,
            intent_entities_expected=expected_entities,
        )
    except Exception as e:
        logger.warning("Failed training intent classifier: %s", e)
        return TrainedIntentModel(
            pipeline=None,
            exact_map=exact_map,
            example_list=example_list,
            intent_entities_expected=expected_entities,
        )


def detect_intent(
    normalized_question: str,
    raw_question: str = "",
    entities: dict[str, Any] | None = None,
    profile: ProjectProfile | None = None,
    intent_model: TrainedIntentModel | None = None,
    candidates: list[IntentCandidate] | None = None,
    **kwargs: Any,
) -> IntentDetectionResult:
    if entities is None:
        entities = {}
    q_norm = (normalized_question or "").strip().lower()
    q_raw = (raw_question or normalized_question or "").strip()

    if profile is None:
        from nlp.profile_loader import load_profile
        profile_ctx = load_profile(None)
        profile = profile_ctx.profile
        intent_model = profile_ctx.intent_model

    threshold = profile.thresholds.intent if profile and profile.thresholds else 0.40

    if not q_norm:
        return IntentDetectionResult(
            intent_name="Unknown",
            confidence=0.0,
            matched_by="none",
            alternatives=[],
        )

    scores: dict[str, float] = {}
    matched_by = "classifier"

    # 1. Exact match against training examples
    if intent_model and q_norm in intent_model.exact_map:
        matched_intent = intent_model.exact_map[q_norm]
        scores[matched_intent] = 0.99
        matched_by = "exact_example"

    # 2. High-confidence fuzzy match against examples (>= 92%)
    if not scores and intent_model and intent_model.example_list:
        best_fuzz = 0.0
        best_intent = None
        for ex, it_name in intent_model.example_list:
            ratio = fuzz.ratio(q_norm, ex)
            if ratio > best_fuzz:
                best_fuzz = ratio
                best_intent = it_name
        if best_fuzz >= 92.0 and best_intent:
            scores[best_intent] = round(best_fuzz / 100.0, 4)
            matched_by = "fuzzy_example"

    # 3. ML Classifier Prediction
    if intent_model and intent_model.pipeline is not None:
        try:
            pipe = intent_model.pipeline
            probs = pipe.predict_proba([q_norm])[0]
            classes = pipe.classes_
            for cls_name, prob in zip(classes, probs):
                current_score = scores.get(cls_name, float(prob))
                # Add small bonus if extracted entities match expected entities for intent
                expected = intent_model.intent_entities_expected.get(cls_name, [])
                if expected and any(e in entities for e in expected):
                    current_score = min(1.0, current_score + 0.05)
                scores[cls_name] = max(scores.get(cls_name, 0.0), round(current_score, 4))
        except Exception as e:
            logger.debug("Classifier error during prediction: %s", e)

    # 4. Fallback if candidates were passed explicitly
    if not scores and candidates:
        for c in candidates:
            c_score = 0.0
            for phr in c.phrases:
                r = fuzz.ratio(q_norm, phr.lower())
                if r > c_score:
                    c_score = r
            scores[c.intent_name] = round(c_score / 100.0, 4)
            matched_by = "fuzzy_example"

    # Rank all intents in descending order
    sorted_intents = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    alternatives = [
        {"intent": name, "score": round(score, 4)}
        for name, score in sorted_intents[:3]
    ]

    top_intent = sorted_intents[0][0] if sorted_intents else "Unknown"
    top_score = sorted_intents[0][1] if sorted_intents else 0.0

    # 5. Greeting / Small-talk isolation and token count guard
    if top_intent.lower() == "greeting":
        raw_token_count = len(q_raw.split())
        # If utterance has > 3 words and was not an exact example match, suppress Greeting
        if raw_token_count > 3 and matched_by != "exact_example":
            non_greeting_alts = [a for a in sorted_intents if a[0].lower() != "greeting"]
            if non_greeting_alts and non_greeting_alts[0][1] >= threshold:
                top_intent = non_greeting_alts[0][0]
                top_score = non_greeting_alts[0][1]
            else:
                top_intent = "Unknown"
                top_score = non_greeting_alts[0][1] if non_greeting_alts else 0.0
                matched_by = "none"

    if top_intent.lower() == "greeting":
        entities["greeting"] = True
    else:
        entities.pop("greeting", None)

    # 6. Apply threshold
    if top_score < threshold or top_intent == "Unknown":
        detected_intent = "Unknown"
        matched_by = "none"
    else:
        detected_intent = top_intent

    return IntentDetectionResult(
        intent_name=detected_intent,
        confidence=round(top_score, 4),
        matched_by=matched_by,
        alternatives=alternatives,
        all_scores={k: round(v, 4) for k, v in scores.items()},
    )
