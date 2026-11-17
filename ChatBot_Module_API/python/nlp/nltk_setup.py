import logging
import os
import nltk

logger = logging.getLogger("nlp.nltk_setup")

REQUIRED_NLTK_RESOURCES: list[tuple[str, str]] = [
    ("punkt", "tokenizers/punkt"),
    ("punkt_tab", "tokenizers/punkt_tab"),
    ("stopwords", "corpora/stopwords"),
    ("words", "corpora/words"),
    ("wordnet", "corpora/wordnet"),
    ("omw-1.4", "corpora/omw-1.4"),
    ("averaged_perceptron_tagger", "taggers/averaged_perceptron_tagger"),
    ("averaged_perceptron_tagger_eng", "taggers/averaged_perceptron_tagger_eng"),
]

NLTK_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".nltk_data")


def configure_nltk_data_path() -> None:
    os.makedirs(NLTK_DATA_DIR, exist_ok=True)
    if NLTK_DATA_DIR not in nltk.data.path:
        nltk.data.path.insert(0, NLTK_DATA_DIR)


def check_nltk_resources() -> dict[str, bool]:
    configure_nltk_data_path()
    status: dict[str, bool] = {}
    for name, resource_path in REQUIRED_NLTK_RESOURCES:
        found = False
        for candidate in (resource_path, f"{resource_path}.zip"):
            try:
                nltk.data.find(candidate)
                found = True
                break
            except LookupError:
                continue
        status[name] = found
    return status


def ensure_nltk_resources(download_missing: bool = True) -> dict[str, bool]:
    configure_nltk_data_path()
    status = check_nltk_resources()
    missing = [name for name, ok in status.items() if not ok]
    if missing and download_missing:
        logger.info("Downloading missing NLTK resources: %s", ", ".join(missing))
        for name in missing:
            try:
                nltk.download(name, download_dir=NLTK_DATA_DIR, quiet=True)
            except Exception as exc:
                logger.warning("Could not download NLTK resource '%s': %s", name, exc)
        status = check_nltk_resources()
    return status


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("Checking and downloading NLTK resources...")
    ensure_nltk_resources(download_missing=True)
    print("NLTK setup complete.")
