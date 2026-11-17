"""
Seed a project profile into MongoDB/local cache and train its NLP model.
Usage: python scripts/seed_profile.py <path-to-profile.json>
ZERO domain-specific words.
"""
import json
import sys
from pathlib import Path

# Add project root and python directory to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir / "python"))

from nlp.profile_loader import load_profile, upsert_profile
from nlp.profile_models import ProjectProfile


def seed_profile(profile_path_str: str):
    profile_path = Path(profile_path_str)
    if not profile_path.exists():
        print(f"Error: Profile file '{profile_path}' does not exist.")
        sys.exit(1)

    print(f"Loading profile from {profile_path}...")
    with open(profile_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    profile = ProjectProfile(**data)
    print(f"Validating profile for project: {profile.project_code}...")

    saved = upsert_profile(profile.model_dump())
    ctx = load_profile(saved.project_code, force_reload=True)

    total_examples = sum(len(it.examples) for it in saved.intents)
    print("\n" + "=" * 60)
    print(f"Profile Seeding Summary: {saved.project_code}")
    print("=" * 60)
    print(f"  Project Code     : {saved.project_code}")
    print(f"  Active Modules   : {saved.modules}")
    print(f"  Language Hints   : {saved.language_hints}")
    print(f"  Total Intents    : {len(saved.intents)}")
    print(f"  Total Examples   : {total_examples}")
    print(f"  Entity Types     : {len(saved.entity_types)}")
    print(f"  Lexicon Entries  : {len(saved.normalization_lexicon)}")
    print(f"  Thresholds       : Intent={saved.thresholds.intent}, Fuzzy={saved.thresholds.entity_fuzzy}")
    print(f"  Vocabulary Size  : {len(ctx.vocabulary)} tokens")
    print(f"  Model Status     : {'TRAINED & CACHED' if ctx.intent_model and ctx.intent_model.pipeline else 'FALLBACK'}")
    print("=" * 60)
    print("Seeding completed successfully!\n")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "profiles/protect.json"
    seed_profile(path)
