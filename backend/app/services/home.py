"""Home launchpad feed."""

from __future__ import annotations

from app.db import Database
from app.errors import field_error
from app.schemas.home import HomeFeed
from app.schemas.item import Item
from app.services.contexts import require_context
from app.services.items import _COLUMNS, _FROM, _valid_day, to_item

_PRIORITY = """
CASE i.priority
  WHEN 'urgent' THEN 0
  WHEN 'high' THEN 1
  WHEN 'medium' THEN 2
  WHEN 'low' THEN 3
  ELSE 4
END
"""


async def home_feed(db: Database, *, context_id: str | None, today: str) -> HomeFeed:
    if not _valid_day(today):
        field_error("today", "today must be YYYY-MM-DD")
    if context_id is not None:
        await require_context(db, context_id)
    context_sql = ""
    context_params: tuple[str, ...] = ()
    if context_id is not None:
        context_sql = "AND (i.project_id IS NULL OR c.id = ?)"
        context_params = (context_id,)
    count = await db.fetchone(
        "SELECT COUNT(*) AS n FROM items WHERE project_id IS NULL AND archived_at IS NULL"
    )
    pinned_rows = await db.fetchall(
        f"""
        SELECT {_COLUMNS} {_FROM}
        WHERE i.pinned = 1 AND i.archived_at IS NULL AND i.type IN ('note', 'meeting')
          {context_sql}
        ORDER BY i.updated_at DESC
        LIMIT 24
        """,
        context_params,
    )
    task_rows = await db.fetchall(
        f"""
        SELECT {_COLUMNS} {_FROM}
        WHERE i.type = 'task' AND i.archived_at IS NULL AND i.due_on = ? AND i.status != 'done'
          {context_sql}
        ORDER BY {_PRIORITY}, i.position ASC
        """,
        (today, *context_params),
    )
    pinned: list[Item] = [to_item(row) for row in pinned_rows]
    tasks: list[Item] = [to_item(row) for row in task_rows]
    total = 0 if count is None else int(count["n"])
    return HomeFeed(today=today, inbox_count=total, pinned=pinned, today_tasks=tasks)
