"""Files stored in the database so a SQLite backup keeps them."""

from __future__ import annotations

import re
from uuid import uuid4

from app.db import Database
from app.errors import AppError
from app.schemas.item import AttachmentMeta
from app.services import utc_now
from app.services.items import get_item

MAX_BYTES = 5_000_000
ALLOWED = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/pdf": "pdf",
}
_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def _filename(name: str, content_type: str) -> str:
    cleaned = _NAME.sub("-", name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]).strip(".-")
    if not cleaned:
        cleaned = f"file.{ALLOWED[content_type]}"
    return cleaned[:180]


async def add_attachment(
    db: Database,
    user_id: str,
    item_id: str,
    *,
    filename: str,
    content_type: str,
    data: bytes,
) -> AttachmentMeta:
    await get_item(db, user_id, item_id)
    if content_type not in ALLOWED:
        raise AppError(415, "Attach an image or a PDF", "unsupported_type")
    if len(data) > MAX_BYTES:
        raise AppError(413, "File exceeds 5000000 bytes", "payload_too_large")
    if len(data) == 0:
        raise AppError(400, "The file is empty", "empty_file")
    now = utc_now()
    attachment_id = str(uuid4())
    safe = _filename(filename, content_type)
    await db.execute(
        """
        INSERT INTO attachments (id, item_id, filename, content_type, size, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (attachment_id, item_id, safe, content_type, len(data), data, now),
    )
    return AttachmentMeta(
        id=attachment_id,
        item_id=item_id,
        filename=safe,
        content_type=content_type,
        size=len(data),
        created_at=now,
    )


async def list_attachments(db: Database, user_id: str, item_id: str) -> list[AttachmentMeta]:
    await get_item(db, user_id, item_id)
    rows = await db.fetchall(
        """
        SELECT id, item_id, filename, content_type, size, created_at
        FROM attachments WHERE item_id = ? ORDER BY created_at, id
        """,
        (item_id,),
    )
    return [AttachmentMeta(**dict(row)) for row in rows]


async def read_attachment(
    db: Database, user_id: str, item_id: str, attachment_id: str
) -> tuple[AttachmentMeta, bytes]:
    await get_item(db, user_id, item_id)
    row = await db.fetchone(
        """
        SELECT id, item_id, filename, content_type, size, created_at, data
        FROM attachments WHERE id = ? AND item_id = ?
        """,
        (attachment_id, item_id),
    )
    if row is None:
        raise AppError(404, "Attachment not found", "not_found")
    meta = AttachmentMeta(
        id=row["id"],
        item_id=row["item_id"],
        filename=row["filename"],
        content_type=row["content_type"],
        size=row["size"],
        created_at=row["created_at"],
    )
    return meta, bytes(row["data"])


async def delete_attachment(db: Database, user_id: str, item_id: str, attachment_id: str) -> None:
    await get_item(db, user_id, item_id)
    row = await db.fetchone(
        "SELECT id FROM attachments WHERE id = ? AND item_id = ?",
        (attachment_id, item_id),
    )
    if row is None:
        raise AppError(404, "Attachment not found", "not_found")
    await db.execute("DELETE FROM attachments WHERE id = ?", (attachment_id,))
