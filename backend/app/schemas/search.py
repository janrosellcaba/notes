"""Search payloads."""

from pydantic import BaseModel

from app.schemas.item import ProjectRef


class SearchHit(BaseModel):
    id: str
    type: str
    title: str
    snippet: str
    snippet_field: str
    project: ProjectRef | None
    updated_at: str


class SearchResults(BaseModel):
    results: list[SearchHit]
