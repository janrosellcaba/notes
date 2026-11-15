"""Project payloads."""

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")


class ContextRef(BaseModel):
    id: str
    slug: str
    name: str
    color: str


class Project(BaseModel):
    id: str
    name: str
    color: str
    color_override: str | None
    context: ContextRef
    archived_at: str | None
    created_at: str
    updated_at: str


class ProjectList(BaseModel):
    projects: list[Project]


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    context_id: str = Field(min_length=1)
    color: str | None = None

    @field_validator("color")
    @classmethod
    def color_is_hex(cls, value: str | None) -> str | None:
        if value is not None and _COLOR.fullmatch(value) is None:
            raise ValueError("color must be #RRGGBB")
        return value


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    context_id: str | None = None
    color: str | None = None

    @field_validator("name")
    @classmethod
    def name_bounds(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not 1 <= len(value.strip()) <= 200:
            raise ValueError("name must be 1–200 characters")
        return value

    @field_validator("context_id")
    @classmethod
    def context_present(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value.strip():
            raise ValueError("context_id is required")
        return value

    @field_validator("color")
    @classmethod
    def color_is_hex(cls, value: str | None) -> str | None:
        if value is not None and _COLOR.fullmatch(value) is None:
            raise ValueError("color must be #RRGGBB")
        return value
