"""
Profile data models and validation schema.
ZERO domain-specific words.
"""
from typing import Any, Literal
from pydantic import BaseModel, Field


class GazetteerValue(BaseModel):
    canonical: str
    aliases: list[str] = Field(default_factory=list)


class EntityTypeSpec(BaseModel):
    name: str
    kind: Literal["gazetteer", "pattern", "builtin"] = "gazetteer"
    priority: int = 10
    values: list[GazetteerValue] = Field(default_factory=list)
    regex: str | None = None
    normalize_rule: list[str] = Field(default_factory=list)
    builtin: str | None = None


class IntentSpec(BaseModel):
    name: str
    description: str = ""
    examples: list[str] = Field(default_factory=list)
    entities_expected: list[str] = Field(default_factory=list)


class ThresholdsSpec(BaseModel):
    intent: float = 0.40
    entity_fuzzy: float = 0.85


class ProjectProfile(BaseModel):
    project_code: str = "DEFAULT"
    modules: list[str] = Field(default_factory=list)
    language_hints: list[str] = Field(default_factory=lambda: ["en"])
    intents: list[IntentSpec] = Field(default_factory=list)
    entity_types: list[EntityTypeSpec] = Field(default_factory=list)
    normalization_lexicon: dict[str, str] = Field(default_factory=dict)
    thresholds: ThresholdsSpec = Field(default_factory=ThresholdsSpec)
