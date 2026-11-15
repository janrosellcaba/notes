"""Schema, pragmas, seed data, and FTS triggers."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from app.db import MIGRATION_PATH, Database, split_sql
from app.main import create_app
from tests.helpers import build_settings

NOW = "2026-11-15T10:48:00.000Z"
SEEDED = (
    ("ctx_job1", "job1", "Job 1", "#3B82F6", 1),
    ("ctx_job2", "job2", "Job 2", "#A855F7", 2),
    ("ctx_job3", "job3", "Job 3", "#F59E0B", 3),
    ("ctx_personal", "personal", "Personal", "#10B981", 4),
)


def test_migration_script_splits_into_executable_statements() -> None:
    statements = split_sql(MIGRATION_PATH.read_text(encoding="utf-8"))
    assert len(statements) == 18
    assert all(statement.endswith(";") for statement in statements)
    joined = "\n".join(statements)
    assert "CREATE TRIGGER items_fts_ai" in joined
    assert "CREATE TRIGGER items_fts_ad" in joined
    assert "CREATE TRIGGER items_fts_au" in joined
    assert joined.count("BEGIN") == 3


@pytest.fixture
async def database(tmp_path: Path):
    db = Database(tmp_path / "nested" / "notes.db", "Europe/Madrid")
    await db.connect()
    try:
        yield db
    finally:
        await db.close()


async def test_fresh_database_enables_wal_and_foreign_keys(database: Database) -> None:
    assert database.path.is_file()
    journal = await database.fetchone("PRAGMA journal_mode")
    foreign_keys = await database.fetchone("PRAGMA foreign_keys")
    assert journal is not None
    assert foreign_keys is not None
    assert str(journal[0]).lower() == "wal"
    assert int(foreign_keys[0]) == 1
    version = await database.fetchone("SELECT value FROM app_meta WHERE key = 'schema_version'")
    assert version is not None
    assert version[0] == "1"


async def test_app_lifespan_creates_the_database_file(tmp_path: Path, admin_password_hash: str) -> None:
    settings = build_settings(tmp_path, admin_password_hash)
    application = create_app(settings)
    async with application.router.lifespan_context(application):
        path = application.state.db.path
        assert path == tmp_path / "notes.db"
        assert path.is_file()
        journal = await application.state.db.fetchone("PRAGMA journal_mode")
        foreign_keys = await application.state.db.fetchone("PRAGMA foreign_keys")
    assert journal is not None and str(journal[0]).lower() == "wal"
    assert foreign_keys is not None and int(foreign_keys[0]) == 1


async def test_seed_contexts(database: Database) -> None:
    rows = await database.fetchall(
        "SELECT id, slug, name, color, sort_order FROM contexts ORDER BY sort_order"
    )
    assert [(row["id"], row["slug"], row["name"], row["color"], row["sort_order"]) for row in rows] == list(
        SEEDED
    )
    timezone = await database.fetchone("SELECT value FROM app_meta WHERE key = 'timezone'")
    session_version = await database.fetchone(
        "SELECT value FROM app_meta WHERE key = 'session_version'"
    )
    assert timezone is not None and timezone[0] == "Europe/Madrid"
    assert session_version is not None and session_version[0] == "1"


async def test_opening_an_existing_database_does_not_reseed(tmp_path: Path) -> None:
    path = tmp_path / "notes.db"
    first = Database(path, "Europe/Madrid")
    await first.connect()
    await first.execute("UPDATE contexts SET name = 'Renamed' WHERE id = 'ctx_job1'")
    await first.close()

    second = Database(path, "Europe/Madrid")
    await second.connect()
    try:
        row = await second.fetchone("SELECT name FROM contexts WHERE id = 'ctx_job1'")
        count = await second.fetchone("SELECT COUNT(*) AS n FROM contexts")
    finally:
        await second.close()
    assert row is not None and row["name"] == "Renamed"
    assert count is not None and int(count["n"]) == 4


async def test_timezone_overwrites_only_the_default(tmp_path: Path) -> None:
    path = tmp_path / "notes.db"
    fresh = Database(path, "America/New_York")
    await fresh.connect()
    try:
        row = await fresh.fetchone("SELECT value FROM app_meta WHERE key = 'timezone'")
    finally:
        await fresh.close()
    assert row is not None and row[0] == "America/New_York"

    edited = Database(path, "Europe/Madrid")
    await edited.connect()
    await edited.execute(
        "UPDATE app_meta SET value = ? WHERE key = 'timezone'",
        ("America/Chicago",),
    )
    await edited.close()

    again = Database(path, "Pacific/Auckland")
    await again.connect()
    try:
        kept = await again.fetchone("SELECT value FROM app_meta WHERE key = 'timezone'")
    finally:
        await again.close()
    assert kept is not None and kept[0] == "America/Chicago"


async def test_foreign_keys_reject_an_unknown_context(database: Database) -> None:
    with pytest.raises(sqlite3.IntegrityError):
        await database.execute(
            """
            INSERT INTO projects (id, context_id, name, created_at, updated_at)
            VALUES ('proj-1', 'missing', 'Atlas', ?, ?)
            """,
            (NOW, NOW),
        )


async def test_inserting_a_note_creates_an_fts_row(database: Database) -> None:
    await database.execute(
        """
        INSERT INTO items (id, type, title, body_md, created_at, updated_at)
        VALUES ('note-1', 'note', 'Hello', 'body text', ?, ?)
        """,
        (NOW, NOW),
    )
    item = await database.fetchone("SELECT rowid FROM items WHERE id = 'note-1'")
    indexed = await database.fetchone("SELECT rowid FROM fts_search")
    matched = await database.fetchone(
        "SELECT rowid FROM fts_search WHERE fts_search MATCH 'hello'"
    )
    assert item is not None
    assert indexed is not None
    assert matched is not None
    assert indexed["rowid"] == item["rowid"]
    assert matched["rowid"] == item["rowid"]


async def test_task_without_status_and_note_with_status_fail_check(database: Database) -> None:
    with pytest.raises(sqlite3.IntegrityError) as task_error:
        await database.execute(
            """
            INSERT INTO items (
              id, type, title, body_md, status, priority, pinned, created_at, updated_at
            ) VALUES ('task-1', 'task', 'Task', '', NULL, 'none', 0, ?, ?)
            """,
            (NOW, NOW),
        )
    with pytest.raises(sqlite3.IntegrityError) as note_error:
        await database.execute(
            """
            INSERT INTO items (id, type, title, status, created_at, updated_at)
            VALUES ('note-bad', 'note', 'Note', 'todo', ?, ?)
            """,
            (NOW, NOW),
        )
    assert "CHECK" in str(task_error.value).upper()
    assert "CHECK" in str(note_error.value).upper()
