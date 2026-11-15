"""Context reads, creation, and renames."""

from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from app.db import Database, Transaction
from app.errors import AppError, field_error
from app.schemas.context import Context
from app.services import utc_now

ICONS = frozenset({
    "briefcase",
    "building-2",
    "house",
    "user",
    "heart",
    "star",
    "bookmark",
    "folder",
    "code",
    "palette",
    "graduation-cap",
    "plane",
    "shopping-bag",
    "dumbbell",
    "music",
    "camera",
    "coffee",
    "globe",
    "zap",
    "flag",
    "calendar",
    "pen-line",
    "lightbulb",
    "rocket",
    "leaf",
    "layers",
})
PALETTE = ("#3B82F6", "#A855F7", "#F59E0B", "#10B981", "#EF4444", "#06B6D4", "#F43F5E", "#84CC16")
_SLUG = re.compile(r"[^a-z0-9]+")

Reader = Database | Transaction


def to_context(row: Any) -> Context:
    return Context(
        id=row["id"],
        slug=row["slug"],
        name=row["name"],
        color=row["color"],
        icon=row["icon"],
        sort_order=row["sort_order"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


async def list_contexts(db: Database) -> list[Context]:
    rows = await db.fetchall("SELECT * FROM contexts ORDER BY sort_order")
    return [to_context(row) for row in rows]


async def require_context(db: Reader, context_id: str) -> Context:
    row = await db.fetchone("SELECT * FROM contexts WHERE id = ?", (context_id,))
    if row is None:
        raise AppError(404, "Context not found", "not_found")
    return to_context(row)


async def update_context(db: Database, context_id: str, changes: dict[str, Any]) -> Context:
    current = await require_context(db, context_id)
    if not changes:
        return current
    if "name" in changes and changes["name"] is None:
        field_error("name", "name cannot be null")
    if "color" in changes and changes["color"] is None:
        field_error("color", "color cannot be null")
    if "sort_order" in changes and changes["sort_order"] is None:
        field_error("sort_order", "sort_order cannot be null")
    async with db.transaction() as tx:
        if "sort_order" in changes:
            taken = await tx.fetchone(
                "SELECT id FROM contexts WHERE sort_order = ? AND id != ?",
                (changes["sort_order"], context_id),
            )
            if taken is not None:
                field_error("sort_order", "sort_order is already in use")
        assignments = ["updated_at = ?"]
        params: list[Any] = [utc_now()]
        if "icon" in changes:
            icon = changes["icon"]
            if icon is not None and icon not in ICONS:
                field_error("icon", "Choose an icon from the list")
        for column in ("name", "color", "icon", "sort_order"):
            if column in changes:
                value = changes[column].strip() if column == "name" else changes[column]
                assignments.append(f"{column} = ?")
                params.append(value)
        params.append(context_id)
        await tx.execute(
            f"UPDATE contexts SET {', '.join(assignments)} WHERE id = ?",
            params,
        )
        row = await tx.fetchone("SELECT * FROM contexts WHERE id = ?", (context_id,))
    if row is None:
        raise AppError(404, "Context not found", "not_found")
    return to_context(row)


def _slug(name: str, taken: set[str]) -> str:
    base = _SLUG.sub("-", name.strip().lower()).strip("-")[:40] or "context"
    slug = base
    number = 2
    while slug in taken:
        suffix = f"-{number}"
        slug = f"{base[: 40 - len(suffix)]}{suffix}"
        number += 1
    return slug


async def create_context(db: Database, *, name: str, color: str | None, icon: str | None) -> Context:
    cleaned = name.strip()
    if not cleaned:
        field_error("name", "name must be 1–80 characters")
    chosen_icon = icon or "briefcase"
    if chosen_icon not in ICONS:
        field_error("icon", "Choose an icon from the list")
    now = utc_now()
    async with db.transaction() as tx:
        rows = await tx.fetchall("SELECT slug, sort_order FROM contexts")
        taken = {str(row["slug"]) for row in rows}
        order = max((int(row["sort_order"]) for row in rows), default=0) + 1
        chosen_color = (color or PALETTE[(order - 1) % len(PALETTE)]).upper()
        context_id = str(uuid4())
        await tx.execute(
            """
            INSERT INTO contexts (id, slug, name, color, icon, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (context_id, _slug(cleaned, taken), cleaned, chosen_color, chosen_icon, order, now, now),
        )
        row = await tx.fetchone("SELECT * FROM contexts WHERE id = ?", (context_id,))
    if row is None:
        raise AppError(500, "Context was not created", "internal_error")
    return to_context(row)


async def delete_context(db: Database, context_id: str) -> None:
    await require_context(db, context_id)
    count = await db.fetchone("SELECT COUNT(*) AS n FROM contexts")
    if count is not None and int(count["n"]) <= 1:
        raise AppError(409, "Keep at least one context", "last_context")
    projects = await db.fetchone(
        "SELECT COUNT(*) AS n FROM projects WHERE context_id = ?",
        (context_id,),
    )
    if projects is not None and int(projects["n"]) > 0:
        raise AppError(409, "Move or delete its projects first", "context_in_use")
    await db.execute("UPDATE items SET context_id = NULL WHERE context_id = ?", (context_id,))
    await db.execute("DELETE FROM contexts WHERE id = ?", (context_id,))


async def move_context(db: Database, context_id: str, *, direction: int) -> Context:
    if direction not in (-1, 1):
        field_error("direction", "direction must be up or down")
    async with db.transaction() as tx:
        rows = await tx.fetchall("SELECT id, sort_order FROM contexts ORDER BY sort_order")
        index = next((i for i, row in enumerate(rows) if row["id"] == context_id), None)
        if index is None:
            raise AppError(404, "Context not found", "not_found")
        neighbor = index + direction
        if neighbor < 0 or neighbor >= len(rows):
            row = await tx.fetchone("SELECT * FROM contexts WHERE id = ?", (context_id,))
            if row is None:
                raise AppError(404, "Context not found", "not_found")
            return to_context(row)
        current = rows[index]
        other = rows[neighbor]
        await tx.execute("UPDATE contexts SET sort_order = ? WHERE id = ?", (-1, current["id"]))
        await tx.execute(
            "UPDATE contexts SET sort_order = ?, updated_at = ? WHERE id = ?",
            (current["sort_order"], utc_now(), other["id"]),
        )
        await tx.execute(
            "UPDATE contexts SET sort_order = ?, updated_at = ? WHERE id = ?",
            (other["sort_order"], utc_now(), current["id"]),
        )
        row = await tx.fetchone("SELECT * FROM contexts WHERE id = ?", (context_id,))
    if row is None:
        raise AppError(404, "Context not found", "not_found")
    return to_context(row)
