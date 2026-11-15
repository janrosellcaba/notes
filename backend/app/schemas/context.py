"""Context payloads."""

import re

from pydantic import BaseModel, ConfigDict, field_validator

_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")


class Context(BaseModel):
    id: str
    slug: str
    name: str
    color: str
    icon: str | None = None
    sort_order: int
    created_at: str
    updated_at: str


class ContextList(BaseModel):
    contexts: list[Context]


class ContextCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    color: str | None = None
    icon: str | None = None

    @field_validator("name")
    @classmethod
    def name_bounds(cls, value: str) -> str:
        if not 1 <= len(value.strip()) <= 80:
            raise ValueError("name must be 1–80 characters")
        return value

    @field_validator("color")
    @classmethod
    def color_is_hex(cls, value: str | None) -> str | None:
        if value is not None and _COLOR.fullmatch(value) is None:
            raise ValueError("color must be #RRGGBB")
        return value


class ContextUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    color: str | None = None
    icon: str | None = None
    sort_order: int | None = None

    @field_validator("name")
    @classmethod
    def name_bounds(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not 1 <= len(value.strip()) <= 80:
            raise ValueError("name must be 1–80 characters")
        return value

    @field_validator("color")
    @classmethod
    def color_is_hex(cls, value: str | None) -> str | None:
        if value is not None and _COLOR.fullmatch(value) is None:
            raise ValueError("color must be #RRGGBB")
        return value
