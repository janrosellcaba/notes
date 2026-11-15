"""Item payloads."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.project import ContextRef

ItemType = Literal["note", "task", "meeting"]
ItemStatus = Literal["backlog", "todo", "in_progress", "blocked", "done"]
ItemPriority = Literal["none", "low", "medium", "high", "urgent"]
DueFilter = Literal["overdue", "today", "upcoming", "none"]


class ProjectRef(BaseModel):
    id: str
    name: str
    color: str
    context: ContextRef


class Item(BaseModel):
    id: str
    type: ItemType
    title: str
    body_md: str
    project: ProjectRef | None
    status: ItemStatus | None
    priority: ItemPriority | None
    due_on: str | None
    completed_at: str | None
    position: float | None
    pinned: bool
    transcript_raw: str | None
    ai_summary: str | None
    ai_action_items: str | None
    calendar_event_id: str | None
    calendar_provider: str | None
    external_url: str | None
    source_item_id: str | None
    source_selection: str | None
    archived_at: str | None
    deleted_at: str | None = None
    daily_on: str | None = None
    recurrence: Literal["weekly", "monthly"] | None = None
    recurrence_weekday: int | None = None
    recurrence_monthday: int | None = None
    created_at: str
    updated_at: str


class ItemList(BaseModel):
    items: list[Item]
    next_cursor: str | None


class ItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: ItemType
    title: str = ""
    body_md: str = ""
    project_id: str | None = None
    context_id: str | None = None
    status: ItemStatus | None = None
    priority: ItemPriority | None = None
    due_on: str | None = None
    pinned: bool = False
    transcript_raw: str | None = None
    external_url: str | None = None
    recurrence: Literal["weekly", "monthly"] | None = None
    recurrence_weekday: int | None = Field(default=None, ge=0, le=6)
    recurrence_monthday: int | None = Field(default=None, ge=1, le=31)


class ItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    body_md: str | None = None
    project_id: str | None = None
    status: ItemStatus | None = None
    priority: ItemPriority | None = None
    due_on: str | None = None
    pinned: bool | None = None
    transcript_raw: str | None = None
    external_url: str | None = None
    recurrence: Literal["weekly", "monthly"] | None = None
    recurrence_weekday: int | None = Field(default=None, ge=0, le=6)
    recurrence_monthday: int | None = Field(default=None, ge=1, le=31)


class ItemMove(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ItemStatus
    before_id: str | None = None
    after_id: str | None = None


class ItemRef(BaseModel):
    id: str
    type: ItemType
    title: str


class AttachmentMeta(BaseModel):
    id: str
    item_id: str
    filename: str
    content_type: str
    size: int
    created_at: str


class ExtractTask(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=500)
    selection: str | None = Field(default=None, max_length=2000)
