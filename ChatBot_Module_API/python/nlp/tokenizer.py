"""
Safe NLTK tokenization, POS tagging, and WordNet lemmatization.
ZERO domain-specific words.
"""
from dataclasses import dataclass
import re

import nltk
from nltk.corpus import stopwords, wordnet
from nltk.stem import WordNetLemmatizer

from nlp.nltk_setup import configure_nltk_data_path

_lemmatizer = WordNetLemmatizer()

_KEEP_WORDS = {
    "how", "many", "much", "what", "which", "who", "when", "where", "why",
    "all", "no", "not", "above", "below", "between", "before", "after",
    "under", "over", "this", "last", "next", "today", "yesterday", "tomorrow",
    "total", "count", "average", "top", "list", "show", "get", "find",
}

_FALLBACK_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "to", "of", "in",
    "for", "on", "with", "at", "by", "from", "as", "into", "through",
    "about", "and", "or", "but", "if", "then", "than", "so", "me", "my",
    "i", "we", "you", "your", "our", "they", "their", "it", "its", "please",
    "give", "tell", "us",
}


# Conversational filler that carries no topic meaning ("i need the ... details").
_FILLER_WORDS = {"need", "want", "like", "kindly", "please", "wanna", "gimme"}


@dataclass
class TokenizationResult:
    tokens: list[str]
    filtered_tokens: list[str]
    pos_tags: list[tuple[str, str]]
    lemmas: list[str]


def _get_stopwords() -> set[str]:
    configure_nltk_data_path()
    try:
        words = set(stopwords.words("english"))
    except Exception:
        words = set(_FALLBACK_STOPWORDS)
    return (words | _FILLER_WORDS) - _KEEP_WORDS


def get_stopwords() -> set[str]:
    """Public accessor for the stop-word set (NLTK list or built-in fallback)."""
    return _get_stopwords()


def remove_stop_words(words: list[str]) -> list[str]:
    """Drop stop words and single-character tokens, keeping order and uniqueness."""
    stop_words = _get_stopwords()
    out: list[str] = []
    for w in words:
        low = w.lower()
        if low in stop_words or (len(low) <= 1 and not low.isdigit()):
            continue
        if low not in out:
            out.append(low)
    return out


def _wordnet_pos(treebank_tag: str) -> str:
    if treebank_tag.startswith("J"):
        return wordnet.ADJ
    if treebank_tag.startswith("V"):
        return wordnet.VERB
    if treebank_tag.startswith("R"):
        return wordnet.ADV
    return wordnet.NOUN


def safe_word_tokenize(text: str) -> list[str]:
    if not text:
        return []
    configure_nltk_data_path()
    try:
        return nltk.word_tokenize(text)
    except Exception:
        return re.findall(r"[A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)*", text)


def safe_pos_tag(tokens: list[str]) -> list[tuple[str, str]]:
    if not tokens:
        return []
    configure_nltk_data_path()
    try:
        return nltk.pos_tag(tokens)
    except Exception:
        tagged: list[tuple[str, str]] = []
        for tok in tokens:
            if tok.isdigit():
                tagged.append((tok, "CD"))
            elif tok.endswith("ing"):
                tagged.append((tok, "VBG"))
            elif tok.endswith("ed"):
                tagged.append((tok, "VBD"))
            elif tok.endswith("s") and len(tok) > 3:
                tagged.append((tok, "NNS"))
            else:
                tagged.append((tok, "NN"))
        return tagged


def safe_lemmatize(word: str, treebank_tag: str = "NN") -> str:
    configure_nltk_data_path()
    wn_pos = _wordnet_pos(treebank_tag)
    try:
        lemma = _lemmatizer.lemmatize(word.lower(), pos=wn_pos)
        if lemma == word.lower() and wn_pos != wordnet.NOUN and word.lower().endswith("s"):
            noun_lemma = _lemmatizer.lemmatize(word.lower(), pos=wordnet.NOUN)
            if len(noun_lemma) < len(lemma):
                return noun_lemma
        return lemma
    except Exception:
        return word.lower()


def tokenize_and_lemmatize(normalized_text: str) -> TokenizationResult:
    tokens = safe_word_tokenize(normalized_text)
    pos_tags = safe_pos_tag(tokens)
    stop_words = _get_stopwords()

    filtered_tokens: list[str] = []
    lemmas: list[str] = []

    for token, tag in pos_tags:
        low = token.lower()
        lemma = safe_lemmatize(low, tag)
        if low not in stop_words and len(low) > 1:
            filtered_tokens.append(low)
            lemmas.append(lemma)
        elif low in _KEEP_WORDS:
            filtered_tokens.append(low)
            lemmas.append(lemma)

    return TokenizationResult(
        tokens=tokens,
        filtered_tokens=filtered_tokens,
        pos_tags=pos_tags,
        lemmas=lemmas,
    )
