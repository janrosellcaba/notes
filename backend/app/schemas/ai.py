"""Stub response for the future LLM hook."""

from pydantic import BaseModel


class PlannedEffects(BaseModel):
    writes: list[str]
    may_create: str


class AIProcessResult(BaseModel):
    detail: str
    code: str
    item_id: str
    planned_effects: PlannedEffects
