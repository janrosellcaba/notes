"""Home feed payloads."""

from pydantic import BaseModel

from app.schemas.item import Item


class HomeFeed(BaseModel):
    today: str
    inbox_count: int
    pinned: list[Item]
    today_tasks: list[Item]
