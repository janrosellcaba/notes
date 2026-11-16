"""Fill one user's workspace with demo content and ensure the test login exists.

Run inside the app environment:

    python -m app.demo_seed
"""

from __future__ import annotations

import asyncio
import random
import sys
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app import tenancy
from app.config import Settings
from app.db import Database
from app.security import hash_password
from app.services import utc_now

TEST_USERNAME = "test"
TEST_PASSWORD = "test"

PROJECTS = [
    ("job1", "Website redesign", "#3B82F6"),
    ("job1", "Q1 planning", "#6366F1"),
    ("job1", "Client onboarding", "#0EA5E9"),
    ("job2", "Mobile app", "#8B5CF6"),
    ("job2", "Support backlog", "#A855F7"),
    ("job2", "Partner portal", "#7C3AED"),
    ("job3", "Ops handbook", "#F59E0B"),
    ("job3", "Hiring pipeline", "#D97706"),
    ("personal", "Home renovations", "#10B981"),
    ("personal", "Travel 2026", "#14B8A6"),
    ("personal", "Learning Spanish", "#059669"),
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


async def ensure_test_user(db: Database) -> str:
    existing = await db.fetchone("SELECT id FROM users WHERE lower(username) = lower(?)", (TEST_USERNAME,))
    if existing is not None:
        password_hash = hash_password(TEST_PASSWORD)
        await db.execute(
            "UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?",
            (password_hash, existing["id"]),
        )
        user_id = str(existing["id"])
    else:
        user_id = str(uuid4())
        await db.execute(
            """
            INSERT INTO users (id, username, password_hash, session_version, created_at)
            VALUES (?, ?, ?, 1, ?)
            """,
            (user_id, TEST_USERNAME, hash_password(TEST_PASSWORD), utc_now()),
        )
    await tenancy.ensure_user_contexts(db, user_id)
    return user_id


async def seed_workspace(db: Database, user_id: str, *, force: bool = False) -> None:
    marker_key = tenancy.user_seed_marker(user_id)
    marker = await db.fetchone("SELECT value FROM app_meta WHERE key = ?", (marker_key,))
    if marker is not None and not force:
        print("Demo seed already present for this user; skipping content.")
        return

    contexts = await db.fetchall(
        "SELECT id, slug FROM contexts WHERE user_id = ? ORDER BY sort_order",
        (user_id,),
    )
    by_slug = {str(row["slug"]): str(row["id"]) for row in contexts}
    if not by_slug:
        raise SystemExit("No contexts found for user; cannot seed")

    today = datetime.now(UTC).replace(hour=12, minute=0, second=0, microsecond=0)
    rng = random.Random(20261115)
    project_ids: list[str] = []

    async with db.transaction() as tx:
        for slug, name, color in PROJECTS:
            context_id = by_slug.get(slug) or next(iter(by_slug.values()))
            project_id = str(uuid4())
            created = _stamp(today - timedelta(days=rng.randint(20, 80)))
            await tx.execute(
                """
                INSERT INTO projects (id, user_id, name, context_id, color, archived_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
                """,
                (project_id, user_id, name, context_id, color, created, created),
            )
            project_ids.append(project_id)

        for index, title in enumerate(NOTE_TITLES * 3):
            project_id = project_ids[index % len(project_ids)]
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
                  id, user_id, type, title, body_md, project_id, pinned, created_at, updated_at
                ) VALUES (?, ?, 'note', ?, ?, ?, ?, ?, ?)
                """,
                (str(uuid4()), user_id, f"{title} {index + 1}", body, project_id, pinned, created, created),
            )

        for index in range(70):
            project_id = project_ids[index % len(project_ids)]
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
                  id, user_id, type, title, body_md, project_id, status, priority, due_on, completed_at,
                  position, pinned, created_at, updated_at
                ) VALUES (?, ?, 'task', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                """,
                (
                    str(uuid4()),
                    user_id,
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
            project_id = project_ids[index % len(project_ids)]
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
                  id, user_id, type, title, body_md, project_id, transcript_raw, pinned, created_at, updated_at
                ) VALUES (?, ?, 'meeting', ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid4()),
                    user_id,
                    f"{title} — {_iso(day)}",
                    body,
                    project_id,
                    transcript,
                    1 if index % 8 == 0 else 0,
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
                  id, user_id, type, title, body_md, pinned, created_at, updated_at
                ) VALUES (?, ?, 'note', ?, ?, 0, ?, ?)
                """,
                (str(uuid4()), user_id, title, f"{title}\n\nCaptured in a hurry.", created, created),
            )

        if marker is None:
            await tx.execute(
                "INSERT INTO app_meta (key, value) VALUES (?, ?)",
                (marker_key, utc_now()),
            )
        else:
            await tx.execute(
                "UPDATE app_meta SET value = ? WHERE key = ?",
                (utc_now(), marker_key),
            )

    print("Demo workspace seeded for this user only.")


async def main() -> None:
    settings = Settings()
    database = Database(settings.database_path, settings.user_timezone)
    await database.connect()
    try:
        admin = await database.fetchone(
            "SELECT id FROM users WHERE username = ?",
            (settings.admin_username.strip(),),
        )
        if admin is not None:
            await tenancy.claim_unowned(database, str(admin["id"]))
            await tenancy.ensure_user_contexts(database, str(admin["id"]))
        await tenancy.purge_legacy_shared_demo(database)
        user_id = await ensure_test_user(database)
        print(f"User ready: {TEST_USERNAME} / {TEST_PASSWORD}")
        await seed_workspace(database, user_id, force="--force" in sys.argv)
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(main())
