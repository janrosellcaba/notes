"""Project CRUD."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from app.db import Database, Transaction
from app.errors import AppError, field_error
from app.schemas.project import ContextRef, Project, ProjectStatus
from app.services import utc_now
from app.services.contexts import require_context

Reader = Database | Transaction


def to_project(row: Any) -> Project:
    override = row["color"]
    keys = row.keys()
    due_on = row["due_on"] if "due_on" in keys else None
    raw_status = row["status"] if "status" in keys and row["status"] else None
    if raw_status in ("active", "done", "cancelled"):
        status: ProjectStatus = raw_status
    elif row["archived_at"] is not None:
        status = "done"
    else:
        status = "active"
    return Project(
        id=row["id"],
        name=row["name"],
        color=override or row["context_color"],
        color_override=override,
        context=ContextRef(
            id=row["context_id"],
            slug=row["context_slug"],
            name=row["context_name"],
            color=row["context_color"],
            icon=row["context_icon"],
        ),
        due_on=due_on,
        status=status,
        archived_at=row["archived_at"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


_SELECT = """
SELECT p.id, p.name, p.color, p.due_on, p.status, p.archived_at, p.created_at, p.updated_at,
       c.id AS context_id, c.slug AS context_slug, c.name AS context_name,
       c.color AS context_color, c.icon AS context_icon
FROM projects p
JOIN contexts c ON c.id = p.context_id
"""


async def list_projects(
    db: Database,
    user_id: str,
    *,
    context_id: str | None,
    include_archived: bool,
) -> list[Project]:
    if context_id is not None:
        await require_context(db, user_id, context_id)
    clauses = ["p.user_id = ?", "c.user_id = ?"]
    params: list[Any] = [user_id, user_id]
    if not include_archived:
        clauses.append("(p.status = 'active' OR (p.status IS NULL AND p.archived_at IS NULL))")
    if context_id is not None:
        clauses.append("p.context_id = ?")
        params.append(context_id)
    where = f"WHERE {' AND '.join(clauses)}"
    rows = await db.fetchall(
        f"{_SELECT} {where} ORDER BY c.sort_order, p.name COLLATE NOCASE",
        params,
    )
    return [to_project(row) for row in rows]


async def get_project(db: Reader, user_id: str, project_id: str) -> Project:
    row = await db.fetchone(
        f"{_SELECT} WHERE p.id = ? AND p.user_id = ? AND c.user_id = ?",
        (project_id, user_id, user_id),
    )
    if row is None:
        raise AppError(404, "Project not found", "not_found")
    return to_project(row)


async def require_active_project(db: Reader, user_id: str, project_id: str) -> Project:
    project = await get_project(db, user_id, project_id)
    if project.status != "active":
        raise AppError(404, "Project is closed", "not_found")
    return project


async def create_project(
    db: Database,
    user_id: str,
    *,
    name: str,
    context_id: str,
    color: str | None,
    due_on: str | None = None,
) -> Project:
    cleaned = name.strip()
    if not 1 <= len(cleaned) <= 200:
        field_error("name", "name must be 1–200 characters")
    await require_context(db, user_id, context_id)
    now = utc_now()
    project_id = str(uuid4())
    await db.execute(
        """
        INSERT INTO projects (id, user_id, context_id, name, color, due_on, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
        """,
        (project_id, user_id, context_id, cleaned, color, due_on, now, now),
    )
    return await get_project(db, user_id, project_id)


async def update_project(db: Database, user_id: str, project_id: str, changes: dict[str, Any]) -> Project:
    await get_project(db, user_id, project_id)
    if not changes:
        return await get_project(db, user_id, project_id)
    if "name" in changes and changes["name"] is None:
        field_error("name", "name cannot be null")
    if "context_id" in changes and changes["context_id"] is None:
        field_error("context_id", "context_id cannot be null")
    if "context_id" in changes:
        await require_context(db, user_id, changes["context_id"])
    if "status" in changes:
        return await set_status(db, user_id, project_id, changes["status"], extra=changes)
    assignments = ["updated_at = ?"]
    params: list[Any] = [utc_now()]
    if "name" in changes:
        assignments.append("name = ?")
        params.append(changes["name"].strip())
    if "context_id" in changes:
        assignments.append("context_id = ?")
        params.append(changes["context_id"])
    if "color" in changes:
        assignments.append("color = ?")
        params.append(changes["color"])
    if "due_on" in changes:
        assignments.append("due_on = ?")
        params.append(changes["due_on"])
    params.extend((project_id, user_id))
    await db.execute(
        f"UPDATE projects SET {', '.join(assignments)} WHERE id = ? AND user_id = ?",
        params,
    )
    return await get_project(db, user_id, project_id)


async def set_status(
    db: Database,
    user_id: str,
    project_id: str,
    status: ProjectStatus,
    *,
    extra: dict[str, Any] | None = None,
) -> Project:
    await get_project(db, user_id, project_id)
    now = utc_now()
    assignments = ["status = ?", "archived_at = ?", "updated_at = ?"]
    params: list[Any] = [status, None if status == "active" else now, now]
    changes = extra or {}
    if "name" in changes and changes["name"] is not None:
        assignments.append("name = ?")
        params.append(changes["name"].strip())
    if "context_id" in changes and changes["context_id"] is not None:
        assignments.append("context_id = ?")
        params.append(changes["context_id"])
    if "color" in changes:
        assignments.append("color = ?")
        params.append(changes["color"])
    if "due_on" in changes:
        assignments.append("due_on = ?")
        params.append(changes["due_on"])
    params.extend((project_id, user_id))
    await db.execute(
        f"UPDATE projects SET {', '.join(assignments)} WHERE id = ? AND user_id = ?",
        params,
    )
    return await get_project(db, user_id, project_id)


async def set_archived(db: Database, user_id: str, project_id: str, *, archived: bool) -> Project:
    return await set_status(db, user_id, project_id, "done" if archived else "active")


async def delete_project(db: Database, user_id: str, project_id: str) -> None:
    await get_project(db, user_id, project_id)
    await db.execute("DELETE FROM projects WHERE id = ? AND user_id = ?", (project_id, user_id))
