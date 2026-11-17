"""
Answer composer: turns multi-value entities into an LLM-style comparison matrix
(attributes as rows, categories as columns) plus a short readable summary.
ZERO domain-specific words - works for any entity type / any project profile.
"""
from typing import Any


def as_list(value: Any) -> list[Any]:
    """Normalise an entity value (None | str | list) to a list."""
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return [v for v in value if v not in (None, "")]
    return [value]


def _pretty(key: str) -> str:
    return key.replace("_", " ").strip().title()


def compose_matrix(
    entities: dict[str, Any],
    details: dict[str, dict[str, Any]] | None = None,
    entity_key: str = "Category",
) -> dict[str, Any]:
    """
    entities : output of extract_entities(), e.g. {"Category": ["Marine", "Locker"]}
    details  : data fetched by the backend, keyed by category, e.g.
               {"Marine": {"coverage": "...", "premium": "..."},
                "Locker": {"coverage": "...", "premium": "..."}}
    """
    details = details or {}
    categories = as_list(entities.get(entity_key))

    # Case-insensitive lookup of the details dict
    lookup = {str(k).lower(): v for k, v in details.items()}
    per_cat = {c: lookup.get(str(c).lower()) for c in categories}

    attributes: list[str] = []
    for d in per_cat.values():
        for k in (d or {}):
            if k not in attributes:
                attributes.append(k)

    missing = [c for c, d in per_cat.items() if not d]
    rows = [
        {"attribute": _pretty(a), **{c: (per_cat[c] or {}).get(a, "-") for c in categories}}
        for a in attributes
    ]

    # Markdown table (what ChatGPT / Claude / Gemini style UIs render)
    md = ""
    if categories and attributes:
        md += "| Feature | " + " | ".join(categories) + " |\n"
        md += "|---|" + "---|" * len(categories) + "\n"
        for r in rows:
            md += f"| {r['attribute']} | " + " | ".join(str(r[c]) for c in categories) + " |\n"

    return {
        "categories": categories,
        "columns": ["attribute", *categories],
        "rows": rows,
        "missing_categories": missing,
        "markdown_table": md,
    }


def compose_answer(
    question: str,
    intent: str,
    entities: dict[str, Any],
    details: dict[str, dict[str, Any]] | None = None,
    entity_key: str = "Category",
) -> dict[str, Any]:
    m = compose_matrix(entities, details, entity_key)
    cats = m["categories"]

    if not cats:
        text = (
            "I could not find a category in your question. "
            "Please tell me which one you need, for example: 'Standard' or 'Custom'."
        )
    elif len(cats) == 1:
        head = f"Here are the details for **{cats[0]}**:"
        text = head + ("\n\n" + m["markdown_table"] if m["markdown_table"] else "")
    else:
        head = f"Here is a side-by-side comparison of **{' and '.join(cats)}**:"
        text = head + ("\n\n" + m["markdown_table"] if m["markdown_table"] else "")

    if cats and m["missing_categories"]:
        text += (
            "\n\nNo data was returned for: " + ", ".join(m["missing_categories"]) + "."
            if m["markdown_table"]
            else "\n\nThe backend must now fetch details for: " + ", ".join(cats) + "."
        )

    return {
        "question": question,
        "intent": intent,
        "answer_markdown": text,
        "matrix": m,
    }
