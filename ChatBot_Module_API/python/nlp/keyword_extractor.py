from dataclasses import dataclass

from nltk import RegexpParser
from nltk.tree import Tree

from nlp.tokenizer import remove_stop_words, safe_lemmatize

_CHUNK_GRAMMAR = r"""
    NP: {<JJ.*>*<NN.*>+}
"""
_CHUNK_PARSER = RegexpParser(_CHUNK_GRAMMAR)

_GENERIC_COMMAND_WORDS = {
    "show", "get", "list", "find", "display", "give", "tell", "fetch",
    "view", "see", "check", "look", "what", "which", "how", "many",
    "much", "please", "me", "all", "the",
}


@dataclass
class KeywordExtractionResult:
    keywords: list[str]
    topic_keywords: list[str]
    noun_phrases: list[str]


def extract_keywords_and_phrases(
    pos_tags: list[tuple[str, str]],
    filtered_tokens: list[str],
    lemmas: list[str],
) -> KeywordExtractionResult:
    keywords: list[str] = []
    topic_keywords: list[str] = []
    filtered_set = set(filtered_tokens)

    for token, tag in pos_tags:
        low = token.lower()
        if low not in filtered_set:
            continue
        if tag.startswith(("NN", "VB", "JJ", "CD")) or "-" in low:
            lemma = safe_lemmatize(low, tag)
            if lemma not in keywords:
                keywords.append(lemma)
            if lemma not in _GENERIC_COMMAND_WORDS and (
                tag.startswith(("NN", "JJ")) or lemma not in {"be", "have", "do"}
            ):
                if lemma not in topic_keywords:
                    topic_keywords.append(lemma)

    for lemma in lemmas:
        if lemma not in keywords and lemma not in {"be", "have", "do"}:
            keywords.append(lemma)

    noun_phrases: list[str] = []
    if pos_tags:
        try:
            tree = _CHUNK_PARSER.parse(pos_tags)
            for subtree in tree:
                if isinstance(subtree, Tree) and subtree.label() == "NP":
                    phrase_words = [
                        safe_lemmatize(w.lower(), t)
                        for w, t in subtree.leaves()
                        if w.lower() not in _GENERIC_COMMAND_WORDS
                    ]
                    phrase = " ".join(w for w in phrase_words if w)
                    if phrase and phrase not in noun_phrases:
                        noun_phrases.append(phrase)
        except Exception:
            pass

    # Final safety net: no stop words in any output list.
    keywords = remove_stop_words(keywords)
    topic_keywords = remove_stop_words(topic_keywords)
    noun_phrases = [
        p for p in (" ".join(remove_stop_words(ph.split())) for ph in noun_phrases) if p
    ]

    return KeywordExtractionResult(
        keywords=keywords,
        topic_keywords=topic_keywords,
        noun_phrases=noun_phrases,
    )
