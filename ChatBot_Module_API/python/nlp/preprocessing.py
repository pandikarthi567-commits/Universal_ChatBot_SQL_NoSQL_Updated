"""
Text preprocessing pipeline using standard libraries only.
ZERO domain-specific words.
"""
import re
import unicodedata
from typing import Any

import contractions
import langdetect

try:
    import ftfy
except ImportError:
    ftfy = None

MAX_QUESTION_LENGTH = 500
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x1f\x7f]")
_MULTI_SPACE_RE = re.compile(r"\s+")
_PUNCTUATION_RE = re.compile(r"[^\w\s\-/]")
_ID_SHAPE_RE = re.compile(r"^(?:[A-Za-z0-9]+[-/][A-Za-z0-9]+|\d{6,})$")


def clean_unicode_and_limit(text: str, max_length: int = MAX_QUESTION_LENGTH) -> str:
    if not text:
        return ""
    if ftfy is not None:
        try:
            text = ftfy.fix_text(text)
        except Exception:
            pass
    normalized = unicodedata.normalize("NFKC", text)
    normalized = normalized.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    normalized = _CONTROL_CHARS_RE.sub(" ", normalized)
    normalized = _MULTI_SPACE_RE.sub(" ", normalized).strip()
    if len(normalized) > max_length:
        normalized = normalized[:max_length].strip()
    return normalized


def expand_contractions(text: str) -> str:
    if not text:
        return ""
    try:
        return contractions.fix(text)
    except Exception:
        return text


def detect_language_hint(text: str, language_hints: list[str] | None = None) -> str:
    if not text or not text.strip():
        return "en"
    hints = [h.lower() for h in (language_hints or ["en"])]
    has_tanglish = any("ta" in h for h in hints)

    try:
        lang = langdetect.detect(text)
    except Exception:
        lang = "unknown"

    if has_tanglish and lang != "en":
        # Check if text is Latin script
        if all(ord(c) < 128 for c in text if c.isalpha()):
            return "tanglish"
    return "en" if lang == "en" else lang


def correct_typos_with_vocabulary(text: str, symspell: Any, vocabulary: set[str] | None) -> str:
    if not symspell or not text:
        return text
    from symspellpy import Verbosity

    tokens = text.split()
    corrected_tokens: list[str] = []

    for tok in tokens:
        clean_tok = tok.strip(".,!?:;\"'()[]{}")
        if not clean_tok:
            corrected_tokens.append(tok)
            continue

        low = clean_tok.lower()
        if (
            clean_tok.isdigit()
            or len(clean_tok) < 4
            or _ID_SHAPE_RE.match(clean_tok)
            or (vocabulary and low in vocabulary)
        ):
            corrected_tokens.append(tok)
            continue

        try:
            suggestions = symspell.lookup(low, Verbosity.CLOSEST, max_edit_distance=2)
            if suggestions and suggestions[0].distance > 0:
                best = suggestions[0].term
                # Preserve surrounding punctuation
                prefix = tok[: tok.index(clean_tok)]
                suffix = tok[tok.index(clean_tok) + len(clean_tok) :]
                corrected_tokens.append(f"{prefix}{best}{suffix}")
            else:
                corrected_tokens.append(tok)
        except Exception:
            corrected_tokens.append(tok)

    return " ".join(corrected_tokens)


def apply_normalization_lexicon(text: str, lexicon: dict[str, str] | None) -> str:
    if not lexicon or not text:
        return text
    result = text
    for variant, canonical in lexicon.items():
        pattern = rf"\b{re.escape(variant)}\b"
        result = re.sub(pattern, canonical, result, flags=re.IGNORECASE)
    return result


def preprocess_text(
    text: str,
    lexicon: dict[str, str] | None = None,
    symspell: Any = None,
    vocabulary: set[str] | None = None,
    max_length: int = MAX_QUESTION_LENGTH,
) -> str:
    cleaned = clean_unicode_and_limit(text, max_length=max_length)
    expanded = expand_contractions(cleaned)
    normalized = apply_normalization_lexicon(expanded, lexicon)
    corrected = correct_typos_with_vocabulary(normalized, symspell, vocabulary)
    lowered = corrected.lower()
    no_punct = _PUNCTUATION_RE.sub(" ", lowered)
    no_punct = re.sub(r"(?<!\w)[-/]+|[-/]+(?!\w)", " ", no_punct)
    return _MULTI_SPACE_RE.sub(" ", no_punct).strip()
