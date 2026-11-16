"""SQLite connection, pragmas, and the one-shot schema migration."""

from __future__ import annotations

import asyncio
import re
import sqlite3
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import aiosqlite

from app.config import DEFAULT_TIMEZONE

MIGRATION_PATH = Path(__file__).parent / "migrations" / "001_init.sql"
SCHEMA_VERSION = "1"

_BEGIN_END = re.compile(r"\b(BEGIN|END)\b", re.IGNORECASE)


def split_sql(script: str) -> list[str]:
    """Split a script on semicolons that are outside trigger bodies."""
    lines: list[str] = []
    for line in script.splitlines():
        code, _sep, _comment = line.partition("--")
        lines.append(code)
    text = "\n".join(lines)
    statements: list[str] = []
    current: list[str] = []
    depth = 0
    for chunk in re.split(r"(;)", text):
        if chunk == ";":
            current.append(chunk)
            if depth == 0:
                statement = "".join(current).strip()
                if statement.strip(";").strip():
                    statements.append(statement)
                current = []
            continue
        current.append(chunk)
        for word in _BEGIN_END.findall(chunk):
            if word.upper() == "BEGIN":
                depth += 1
            else:
                depth = max(0, depth - 1)
    tail = "".join(current).strip()
    if tail:
        statements.append(tail)
    return statements


class Database:
    """One long-lived SQLite connection. Callers share an asyncio lock."""

    def __init__(self, path: Path, user_timezone: str) -> None:
        self.path = path
        self.user_timezone = user_timezone
        self._conn: aiosqlite.Connection | None = None
        self._lock = asyncio.Lock()

    async def connect(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = await aiosqlite.connect(self.path, isolation_level=None)
        self._conn.row_factory = aiosqlite.Row
        try:
            await self._apply_pragmas()
            await self._migrate()
            await self._ensure_users()
            await self._ensure_features()
            await self._rebuild_fts()
            await self._apply_timezone()
        except Exception:
            await self.close()
            raise

    async def close(self) -> None:
        if self._conn is not None:
            await self._conn.close()
            self._conn = None

    async def execute(self, sql: str, parameters: Sequence[Any] = ()) -> None:
        async with self._lock:
            conn = self._connection()
            await conn.execute("BEGIN IMMEDIATE")
            try:
                await conn.execute(sql, parameters)
                await conn.commit()
            except Exception:
                await conn.rollback()
                raise

    async def fetchone(self, sql: str, parameters: Sequence[Any] = ()) -> aiosqlite.Row | None:
        async with self._lock:
            cursor = await self._connection().execute(sql, parameters)
            row = await cursor.fetchone()
            await cursor.close()
            return row

    async def fetchall(self, sql: str, parameters: Sequence[Any] = ()) -> list[aiosqlite.Row]:
        async with self._lock:
            cursor = await self._connection().execute(sql, parameters)
            rows = await cursor.fetchall()
            await cursor.close()
            return list(rows)

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator["Transaction"]:
        async with self._lock:
            conn = self._connection()
            await conn.execute("BEGIN IMMEDIATE")
            try:
                yield Transaction(conn)
                await conn.commit()
            except Exception:
                await conn.rollback()
                raise

    async def backup_to(self, destination: Path) -> None:
        """Copy a consistent snapshot with the SQLite online backup API."""
        destination.parent.mkdir(parents=True, exist_ok=True)
        target = sqlite3.connect(destination, check_same_thread=False)
        try:
            async with self._lock:
                await self._connection().backup(target)
        finally:
            target.close()

    async def rebuild_fts(self) -> None:
        await self.execute("INSERT INTO fts_search(fts_search) VALUES('rebuild')")

    def _connection(self) -> aiosqlite.Connection:
        if self._conn is None:
            raise RuntimeError("Database is not connected")
        return self._conn

    async def _apply_pragmas(self) -> None:
        conn = self._connection()
        cursor = await conn.execute("PRAGMA journal_mode=WAL")
        journal_row = await cursor.fetchone()
        await cursor.close()
        await conn.execute("PRAGMA foreign_keys=ON")
        await conn.execute("PRAGMA synchronous=NORMAL")
        await conn.execute("PRAGMA busy_timeout=5000")
        await conn.execute("PRAGMA temp_store=MEMORY")
        await conn.execute("PRAGMA cache_size=-20000")
        cursor = await conn.execute("PRAGMA foreign_keys")
        fk_row = await cursor.fetchone()
        await cursor.close()
        journal = str(journal_row[0]).lower() if journal_row is not None else ""
        foreign_keys = int(fk_row[0]) if fk_row is not None else 0
        if journal != "wal" or foreign_keys != 1:
            raise RuntimeError(
                f"SQLite pragma check failed: journal_mode={journal!r} foreign_keys={foreign_keys}"
            )

    async def _migrate(self) -> None:
        conn = self._connection()
        cursor = await conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_meta'"
        )
        existing = await cursor.fetchone()
        await cursor.close()
        if existing is not None:
            cursor = await conn.execute("SELECT value FROM app_meta WHERE key = 'schema_version'")
            row = await cursor.fetchone()
            await cursor.close()
            version = None if row is None else str(row[0])
            if version != SCHEMA_VERSION:
                raise RuntimeError(f"Unsupported schema_version: {version}")
            return

        statements = split_sql(MIGRATION_PATH.read_text(encoding="utf-8"))
        await conn.execute("BEGIN IMMEDIATE")
        try:
            for statement in statements:
                await conn.execute(statement)
            await conn.commit()
        except Exception:
            await conn.rollback()
            raise

    async def _rebuild_fts(self) -> None:
        conn = self._connection()
        await conn.execute("BEGIN IMMEDIATE")
        try:
            await conn.execute("INSERT INTO fts_search(fts_search) VALUES('rebuild')")
            await conn.commit()
        except Exception:
            await conn.rollback()
            raise

    async def _ensure_users(self) -> None:
        """Accounts live beside the v1 schema so an existing database can gain them."""
        conn = self._connection()
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              username TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              session_version INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL
            )
            """
        )
        await conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users(lower(username))"
        )

    async def _ensure_features(self) -> None:
        """Columns and the attachment table for trash, recurrence, and files."""
        conn = self._connection()
        cursor = await conn.execute("PRAGMA table_info(items)")
        rows = await cursor.fetchall()
        await cursor.close()
        present = {str(row[1]) for row in rows}
        additions = {
            "deleted_at": "TEXT",
            "daily_on": "TEXT",
            "recurrence": "TEXT",
            "recurrence_weekday": "INTEGER",
            "recurrence_monthday": "INTEGER",
            "context_id": "TEXT",
            "parent_id": "TEXT",
            "starts_on": "TEXT",
            "assignee": "TEXT",
        }
        for name, kind in additions.items():
            if name not in present:
                await conn.execute(f"ALTER TABLE items ADD COLUMN {name} {kind}")
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS attachments (
              id TEXT PRIMARY KEY,
              item_id TEXT NOT NULL REFERENCES items(id) ON UPDATE CASCADE ON DELETE CASCADE,
              filename TEXT NOT NULL,
              content_type TEXT NOT NULL,
              size INTEGER NOT NULL,
              data BLOB NOT NULL,
              created_at TEXT NOT NULL,
              CHECK (size > 0)
            )
            """
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS attachments_item ON attachments(item_id)"
        )
        await conn.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS items_daily_on
            ON items(daily_on)
            WHERE daily_on IS NOT NULL AND deleted_at IS NULL
            """
        )
        await conn.execute(
            """
            CREATE INDEX IF NOT EXISTS items_parent
            ON items(parent_id)
            WHERE parent_id IS NOT NULL AND deleted_at IS NULL
            """
        )
        # Daily notes were removed — purge any leftover rows on startup.
        await conn.execute(
            "DELETE FROM attachments WHERE item_id IN (SELECT id FROM items WHERE daily_on IS NOT NULL)"
        )
        await conn.execute(
            "DELETE FROM idempotency_keys WHERE item_id IN (SELECT id FROM items WHERE daily_on IS NOT NULL)"
        )
        await conn.execute("DELETE FROM items WHERE daily_on IS NOT NULL")
        cursor = await conn.execute("PRAGMA table_info(contexts)")
        context_rows = await cursor.fetchall()
        await cursor.close()
        if "icon" not in {str(row[1]) for row in context_rows}:
            await conn.execute("ALTER TABLE contexts ADD COLUMN icon TEXT")
        await conn.execute(
            "UPDATE contexts SET icon = 'briefcase' WHERE icon IS NULL AND slug LIKE 'job%'"
        )
        await conn.execute(
            "UPDATE contexts SET icon = 'house' WHERE icon IS NULL AND slug = 'personal'"
        )
        await self._ensure_tenancy()

    async def _ensure_tenancy(self) -> None:
        """Isolate contexts, projects, and items by user_id."""
        conn = self._connection()
        cursor = await conn.execute("PRAGMA table_info(projects)")
        project_cols = {str(row[1]) for row in await cursor.fetchall()}
        await cursor.close()
        if "user_id" not in project_cols:
            await conn.execute("ALTER TABLE projects ADD COLUMN user_id TEXT")
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS projects_user ON projects(user_id) WHERE user_id IS NOT NULL"
        )

        cursor = await conn.execute("PRAGMA table_info(items)")
        item_cols = {str(row[1]) for row in await cursor.fetchall()}
        await cursor.close()
        if "user_id" not in item_cols:
            await conn.execute("ALTER TABLE items ADD COLUMN user_id TEXT")
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS items_user ON items(user_id) WHERE user_id IS NOT NULL"
        )
        await conn.execute("DROP INDEX IF EXISTS items_daily_on")
        await conn.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS items_daily_on
            ON items(user_id, daily_on)
            WHERE daily_on IS NOT NULL AND deleted_at IS NULL AND user_id IS NOT NULL
            """
        )

        cursor = await conn.execute("PRAGMA table_info(contexts)")
        context_cols = {str(row[1]) for row in await cursor.fetchall()}
        await cursor.close()
        if "user_id" not in context_cols:
            await conn.execute("PRAGMA foreign_keys=OFF")
            await conn.execute("BEGIN IMMEDIATE")
            try:
                await conn.execute(
                    """
                    CREATE TABLE contexts_new (
                      id TEXT PRIMARY KEY,
                      user_id TEXT,
                      slug TEXT NOT NULL,
                      name TEXT NOT NULL,
                      color TEXT NOT NULL,
                      icon TEXT,
                      sort_order INTEGER NOT NULL,
                      created_at TEXT NOT NULL,
                      updated_at TEXT NOT NULL,
                      CHECK (length(trim(name)) > 0),
                      CHECK (color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
                      UNIQUE (user_id, slug),
                      UNIQUE (user_id, sort_order)
                    )
                    """
                )
                await conn.execute(
                    """
                    INSERT INTO contexts_new (id, user_id, slug, name, color, icon, sort_order, created_at, updated_at)
                    SELECT id, NULL, slug, name, color, icon, sort_order, created_at, updated_at FROM contexts
                    """
                )
                await conn.execute("DROP TABLE contexts")
                await conn.execute("ALTER TABLE contexts_new RENAME TO contexts")
                await conn.commit()
            except Exception:
                await conn.rollback()
                raise
            finally:
                await conn.execute("PRAGMA foreign_keys=ON")

    async def _apply_timezone(self) -> None:
        if not self.user_timezone or self.user_timezone == DEFAULT_TIMEZONE:
            return
        conn = self._connection()
        cursor = await conn.execute("SELECT value FROM app_meta WHERE key = 'timezone'")
        row = await cursor.fetchone()
        await cursor.close()
        if row is None or str(row[0]) != DEFAULT_TIMEZONE:
            return
        await conn.execute("BEGIN IMMEDIATE")
        try:
            await conn.execute(
                "UPDATE app_meta SET value = ? WHERE key = 'timezone'",
                (self.user_timezone,),
            )
            await conn.commit()
        except Exception:
            await conn.rollback()
            raise


class Transaction:
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def execute(self, sql: str, parameters: Sequence[Any] = ()) -> None:
        cursor = await self._conn.execute(sql, parameters)
        await cursor.close()

    async def fetchone(self, sql: str, parameters: Sequence[Any] = ()) -> aiosqlite.Row | None:
        cursor = await self._conn.execute(sql, parameters)
        row = await cursor.fetchone()
        await cursor.close()
        return row

    async def fetchall(self, sql: str, parameters: Sequence[Any] = ()) -> list[aiosqlite.Row]:
        cursor = await self._conn.execute(sql, parameters)
        rows = await cursor.fetchall()
        await cursor.close()
        return list(rows)
