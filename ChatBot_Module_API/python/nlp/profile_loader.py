"""
Profile loader, MongoDB/JSON storage, in-memory cache, and vocabulary builder.
ZERO domain-specific words.
"""
from dataclasses import dataclass, field
import json
import logging
import os
from pathlib import Path
import re
from typing import Any

from nlp.profile_models import ProjectProfile, IntentSpec, EntityTypeSpec

logger = logging.getLogger("profile_loader")

_BASE_DIR = Path(__file__).resolve().parent.parent.parent


@dataclass
class ProfileContext:
    profile: ProjectProfile
    intent_model: Any = None
    symspell: Any = None
    gazetteer_tokens: set[str] = field(default_factory=set)
    vocabulary: set[str] = field(default_factory=set)


_PROFILE_CONTEXT_CACHE: dict[str, ProfileContext] = {}


def _get_mongo_collection():
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        env_path = _BASE_DIR / "backend" / ".env"
        if env_path.exists():
            from dotenv import dotenv_values
            cfg = dotenv_values(str(env_path))
            uri = cfg.get("MONGODB_URI")
    if not uri:
        return None
    try:
        import pymongo
        client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=2000)
        db = client.get_database("test")
        return db["project_profiles"]
    except Exception as e:
        logger.warning("MongoDB connection for project_profiles unavailable: %s", e)
        return None


def build_profile_symspell(profile: ProjectProfile):
    try:
        from symspellpy import SymSpell
        sym = SymSpell(max_dictionary_edit_distance=2, prefix_length=7)
    except Exception as e:
        logger.warning("SymSpell could not be initialized: %s", e)
        return None, set()

    vocab: set[str] = set()

    for it in profile.intents:
        for ex in it.examples:
            for w in re.findall(r"[A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)*", ex.lower()):
                vocab.add(w)
        for w in re.findall(r"[A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)*", it.description.lower()):
            vocab.add(w)

    for et in profile.entity_types:
        for val in et.values:
            for w in re.findall(r"[A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)*", val.canonical.lower()):
                vocab.add(w)
            for alias in val.aliases:
                for w in re.findall(r"[A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)*", alias.lower()):
                    vocab.add(w)

    for k, v in profile.normalization_lexicon.items():
        for w in re.findall(r"[A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)*", k.lower()):
            vocab.add(w)
        for w in re.findall(r"[A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)*", v.lower()):
            vocab.add(w)

    try:
        from nltk.corpus import words
        for w in words.words():
            vocab.add(w.lower())
    except Exception:
        pass

    for word in vocab:
        sym.create_dictionary_entry(word, 1000)

    return sym, vocab


def extract_gazetteer_tokens(profile: ProjectProfile) -> set[str]:
    tokens: set[str] = set()
    for et in profile.entity_types:
        if et.kind == "gazetteer":
            for val in et.values:
                tokens.add(val.canonical.lower())
                for w in re.findall(r"\w+", val.canonical.lower()):
                    tokens.add(w)
                for alias in val.aliases:
                    tokens.add(alias.lower())
                    for w in re.findall(r"\w+", alias.lower()):
                        tokens.add(w)
    return tokens


def build_profile_context(profile: ProjectProfile) -> ProfileContext:
    from nlp.intent_detector import train_intent_model

    sym, vocab = build_profile_symspell(profile)
    gaz_tokens = extract_gazetteer_tokens(profile)
    intent_model = train_intent_model(profile)

    return ProfileContext(
        profile=profile,
        intent_model=intent_model,
        symspell=sym,
        gazetteer_tokens=gaz_tokens,
        vocabulary=vocab,
    )


def load_profile(project_code: str | None, force_reload: bool = False) -> ProfileContext:
    code = (project_code or "DEFAULT").strip().upper()

    if not force_reload and code in _PROFILE_CONTEXT_CACHE:
        return _PROFILE_CONTEXT_CACHE[code]

    profile_dict: dict[str, Any] | None = None

    # 1. Check MongoDB project_profiles
    col = _get_mongo_collection()
    if col is not None:
        try:
            doc = col.find_one({"project_code": {"$regex": f"^{re.escape(code)}$", "$options": "i"}})
            if doc:
                doc.pop("_id", None)
                profile_dict = doc
        except Exception as e:
            logger.warning("Failed querying project_profiles from Mongo: %s", e)

    # 2. Check local profiles/*.json
    if not profile_dict:
        candidates = [
            _BASE_DIR / "profiles" / f"{code.lower()}.json",
            _BASE_DIR / "profiles" / f"{code.upper()}.json",
            _BASE_DIR / "profiles" / f"{code}.json",
            _BASE_DIR / "tests" / "fixtures" / f"{code.lower()}.json",
            _BASE_DIR / "tests" / "fixtures" / "sample_profile.json" if code in {"SAMPLE", "DEFAULT"} else None,
        ]
        for path in candidates:
            if path and path.exists():
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        profile_dict = json.load(f)
                    break
                except Exception as e:
                    logger.warning("Error reading profile %s: %s", path, e)

    # 3. Fallback to generic minimal profile
    if not profile_dict:
        profile = ProjectProfile(
            project_code=code,
            modules=[],
            language_hints=["en"],
            entity_types=[
                EntityTypeSpec(name="number", kind="builtin", builtin="number"),
                EntityTypeSpec(name="id", kind="builtin", builtin="id"),
            ],
            intents=[],
        )
    else:
        profile = ProjectProfile(**profile_dict)

    ctx = build_profile_context(profile)
    _PROFILE_CONTEXT_CACHE[code] = ctx
    return ctx


def invalidate_profile_cache(project_code: str):
    code = project_code.strip().upper()
    if code in _PROFILE_CONTEXT_CACHE:
        del _PROFILE_CONTEXT_CACHE[code]


def upsert_profile(profile_data: dict[str, Any]) -> ProjectProfile:
    profile = ProjectProfile(**profile_data)
    code = profile.project_code.strip().upper()

    # Save to local file
    profiles_dir = _BASE_DIR / "profiles"
    profiles_dir.mkdir(parents=True, exist_ok=True)
    file_path = profiles_dir / f"{code.lower()}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(profile.model_dump(), f, indent=2)

    # Upsert to MongoDB
    col = _get_mongo_collection()
    if col is not None:
        try:
            col.update_one(
                {"project_code": {"$regex": f"^{re.escape(code)}$", "$options": "i"}},
                {"$set": profile.model_dump()},
                upsert=True,
            )
        except Exception as e:
            logger.warning("Failed upserting profile to Mongo: %s", e)

    # Invalidate and reload
    invalidate_profile_cache(code)
    load_profile(code, force_reload=True)
    return profile
