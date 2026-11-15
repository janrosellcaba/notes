"""JSON archive and a consistent SQLite snapshot."""

from __future__ import annotations

import base64
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.db import Database, SCHEMA_VERSION
from app.services import utc_now


def _stamp() -> str:
    return datetime.now(UTC).strftime("%Y%m%d")


def _pinned(value: Any) -> bool:
    return bool(value)


async def export_json(db: Database) -> tuple[dict[str, Any], str]:
    timezone = await db.fetchone("SELECT value FROM app_meta WHERE key = 'timezone'")
    contexts = await db.fetchall(
        """
        SELECT id, slug, name, color, icon, sort_order, created_at, updated_at
        FROM contexts ORDER BY sort_order
        """
    )
    projects = await db.fetchall(
        """
        SELECT id, context_id, name, color AS color_override, archived_at, created_at, updated_at
        FROM projects ORDER BY created_at, id
        """
    )
    items = await db.fetchall(
        """
        SELECT id, type, title, body_md, project_id, status, priority, due_on, completed_at,
               position, pinned, transcript_raw, ai_summary, ai_action_items, calendar_event_id,
               calendar_provider, external_url, source_item_id, source_selection, archived_at,
               deleted_at, daily_on, recurrence, recurrence_weekday, recurrence_monthday,
               created_at, updated_at
        FROM items ORDER BY created_at, id
        """
    )
    attachments = await db.fetchall(
        """
        SELECT id, item_id, filename, content_type, size, created_at, data
        FROM attachments ORDER BY created_at, id
        """
    )
    payload = {
        "exported_at": utc_now(),
        "schema_version": int(SCHEMA_VERSION),
        "timezone": None if timezone is None else timezone["value"],
        "contexts": [dict(row) for row in contexts],
        "projects": [dict(row) for row in projects],
        "items": [
            {**dict(row), "pinned": _pinned(row["pinned"]), "position": None if row["position"] is None else float(row["position"])}
            for row in items
        ],
        "attachments": [
            {
                "id": row["id"],
                "item_id": row["item_id"],
                "filename": row["filename"],
                "content_type": row["content_type"],
                "size": row["size"],
                "created_at": row["created_at"],
                "data_base64": base64.b64encode(row["data"]).decode("ascii"),
            }
            for row in attachments
        ],
    }
    return payload, f"notes-{_stamp()}.json"


async def export_sqlite(db: Database) -> tuple[bytes, str]:
    handle = tempfile.NamedTemporaryFile(prefix="notes-", suffix=".db", delete=False)
    handle.close()
    path = Path(handle.name)
    try:
        await db.backup_to(path)
        return path.read_bytes(), f"notes-{_stamp()}.db"
    finally:
        path.unlink(missing_ok=True)
