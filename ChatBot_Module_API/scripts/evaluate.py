"""
Profile Intent Evaluation Tool.
Runs Stratified K-Fold cross-validation over intent examples, prints accuracy,
per-intent precision/recall/F1, confusion matrix, and warns if any intent has < 10 examples.
Usage: python scripts/evaluate.py <project_code>
ZERO domain-specific words.
"""
from collections import Counter
from pathlib import Path
import sys
import warnings

# Suppress sklearn convergence/undetermined metric warnings during CV
warnings.filterwarnings("ignore")

root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir / "python"))

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import FeatureUnion, Pipeline

from nlp.profile_loader import load_profile


def evaluate_project(project_code: str):
    ctx = load_profile(project_code)
    profile = ctx.profile

    print("=" * 70)
    print(f"  Evaluating Intent Model for Project: {profile.project_code}")
    print("=" * 70)

    # 1. Inspect example counts and issue warnings if < 10
    has_low_count = False
    for it in profile.intents:
        cnt = len(it.examples)
        if cnt < 10:
            print(f"⚠️  WARNING: Intent '{it.name}' has only {cnt} examples (< 10 recommended).")
            has_low_count = True
    if not has_low_count:
        print("✅ All intents have >= 10 examples.")

    X: list[str] = []
    y: list[str] = []
    for it in profile.intents:
        for ex in it.examples:
            norm_ex = ex.lower().strip()
            if norm_ex:
                X.append(norm_ex)
                y.append(it.name)

    if len(set(y)) < 2 or len(X) < 4:
        print("Error: Need at least 2 distinct intents with multiple examples to evaluate.")
        return

    counts = Counter(y)
    min_count = min(counts.values())
    n_splits = max(2, min(5, min_count))

    print(f"\nRunning {n_splits}-Fold Stratified Cross-Validation on {len(X)} examples across {len(counts)} intents...")

    word_vec = TfidfVectorizer(analyzer="word", ngram_range=(1, 2), min_df=1)
    char_vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=1)
    union = FeatureUnion([("word", word_vec), ("char", char_vec)])
    clf = LogisticRegression(C=5.0, max_iter=600, solver="lbfgs")
    pipe = Pipeline([("feats", union), ("clf", clf)])

    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    y_pred = cross_val_predict(pipe, X, y, cv=cv)

    acc = accuracy_score(y, y_pred)
    print("\n" + "=" * 70)
    print(f"  Overall Accuracy: {acc * 100:.2f}%")
    print("=" * 70)

    labels = sorted(list(counts.keys()))
    print("\nPer-Intent Precision, Recall, and F1-Score:")
    print("-" * 70)
    print(classification_report(y, y_pred, labels=labels, zero_division=0))

    print("\nConfusion Matrix:")
    print("-" * 70)
    cm = confusion_matrix(y, y_pred, labels=labels)
    # Print header
    header_indices = "  ".join(f"{i:>3}" for i in range(len(labels)))
    print(f"{'':>25} | {header_indices}")
    print("-" * (28 + len(header_indices)))
    for idx, (label, row) in enumerate(zip(labels, cm)):
        row_str = "  ".join(f"{val:>3}" for val in row)
        print(f"[{idx:>2}] {label:>20} | {row_str}")

    print("\nLegend:")
    for idx, label in enumerate(labels):
        print(f"  [{idx:>2}] {label}")

    print("=" * 70)
    print(f"Evaluation complete for '{profile.project_code}'.\n")


if __name__ == "__main__":
    code = sys.argv[1] if len(sys.argv) > 1 else "protect"
    evaluate_project(code)
