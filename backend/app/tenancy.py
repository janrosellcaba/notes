"""Per-user workspace ownership helpers."""

from __future__ import annotations

from uuid import uuid4

from app.db import Database
from app.services import utc_now

DEFAULT_CONTEXTS = (
    ("job1", "Job 1", "#3B82F6", "briefcase", 1),
    ("job2", "Job 2", "#A855F7", "briefcase", 2),
    ("job3", "Job 3", "#F59E0B", "briefcase", 3),
    ("personal", "Personal", "#10B981", "house", 4),
)

DEMO_PROJECT_NAMES = (
    "Website redesign",
    "Q1 planning",
    "Client onboarding",
    "Mobile app",
    "Support backlog",
    "Partner portal",
    "Ops handbook",
    "Hiring pipeline",
    "Home renovations",
    "Travel 2026",
    "Learning Spanish",
)

DEMO_INBOX_TITLES = (
    "Shared from WhatsApp",
    "Parking lot ideas",
    "Random quote to keep",
    "Link to read later",
    "Voice memo summary",
)

SEED_MARKER = "demo_seed_v1"


async def claim_unowned(db: Database, user_id: str) -> None:
    """Give legacy rows without an owner to the first real account (jan)."""
    await db.execute("UPDATE contexts SET user_id = ? WHERE user_id IS NULL", (user_id,))
    await db.execute("UPDATE projects SET user_id = ? WHERE user_id IS NULL", (user_id,))
    await db.execute("UPDATE items SET user_id = ? WHERE user_id IS NULL", (user_id,))


async def ensure_user_contexts(db: Database, user_id: str) -> None:
    existing = await db.fetchone(
        "SELECT COUNT(*) AS n FROM contexts WHERE user_id = ?",
        (user_id,),
    )
    if existing is not None and int(existing["n"]) > 0:
        return
    now = utc_now()
    async with db.transaction() as tx:
        for slug, name, color, icon, order in DEFAULT_CONTEXTS:
            await tx.execute(
                """
                INSERT INTO contexts (id, user_id, slug, name, color, icon, sort_order, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (str(uuid4()), user_id, slug, name, color, icon, order, now, now),
            )


async def purge_legacy_shared_demo(db: Database) -> int:
    """Remove the shared demo seed that polluted every login before tenancy."""
    marker = await db.fetchone("SELECT value FROM app_meta WHERE key = ?", (SEED_MARKER,))
    if marker is None:
        return 0
    placeholders = ", ".join("?" for _ in DEMO_PROJECT_NAMES)
    async with db.transaction() as tx:
        await tx.execute(
            f"""
            DELETE FROM items
            WHERE project_id IN (SELECT id FROM projects WHERE name IN ({placeholders}))
            """,
            DEMO_PROJECT_NAMES,
        )
        await tx.execute(
            f"DELETE FROM projects WHERE name IN ({placeholders})",
            DEMO_PROJECT_NAMES,
        )
        await tx.execute(
            """
            DELETE FROM items
            WHERE daily_on IS NOT NULL
              AND body_md LIKE '%One thing that moved%'
            """
        )
        await tx.execute(
            f"""
            DELETE FROM items
            WHERE project_id IS NULL AND title IN ({', '.join('?' for _ in DEMO_INBOX_TITLES)})
            """,
            DEMO_INBOX_TITLES,
        )
        # Seed meetings/notes used titles like "Standup — 2026-11-15" and "Kickoff notes 12".
        await tx.execute(
            """
            DELETE FROM items
            WHERE type = 'meeting'
              AND title GLOB '* — [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
              AND body_md LIKE '%Ship a thin slice first%'
            """
        )
        await tx.execute(
            """
            DELETE FROM items
            WHERE type = 'note'
              AND daily_on IS NULL
              AND body_md LIKE '%Notes keep getting denser as the week goes on.%'
            """
        )
        await tx.execute(
            """
            DELETE FROM items
            WHERE type = 'task'
              AND body_md LIKE 'Details for %'
              AND title GLOB '* ([0-9]*)'
            """
        )
        await tx.execute("DELETE FROM app_meta WHERE key = ?", (SEED_MARKER,))
    return 1


def user_seed_marker(user_id: str) -> str:
    return f"{SEED_MARKER}:{user_id}"
