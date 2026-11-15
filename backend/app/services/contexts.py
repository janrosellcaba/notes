"""Context reads and renames."""

from __future__ import annotations

from typing import Any

from app.db import Database, Transaction
from app.errors import AppError, field_error
from app.schemas.context import Context
from app.services import utc_now

Reader = Database | Transaction


def to_context(row: Any) -> Context:
    return Context(
        id=row["id"],
        slug=row["slug"],
        name=row["name"],
        color=row["color"],
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
        for column in ("name", "color", "sort_order"):
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
