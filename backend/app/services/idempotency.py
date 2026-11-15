"""Idempotency keys for item creation."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime, timedelta
from typing import Any

from app.db import Database
from app.errors import AppError

_KEY = re.compile(r"^[A-Za-z0-9_-]{1,80}$")


def validate_key(value: str | None) -> str | None:
    if value is None:
        return None
    if _KEY.fullmatch(value) is None:
        raise AppError(400, "Invalid Idempotency-Key", "bad_idempotency_key")
    return value


def canonical_hash(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def expiry_cutoff() -> str:
    moment = datetime.now(UTC) - timedelta(hours=24)
    return moment.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


async def purge_expired(db: Database) -> None:
    await db.execute("DELETE FROM idempotency_keys WHERE created_at < ?", (expiry_cutoff(),))
