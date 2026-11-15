"""Fill a workspace with demo content and ensure a test login exists.

Run inside the app environment:

    python -m app.demo_seed
"""

from __future__ import annotations

import asyncio
import random
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.config import Settings
from app.db import Database
from app.security import hash_password
from app.services import utc_now

SEED_KEY = "demo_seed_v1"
TEST_USERNAME = "test"
TEST_PASSWORD = "test"

PROJECTS = [
    ("ctx_job1", "Website redesign", "#3B82F6"),
    ("ctx_job1", "Q1 planning", "#6366F1"),
    ("ctx_job1", "Client onboarding", "#0EA5E9"),
    ("ctx_job2", "Mobile app", "#8B5CF6"),
    ("ctx_job2", "Support backlog", "#A855F7"),
    ("ctx_job2", "Partner portal", "#7C3AED"),
    ("ctx_job3", "Ops handbook", "#F59E0B"),
    ("ctx_job3", "Hiring pipeline", "#D97706"),
    ("ctx_personal", "Home renovations", "#10B981"),
    ("ctx_personal", "Travel 2026", "#14B8A6"),
    ("ctx_personal", "Learning Spanish", "#059669"),
]

NOTE_TITLES = [
    "Kickoff notes",
    "Research dump",
    "Ideas for next week",
    "Call prep",
    "Design constraints",
    "Risks and open questions",
    "Competitive scan",
    "Draft outline",
    "Follow-ups",
    "Reference links",
    "Decision log",
    "Snippets to reuse",
    "Interview notes",
    "Budget scratchpad",
    "Reading list",
]

TASK_TITLES = [
    "Send the weekly update",
    "Review the pull request",
    "Book the room",
    "Draft the agenda",
    "Clean the backlog",
    "Chase the invoice",
    "Prepare the deck",
    "Fix the login bug",
    "Write the brief",
    "Schedule the demo",
    "Update the roadmap",
    "Reply to the client",
    "Polish the homepage copy",
    "Check the analytics",
    "Record a Loom",
    "Sync with design",
    "Confirm the launch date",
    "Tidy the shared folder",
    "Add acceptance criteria",
    "Ship the hotfix",
]

MEETING_TITLES = [
    "Standup",
    "Sprint review",
    "Client sync",
    "Design critique",
    "Hiring interview",
    "Budget check-in",
    "Ops retrospective",
    "Partner intro",
    "Launch go/no-go",
    "1:1",
    "Roadmap workshop",
    "Support triage",
]

STATUSES = ["backlog", "todo", "in_progress", "blocked", "done"]
PRIORITIES = ["none", "low", "medium", "high", "urgent"]


def _iso(day: datetime) -> str:
    return day.strftime("%Y-%m-%d")


def _stamp(day: datetime, hour: int = 9) -> str:
    return day.replace(hour=hour, minute=0, second=0, microsecond=0, tzinfo=UTC).strftime(
        "%Y-%m-%dT%H:%M:%S.000Z"
    )


async def ensure_test_user(db: Database) -> None:
    existing = await db.fetchone("SELECT id FROM users WHERE lower(username) = lower(?)", (TEST_USERNAME,))
    if existing is not None:
        password_hash = hash_password(TEST_PASSWORD)
        await db.execute(
            "UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?",
            (password_hash, existing["id"]),
        )
        return
    await db.execute(
        """
        INSERT INTO users (id, username, password_hash, session_version, created_at)
        VALUES (?, ?, ?, 1, ?)
        """,
        (str(uuid4()), TEST_USERNAME, hash_password(TEST_PASSWORD), utc_now()),
    )


async def seed_workspace(db: Database, *, force: bool = False) -> None:
    marker = await db.fetchone("SELECT value FROM app_meta WHERE key = ?", (SEED_KEY,))
    if marker is not None and not force:
        print("Demo seed already present; skipping content.")
        return

    contexts = await db.fetchall("SELECT id FROM contexts ORDER BY sort_order")
    context_ids = [str(row["id"]) for row in contexts]
    if not context_ids:
        raise SystemExit("No contexts found; cannot seed")

    today = datetime.now(UTC).replace(hour=12, minute=0, second=0, microsecond=0)
    rng = random.Random(20261115)
    project_ids: list[tuple[str, str]] = []

    async with db.transaction() as tx:
        for context_id, name, color in PROJECTS:
            if context_id not in context_ids:
                context_id = context_ids[0]
            project_id = str(uuid4())
            created = _stamp(today - timedelta(days=rng.randint(20, 80)))
            await tx.execute(
                """
                INSERT INTO projects (id, name, context_id, color, archived_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, NULL, ?, ?)
                """,
                (project_id, name, context_id, color, created, created),
            )
            project_ids.append((project_id, context_id))

        for index, title in enumerate(NOTE_TITLES * 3):
            project_id, _context = project_ids[index % len(project_ids)]
            created = _stamp(today - timedelta(days=rng.randint(0, 45), hours=rng.randint(0, 10)))
            pinned = 1 if index % 11 == 0 else 0
            body = (
                f"## {title}\n\n"
                f"- Captured thought {index + 1}\n"
                f"- Related to [[{_iso(today - timedelta(days=index % 14))}]]\n"
                f"- Next step: clarify owners\n\n"
                f"Notes keep getting denser as the week goes on.\n"
            )
            await tx.execute(
                """
                INSERT INTO items (
                  id, type, title, body_md, project_id, pinned, created_at, updated_at
                ) VALUES (?, 'note', ?, ?, ?, ?, ?, ?)
                """,
                (str(uuid4()), f"{title} {index + 1}", body, project_id, pinned, created, created),
            )

        for index in range(70):
            project_id, _context = project_ids[index % len(project_ids)]
            status = STATUSES[index % len(STATUSES)]
            priority = PRIORITIES[index % len(PRIORITIES)]
            due_shift = rng.randint(-10, 21)
            due_on = None if index % 5 == 0 else _iso(today + timedelta(days=due_shift))
            created = _stamp(today - timedelta(days=rng.randint(0, 30)))
            completed = _stamp(today - timedelta(days=1)) if status == "done" else None
            title = f"{TASK_TITLES[index % len(TASK_TITLES)]} ({index + 1})"
            await tx.execute(
                """
                INSERT INTO items (
                  id, type, title, body_md, project_id, status, priority, due_on, completed_at,
                  position, pinned, created_at, updated_at
                ) VALUES (?, 'task', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                """,
                (
                    str(uuid4()),
                    title,
                    f"Details for {title}.",
                    project_id,
                    status,
                    priority,
                    due_on,
                    completed,
                    float(index + 1),
                    created,
                    created,
                ),
            )

        for index, title in enumerate(MEETING_TITLES * 2):
            project_id, _context = project_ids[index % len(project_ids)]
            day = today - timedelta(days=index)
            created = _stamp(day, hour=10 + (index % 6))
            body = (
                "## Attendees\n\n- Alex\n- Sam\n\n"
                "## Decisions\n\n- Keep the current scope\n- Ship a thin slice first\n\n"
                "## Action items\n\n- [ ] Send notes\n- [ ] Update the board\n"
            )
            transcript = (
                f"[{created}] Speaker A: Welcome everyone.\n"
                f"[{created}] Speaker B: The main risk is timing.\n"
                f"[{created}] Speaker A: Let's capture actions and move on.\n"
            )
            await tx.execute(
                """
                INSERT INTO items (
                  id, type, title, body_md, project_id, transcript_raw, pinned, created_at, updated_at
                ) VALUES (?, 'meeting', ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid4()),
                    f"{title} — {_iso(day)}",
                    body,
                    project_id,
                    transcript,
                    1 if index % 8 == 0 else 0,
                    created,
                    created,
                ),
            )

        for offset in range(40):
            day = today - timedelta(days=offset)
            daily = _iso(day)
            created = _stamp(day, hour=7)
            await tx.execute(
                """
                INSERT INTO items (
                  id, type, title, body_md, daily_on, pinned, created_at, updated_at
                ) VALUES (?, 'note', ?, ?, ?, 0, ?, ?)
                """,
                (
                    str(uuid4()),
                    daily,
                    f"# {daily}\n\n- Morning focus\n- One thing that moved\n- One thing to leave\n",
                    daily,
                    created,
                    created,
                ),
            )

        inbox_notes = [
            "Shared from WhatsApp",
            "Parking lot ideas",
            "Random quote to keep",
            "Link to read later",
            "Voice memo summary",
        ]
        for index, title in enumerate(inbox_notes):
            created = _stamp(today - timedelta(hours=index + 1))
            await tx.execute(
                """
                INSERT INTO items (
                  id, type, title, body_md, pinned, created_at, updated_at
                ) VALUES (?, 'note', ?, ?, 0, ?, ?)
                """,
                (str(uuid4()), title, f"{title}\n\nCaptured in a hurry.", created, created),
            )

        if marker is None:
            await tx.execute(
                "INSERT INTO app_meta (key, value) VALUES (?, ?)",
                (SEED_KEY, utc_now()),
            )
        else:
            await tx.execute(
                "UPDATE app_meta SET value = ? WHERE key = ?",
                (utc_now(), SEED_KEY),
            )

    print("Demo workspace seeded.")


async def main() -> None:
    settings = Settings()
    database = Database(settings.database_path, settings.user_timezone)
    await database.connect()
    try:
        await ensure_test_user(database)
        print(f"User ready: {TEST_USERNAME} / {TEST_PASSWORD}")
        await seed_workspace(database, force="--force" in __import__("sys").argv)
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(main())
