"""Notes, tasks, and meetings."""

from __future__ import annotations

import base64
import calendar
import re
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from app.db import Database, Transaction
from app.errors import AppError, field_error, payload_too_large
from app.schemas.item import (
    DueFilter,
    ExtractTask,
    Item,
    ItemCreate,
    ItemPriority,
    ItemStatus,
    ProjectRef,
)
from app.schemas.project import ContextRef
from app.services import utc_now
from app.services.contexts import require_context
from app.services.idempotency import canonical_hash, purge_expired, validate_key
from app.services.projects import require_active_project

Reader = Database | Transaction

TITLE_MAX = 500
BODY_MAX = 500_000
TRANSCRIPT_MAX = 2_000_000
SELECTION_MAX = 2_000
_DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MEETING_TEMPLATE = """## Attendees

- 

## Decisions

- 

## Action items

- 
"""
_SAME_PROJECT = "((? IS NULL AND project_id IS NULL) OR project_id = ?)"

_COLUMNS = """
i.id, i.type, i.title, i.body_md, i.status, i.priority, i.due_on, i.completed_at,
i.position, i.pinned, i.transcript_raw, i.ai_summary, i.ai_action_items,
i.calendar_event_id, i.calendar_provider, i.external_url, i.source_item_id,
i.source_selection, i.archived_at, i.deleted_at, i.daily_on, i.recurrence,
i.recurrence_weekday, i.recurrence_monthday, i.created_at, i.updated_at,
p.id AS proj_id, p.name AS proj_name, p.color AS proj_color,
c.id AS ctx_id, c.slug AS ctx_slug, c.name AS ctx_name, c.color AS ctx_color, c.icon AS ctx_icon
"""
_FROM = """
FROM items i
LEFT JOIN projects p ON p.id = i.project_id
LEFT JOIN contexts c ON c.id = p.context_id
"""


def _valid_day(value: str) -> bool:
    if _DAY.fullmatch(value) is None:
        return False
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return False
    return True


def _limit_text(field: str, value: str | None, limit: int) -> None:
    if value is not None and len(value) > limit:
        payload_too_large(field, limit)


def _blank(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    return value


def to_item(row: Any) -> Item:
    project = None
    if row["proj_id"] is not None:
        project = ProjectRef(
            id=row["proj_id"],
            name=row["proj_name"],
            color=row["proj_color"] or row["ctx_color"],
            context=ContextRef(
                id=row["ctx_id"],
                slug=row["ctx_slug"],
                name=row["ctx_name"],
                color=row["ctx_color"],
                icon=row["ctx_icon"],
            ),
        )
    position = None if row["position"] is None else float(row["position"])
    return Item(
        id=row["id"],
        type=row["type"],
        title=row["title"],
        body_md=row["body_md"],
        project=project,
        status=row["status"],
        priority=row["priority"],
        due_on=row["due_on"],
        completed_at=row["completed_at"],
        position=position,
        pinned=bool(row["pinned"]),
        transcript_raw=row["transcript_raw"],
        ai_summary=row["ai_summary"],
        ai_action_items=row["ai_action_items"],
        calendar_event_id=row["calendar_event_id"],
        calendar_provider=row["calendar_provider"],
        external_url=row["external_url"],
        source_item_id=row["source_item_id"],
        source_selection=row["source_selection"],
        archived_at=row["archived_at"],
        deleted_at=row["deleted_at"],
        daily_on=row["daily_on"],
        recurrence=row["recurrence"],
        recurrence_weekday=row["recurrence_weekday"],
        recurrence_monthday=row["recurrence_monthday"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


async def get_item(db: Reader, item_id: str) -> Item:
    row = await db.fetchone(f"SELECT {_COLUMNS} {_FROM} WHERE i.id = ?", (item_id,))
    if row is None:
        raise AppError(404, "Item not found", "not_found")
    return to_item(row)


def _encode_cursor(parts: list[str]) -> str:
    token = base64.urlsafe_b64encode("\n".join(parts).encode("utf-8")).decode("ascii")
    return token.rstrip("=")


def _decode_cursor(token: str) -> list[str]:
    padded = token + ("=" * (-len(token) % 4))
    try:
        text = base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")
    except (ValueError, UnicodeDecodeError) as exc:
        raise AppError(400, "Invalid cursor", "bad_cursor") from exc
    return text.split("\n")


def _sort_mode(project_id: str | None, pinned: bool | None, due: str | None) -> str:
    if project_id == "none":
        return "created"
    if pinned is True:
        return "updated"
    if due == "none":
        return "created_asc"
    if due is not None:
        return "due"
    return "updated"


async def list_items(
    db: Database,
    *,
    type: str | None,
    project_id: str | None,
    context_id: str | None,
    pinned: bool | None,
    status: str | None,
    due: DueFilter | None,
    today: str | None,
    include_done: bool,
    archived: bool,
    trashed: bool,
    limit: int,
    cursor: str | None,
) -> tuple[list[Item], str | None]:
    if context_id is not None:
        await require_context(db, context_id)
    if today is not None and not _valid_day(today):
        field_error("today", "today must be YYYY-MM-DD")
    if due in ("overdue", "today", "upcoming") and today is None:
        field_error("today", "today must be YYYY-MM-DD")

    clauses = ["i.deleted_at IS NOT NULL" if trashed else "i.deleted_at IS NULL"]
    if not trashed:
        clauses.append("i.archived_at IS NOT NULL" if archived else "i.archived_at IS NULL")
    params: list[Any] = []
    if type is not None:
        clauses.append("i.type = ?")
        params.append(type)
    if project_id == "none":
        clauses.append("i.project_id IS NULL")
    elif project_id is not None:
        clauses.append("i.project_id = ?")
        params.append(project_id)
    if context_id is not None:
        clauses.append("(i.project_id IS NULL OR c.id = ?)")
        params.append(context_id)
    if pinned is not None:
        clauses.append("i.pinned = ?")
        params.append(1 if pinned else 0)
    if status is not None:
        clauses.append("i.status = ?")
        params.append(status)
    elif not include_done:
        clauses.append("(i.type != 'task' OR i.status != 'done')")
    if due == "none":
        clauses.append("i.due_on IS NULL")
    elif due == "today":
        clauses.append("i.due_on = ?")
        params.append(today)
    elif due == "overdue":
        clauses.append("i.due_on < ?")
        params.append(today)
    elif due == "upcoming":
        clauses.append("i.due_on > ?")
        params.append(today)

    mode = _sort_mode(project_id, pinned, due)
    if cursor is not None:
        parts = _decode_cursor(cursor)
        if not parts or parts[0] != mode:
            raise AppError(400, "Invalid cursor", "bad_cursor")
        if mode in ("created", "updated", "created_asc") and len(parts) != 3:
            raise AppError(400, "Invalid cursor", "bad_cursor")
        if mode == "due" and len(parts) != 4:
            raise AppError(400, "Invalid cursor", "bad_cursor")
        if mode == "created":
            clauses.append("(i.created_at < ? OR (i.created_at = ? AND i.id < ?))")
            params.extend((parts[1], parts[1], parts[2]))
        elif mode == "updated":
            clauses.append("(i.updated_at < ? OR (i.updated_at = ? AND i.id < ?))")
            params.extend((parts[1], parts[1], parts[2]))
        elif mode == "created_asc":
            clauses.append("(i.created_at > ? OR (i.created_at = ? AND i.id > ?))")
            params.extend((parts[1], parts[1], parts[2]))
        else:
            clauses.append(
                "(i.due_on > ? OR (i.due_on = ? AND i.created_at > ?) "
                "OR (i.due_on = ? AND i.created_at = ? AND i.id > ?))"
            )
            params.extend((parts[1], parts[1], parts[2], parts[1], parts[2], parts[3]))

    if mode == "created":
        order = "i.created_at DESC, i.id DESC"
    elif mode == "created_asc":
        order = "i.created_at ASC, i.id ASC"
    elif mode == "due":
        order = "i.due_on ASC, i.created_at ASC, i.id ASC"
    else:
        order = "i.updated_at DESC, i.id DESC"

    rows = await db.fetchall(
        f"SELECT {_COLUMNS} {_FROM} WHERE {' AND '.join(clauses)} ORDER BY {order} LIMIT ?",
        [*params, limit + 1],
    )
    page = rows[:limit]
    next_cursor = None
    if len(rows) > limit and page:
        last = page[-1]
        if mode == "created":
            next_cursor = _encode_cursor(["created", last["created_at"], last["id"]])
        elif mode == "created_asc":
            next_cursor = _encode_cursor(["created_asc", last["created_at"], last["id"]])
        elif mode == "due":
            next_cursor = _encode_cursor(["due", last["due_on"], last["created_at"], last["id"]])
        else:
            next_cursor = _encode_cursor(["updated", last["updated_at"], last["id"]])
    return [to_item(row) for row in page], next_cursor


async def _next_position(tx: Reader, project_id: str | None, status: str) -> float:
    row = await tx.fetchone(
        f"""
        SELECT COALESCE(MAX(position), 0) + 1024 AS pos
        FROM items
        WHERE type = 'task' AND status = ? AND {_SAME_PROJECT}
        """,
        (status, project_id, project_id),
    )
    assert row is not None
    return float(row["pos"])


def _prepare_create(body: ItemCreate) -> dict[str, Any]:
    _limit_text("title", body.title, TITLE_MAX)
    _limit_text("body_md", body.body_md, BODY_MAX)
    _limit_text("transcript_raw", body.transcript_raw, TRANSCRIPT_MAX)
    transcript = _blank(body.transcript_raw)
    external_url = _blank(body.external_url)
    if body.type in ("note", "meeting"):
        if body.status is not None:
            field_error("status", "Notes and meetings cannot set status")
        if body.priority is not None:
            field_error("priority", "Notes and meetings cannot set priority")
        if body.due_on is not None:
            field_error("due_on", "Notes and meetings cannot set due_on")
    if body.type == "note" and transcript is not None:
        field_error("transcript_raw", "Notes cannot include a transcript")
    if body.type == "task" and transcript is not None:
        field_error("transcript_raw", "Tasks cannot include a transcript")
    if body.type == "task" and body.pinned:
        field_error("pinned", "Tasks cannot be pinned")
    title = body.title
    status: ItemStatus | None = None
    priority: ItemPriority | None = None
    due_on = None
    position = None
    pinned = body.pinned
    if body.type == "note" and not title.strip() and body.body_md.strip():
        title = "Untitled"
    body_md = body.body_md
    if body.type == "meeting" and not body_md.strip():
        body_md = MEETING_TEMPLATE
        if not title.strip():
            title = "Meeting"
    if body.type == "task":
        if not title.strip():
            field_error("title", "Tasks require a title")
        title = title.strip()
        status = body.status or "todo"
        priority = body.priority or "none"
        if body.due_on is not None and not _valid_day(body.due_on):
            field_error("due_on", "due_on must be YYYY-MM-DD")
        due_on = body.due_on
        pinned = False
        transcript = None
    recurrence = body.recurrence
    weekday = body.recurrence_weekday
    monthday = body.recurrence_monthday
    if body.type != "task" and (recurrence or weekday is not None or monthday is not None):
        field_error("recurrence", "Only tasks can repeat")
    if body.type == "task" and recurrence == "weekly" and weekday is None and due_on:
        weekday = datetime.strptime(due_on, "%Y-%m-%d").weekday()
    if body.type == "task" and recurrence == "monthly" and monthday is None:
        monthday = int(due_on[8:10]) if due_on else 1
    if body.type != "task":
        recurrence = None
        weekday = None
        monthday = None
    return {
        "type": body.type,
        "title": title,
        "body_md": body_md,
        "recurrence": recurrence,
        "recurrence_weekday": weekday,
        "recurrence_monthday": monthday,
        "project_id": body.project_id,
        "status": status,
        "priority": priority,
        "due_on": due_on,
        "position": position,
        "pinned": 1 if pinned else 0,
        "transcript_raw": transcript,
        "external_url": external_url,
    }


async def create_item(
    db: Database,
    body: ItemCreate,
    *,
    idempotency_key: str | None,
) -> tuple[Item, bool]:
    key = validate_key(idempotency_key)
    prepared = _prepare_create(body)
    digest = canonical_hash(body.model_dump(mode="json"))
    if key is not None:
        await purge_expired(db)
    async with db.transaction() as tx:
        if key is not None:
            existing = await tx.fetchone(
                "SELECT item_id, request_hash FROM idempotency_keys WHERE key = ?",
                (key,),
            )
            if existing is not None:
                if existing["request_hash"] != digest:
                    raise AppError(
                        409,
                        "Idempotency key was reused with a different request body",
                        "idempotency_conflict",
                    )
                return await get_item(tx, existing["item_id"]), False
        if prepared["project_id"] is not None:
            await require_active_project(tx, prepared["project_id"])
        if prepared["type"] == "task":
            prepared["position"] = await _next_position(tx, prepared["project_id"], prepared["status"])
        now = utc_now()
        item_id = str(uuid4())
        completed = now if prepared["status"] == "done" else None
        await tx.execute(
            """
            INSERT INTO items (
              id, type, title, body_md, project_id, status, priority, due_on, completed_at,
              position, pinned, transcript_raw, external_url, recurrence, recurrence_weekday,
              recurrence_monthday, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item_id,
                prepared["type"],
                prepared["title"],
                prepared["body_md"],
                prepared["project_id"],
                prepared["status"],
                prepared["priority"],
                prepared["due_on"],
                completed,
                prepared["position"],
                prepared["pinned"],
                prepared["transcript_raw"],
                prepared["external_url"],
                prepared["recurrence"],
                prepared["recurrence_weekday"],
                prepared["recurrence_monthday"],
                now,
                now,
            ),
        )
        if key is not None:
            await tx.execute(
                """
                INSERT INTO idempotency_keys (key, item_id, request_hash, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (key, item_id, digest, now),
            )
        return await get_item(tx, item_id), True


def _completed_at(current_status: str | None, new_status: str, current: str | None, now: str) -> str | None:
    if new_status == "done":
        return current if current_status == "done" and current else now
    return None


async def update_item(db: Database, item_id: str, changes: dict[str, Any]) -> Item:
    current = await get_item(db, item_id)
    if not changes:
        return current
    for field in ("title", "body_md", "pinned"):
        if field in changes and changes[field] is None:
            field_error(field, f"{field} cannot be null")
    if "title" in changes:
        _limit_text("title", changes["title"], TITLE_MAX)
    if "body_md" in changes:
        _limit_text("body_md", changes["body_md"], BODY_MAX)
    if "transcript_raw" in changes:
        _limit_text("transcript_raw", changes["transcript_raw"], TRANSCRIPT_MAX)
    if "project_id" in changes and changes["project_id"] is not None:
        await require_active_project(db, changes["project_id"])

    sets: dict[str, Any] = {}
    if "title" in changes:
        title = changes["title"]
        if current.type == "task" and not str(title).strip():
            field_error("title", "Tasks require a title")
        sets["title"] = str(title).strip() if current.type == "task" else title
    if "body_md" in changes:
        sets["body_md"] = changes["body_md"]
    if "project_id" in changes:
        sets["project_id"] = changes["project_id"]
    if "external_url" in changes:
        sets["external_url"] = _blank(changes["external_url"])
    if "status" in changes:
        if current.type != "task":
            if changes["status"] is not None:
                field_error("status", "Notes and meetings cannot set status")
        elif changes["status"] is None:
            field_error("status", "status cannot be null")
        else:
            sets["status"] = changes["status"]
            sets["completed_at"] = _completed_at(
                current.status, changes["status"], current.completed_at, utc_now()
            )
    if "priority" in changes:
        if current.type != "task":
            if changes["priority"] is not None:
                field_error("priority", "Notes and meetings cannot set priority")
        elif changes["priority"] is None:
            field_error("priority", "priority cannot be null")
        else:
            sets["priority"] = changes["priority"]
    if "due_on" in changes:
        if current.type != "task":
            if changes["due_on"] is not None:
                field_error("due_on", "Notes and meetings cannot set due_on")
        elif changes["due_on"] is not None and not _valid_day(changes["due_on"]):
            field_error("due_on", "due_on must be YYYY-MM-DD")
        else:
            sets["due_on"] = changes["due_on"]
    if "pinned" in changes:
        if current.type == "task" and changes["pinned"]:
            field_error("pinned", "Tasks cannot be pinned")
        if current.type != "task":
            sets["pinned"] = 1 if changes["pinned"] else 0
    if any(field in changes for field in ("recurrence", "recurrence_weekday", "recurrence_monthday")):
        if current.type != "task":
            field_error("recurrence", "Only tasks can repeat")
        recurrence = changes["recurrence"] if "recurrence" in changes else current.recurrence
        weekday = changes["recurrence_weekday"] if "recurrence_weekday" in changes else current.recurrence_weekday
        monthday = changes["recurrence_monthday"] if "recurrence_monthday" in changes else current.recurrence_monthday
        if recurrence not in (None, "weekly", "monthly"):
            field_error("recurrence", "Repeat is weekly or monthly")
        sets["recurrence"] = recurrence
        sets["recurrence_weekday"] = weekday
        sets["recurrence_monthday"] = monthday
    if "transcript_raw" in changes:
        transcript = _blank(changes["transcript_raw"])
        if current.type != "meeting":
            if transcript is not None:
                field_error("transcript_raw", "Only meetings can include a transcript")
        else:
            sets["transcript_raw"] = transcript
    if not sets:
        return current
    sets["updated_at"] = utc_now()
    assignments = ", ".join(f"{column} = ?" for column in sets)
    await db.execute(
        f"UPDATE items SET {assignments} WHERE id = ?",
        [*sets.values(), item_id],
    )
    updated = await get_item(db, item_id)
    became_done = current.status != "done" and updated.status == "done" and updated.recurrence in ("weekly", "monthly")
    if became_done:
        await _spawn_next(db, updated)
    return updated


def _next_due(item: Item) -> str:
    base_text = item.due_on or datetime.now(UTC).date().isoformat()
    base = datetime.strptime(base_text, "%Y-%m-%d").date()
    if item.recurrence == "weekly":
        weekday = item.recurrence_weekday if item.recurrence_weekday is not None else base.weekday()
        delta = (weekday - base.weekday()) % 7
        if delta == 0:
            delta = 7
        return (base + timedelta(days=delta)).isoformat()
    day = item.recurrence_monthday or base.day
    month = base.month + 1
    year = base.year + (1 if month == 13 else 0)
    month = 1 if month == 13 else month
    last = calendar.monthrange(year, month)[1]
    return datetime(year, month, min(day, last)).date().isoformat()


async def _spawn_next(db: Database, item: Item) -> None:
    due = _next_due(item)
    project_id = None if item.project is None else item.project.id
    existing = await db.fetchone(
        f"""
        SELECT id FROM items
        WHERE type = 'task' AND title = ? AND due_on = ? AND recurrence = ?
          AND deleted_at IS NULL AND status != 'done' AND {_SAME_PROJECT}
        """,
        (item.title, due, item.recurrence, project_id, project_id),
    )
    if existing is not None:
        return
    position = await _next_position(db, project_id, "todo")
    now = utc_now()
    await db.execute(
        """
        INSERT INTO items (
          id, type, title, body_md, project_id, status, priority, due_on, position, pinned,
          recurrence, recurrence_weekday, recurrence_monthday, created_at, updated_at
        ) VALUES (?, 'task', ?, ?, ?, 'todo', ?, ?, ?, 0, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid4()),
            item.title,
            item.body_md,
            project_id,
            item.priority or "none",
            due,
            position,
            item.recurrence,
            item.recurrence_weekday,
            item.recurrence_monthday,
            now,
            now,
        ),
    )


async def delete_item(db: Database, item_id: str) -> None:
    await get_item(db, item_id)
    await db.execute(
        "UPDATE items SET deleted_at = ?, daily_on = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
        (utc_now(), utc_now(), item_id),
    )


async def restore_item(db: Database, item_id: str) -> Item:
    row = await db.fetchone("SELECT deleted_at FROM items WHERE id = ?", (item_id,))
    if row is None:
        raise AppError(404, "Item not found", "not_found")
    if row["deleted_at"] is None:
        return await get_item(db, item_id)
    await db.execute(
        "UPDATE items SET deleted_at = NULL, updated_at = ? WHERE id = ?",
        (utc_now(), item_id),
    )
    return await get_item(db, item_id)


async def purge_item(db: Database, item_id: str) -> None:
    row = await db.fetchone("SELECT deleted_at FROM items WHERE id = ?", (item_id,))
    if row is None:
        raise AppError(404, "Item not found", "not_found")
    if row["deleted_at"] is None:
        raise AppError(409, "Move the item to trash before deleting it", "not_trashed")
    await db.execute("DELETE FROM items WHERE id = ?", (item_id,))


async def purge_expired_trash(db: Database, *, days: int = 30) -> None:
    cutoff = (datetime.now(UTC) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    await db.execute("DELETE FROM items WHERE deleted_at IS NOT NULL AND deleted_at < ?", (cutoff,))


async def daily_note(db: Database, day: str) -> Item:
    if not _valid_day(day):
        field_error("day", "day must be YYYY-MM-DD")
    existing = await db.fetchone(
        "SELECT id FROM items WHERE daily_on = ? AND deleted_at IS NULL",
        (day,),
    )
    if existing is not None:
        return await get_item(db, str(existing["id"]))
    parsed = datetime.strptime(day, "%Y-%m-%d")
    title = f"{parsed.day} {parsed.strftime('%B %Y')}"
    now = utc_now()
    item_id = str(uuid4())
    await db.execute(
        """
        INSERT INTO items (id, type, title, body_md, pinned, daily_on, created_at, updated_at)
        VALUES (?, 'note', ?, '', 0, ?, ?, ?)
        """,
        (item_id, title, day, now, now),
    )
    return await get_item(db, item_id)


async def lookup_title(db: Database, title: str) -> Item:
    cleaned = title.strip()
    if not cleaned:
        field_error("title", "Title is empty")
    row = await db.fetchone(
        f"SELECT {_COLUMNS} {_FROM} WHERE i.deleted_at IS NULL AND i.title = ? ORDER BY i.updated_at DESC LIMIT 1",
        (cleaned,),
    )
    if row is None:
        raise AppError(404, "No note with that title", "not_found")
    return to_item(row)


def _like_literal(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def backlinks(db: Database, item_id: str) -> list[Item]:
    item = await get_item(db, item_id)
    title = item.title.strip()
    if not title:
        return []
    needle = f"%{_like_literal(f'[[{title}]]')}%"
    rows = await db.fetchall(
        f"""
        SELECT {_COLUMNS} {_FROM}
        WHERE i.id != ? AND i.deleted_at IS NULL AND i.body_md LIKE ? ESCAPE '\\'
        ORDER BY i.updated_at DESC
        LIMIT 50
        """,
        (item_id, needle),
    )
    return [to_item(row) for row in rows]


async def set_archived(db: Database, item_id: str, *, archived: bool) -> Item:
    await get_item(db, item_id)
    await db.execute(
        "UPDATE items SET archived_at = ?, updated_at = ? WHERE id = ?",
        (utc_now() if archived else None, utc_now(), item_id),
    )
    return await get_item(db, item_id)


def _task_title_from_body(body: str) -> str:
    for line in body.splitlines():
        cleaned = line.strip()
        if cleaned:
            return cleaned[:120]
    return "Untitled"


async def convert_to_task(db: Database, item_id: str) -> Item:
    async with db.transaction() as tx:
        row = await tx.fetchone("SELECT * FROM items WHERE id = ?", (item_id,))
        if row is None:
            raise AppError(404, "Item not found", "not_found")
        if row["type"] != "note" or row["archived_at"] is not None:
            raise AppError(409, "Only an active note can be converted", "not_a_note")
        title = row["title"] if str(row["title"]).strip() else _task_title_from_body(row["body_md"])
        position = await _next_position(tx, row["project_id"], "todo")
        now = utc_now()
        await tx.execute(
            """
            UPDATE items
            SET type = 'task', title = ?, status = 'todo', priority = 'none',
                position = ?, pinned = 0, completed_at = NULL, updated_at = ?
            WHERE id = ?
            """,
            (title, position, now, item_id),
        )
        return await get_item(tx, item_id)


async def extract_task(db: Database, item_id: str, body: ExtractTask) -> Item:
    _limit_text("title", body.title, TITLE_MAX)
    if body.selection is not None and len(body.selection) > SELECTION_MAX:
        field_error("selection", f"selection exceeds {SELECTION_MAX} characters")
    if not body.title.strip():
        field_error("title", "Tasks require a title")
    async with db.transaction() as tx:
        source = await tx.fetchone("SELECT * FROM items WHERE id = ?", (item_id,))
        if source is None:
            raise AppError(404, "Item not found", "not_found")
        if source["type"] not in ("note", "meeting") or source["archived_at"] is not None:
            raise AppError(409, "Tasks can only be extracted from an active note or meeting", "invalid_source")
        position = await _next_position(tx, source["project_id"], "todo")
        now = utc_now()
        created_id = str(uuid4())
        await tx.execute(
            """
            INSERT INTO items (
              id, type, title, body_md, project_id, status, priority, position,
              pinned, source_item_id, source_selection, created_at, updated_at
            ) VALUES (?, 'task', ?, '', ?, 'todo', 'none', ?, 0, ?, ?, ?, ?)
            """,
            (
                created_id,
                body.title.strip(),
                source["project_id"],
                position,
                item_id,
                body.selection,
                now,
                now,
            ),
        )
        return await get_item(tx, created_id)


async def _neighbor(tx: Transaction, neighbor_id: str, *, field: str, status: str, project_id: str | None, item_id: str) -> Any:
    if neighbor_id == item_id:
        field_error(field, "A card cannot be its own neighbor")
    row = await tx.fetchone("SELECT * FROM items WHERE id = ?", (neighbor_id,))
    if row is None or row["type"] != "task" or row["archived_at"] is not None:
        field_error(field, "Neighbor must be an active task in the destination column")
    if row["status"] != status or (row["project_id"] or None) != project_id:
        field_error(field, "Neighbor must be an active task in the destination column")
    return row


async def _renumber(
    tx: Transaction,
    *,
    item_id: str,
    status: str,
    project_id: str | None,
    before_id: str | None,
    after_id: str | None,
) -> None:
    rows = await tx.fetchall(
        f"""
        SELECT id FROM items
        WHERE type = 'task' AND status = ? AND archived_at IS NULL AND id != ?
          AND {_SAME_PROJECT}
        ORDER BY position ASC, created_at ASC, id ASC
        """,
        (status, item_id, project_id, project_id),
    )
    ids = [row["id"] for row in rows]
    if before_id is not None and before_id in ids:
        ids.insert(ids.index(before_id) + 1, item_id)
    elif after_id is not None and after_id in ids:
        ids.insert(ids.index(after_id), item_id)
    else:
        ids.append(item_id)
    for index, current_id in enumerate(ids, start=1):
        await tx.execute("UPDATE items SET position = ? WHERE id = ?", (float(index * 1024), current_id))


async def move_item(
    db: Database,
    item_id: str,
    *,
    status: ItemStatus,
    before_id: str | None,
    after_id: str | None,
) -> Item:
    async with db.transaction() as tx:
        row = await tx.fetchone("SELECT * FROM items WHERE id = ?", (item_id,))
        if row is None:
            raise AppError(404, "Item not found", "not_found")
        if row["type"] != "task":
            raise AppError(409, "Only tasks can be moved", "not_a_task")
        if row["archived_at"] is not None:
            raise AppError(409, "Archived tasks cannot be moved", "archived")
        project_id = row["project_id"]
        before = None
        after = None
        if before_id is not None:
            before = await _neighbor(
                tx, before_id, field="before_id", status=status, project_id=project_id, item_id=item_id
            )
        if after_id is not None:
            after = await _neighbor(
                tx, after_id, field="after_id", status=status, project_id=project_id, item_id=item_id
            )
        renumbered = False
        position: float | None
        if before is not None and after is not None:
            gap = abs(float(before["position"]) - float(after["position"]))
            if gap < 1e-6:
                await _renumber(
                    tx,
                    item_id=item_id,
                    status=status,
                    project_id=project_id,
                    before_id=before_id,
                    after_id=after_id,
                )
                renumbered = True
                position = None
            else:
                position = (float(before["position"]) + float(after["position"])) / 2
        elif before is not None:
            position = float(before["position"]) + 1024
        elif after is not None:
            position = float(after["position"]) - 1024
        else:
            position = await _next_position_excluding(tx, project_id, status, item_id)
        now = utc_now()
        completed = _completed_at(row["status"], status, row["completed_at"], now)
        if renumbered:
            await tx.execute(
                """
                UPDATE items
                SET status = ?, completed_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (status, completed, now, item_id),
            )
        else:
            await tx.execute(
                """
                UPDATE items
                SET status = ?, position = ?, completed_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (status, position, completed, now, item_id),
            )
        return await get_item(tx, item_id)


async def _next_position_excluding(tx: Transaction, project_id: str | None, status: str, item_id: str) -> float:
    row = await tx.fetchone(
        f"""
        SELECT COALESCE(MAX(position), 0) + 1024 AS pos
        FROM items
        WHERE type = 'task' AND status = ? AND id != ? AND {_SAME_PROJECT}
        """,
        (status, item_id, project_id, project_id),
    )
    assert row is not None
    return float(row["pos"])
