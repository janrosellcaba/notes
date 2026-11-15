"""Demo login and bulk seed for local/VPS exploration."""

from app.demo_seed import ensure_test_user, seed_workspace
from app.security import verify_password


async def test_demo_seed_creates_test_user_and_fills_the_workspace(client: tuple[object, object]) -> None:
    app, _http = client
    db = app.state.db
    await ensure_test_user(db)
    row = await db.fetchone("SELECT username, password_hash FROM users WHERE username = ?", ("test",))
    assert row is not None
    assert verify_password(str(row["password_hash"]), "test")

    await seed_workspace(db)
    projects = await db.fetchone("SELECT COUNT(*) AS n FROM projects WHERE archived_at IS NULL")
    notes = await db.fetchone("SELECT COUNT(*) AS n FROM items WHERE type = 'note' AND deleted_at IS NULL")
    tasks = await db.fetchone("SELECT COUNT(*) AS n FROM items WHERE type = 'task' AND deleted_at IS NULL")
    meetings = await db.fetchone(
        "SELECT COUNT(*) AS n FROM items WHERE type = 'meeting' AND deleted_at IS NULL"
    )
    dailies = await db.fetchone(
        "SELECT COUNT(*) AS n FROM items WHERE daily_on IS NOT NULL AND deleted_at IS NULL"
    )
    assert int(projects["n"]) >= 10
    assert int(notes["n"]) >= 40
    assert int(tasks["n"]) >= 60
    assert int(meetings["n"]) >= 20
    assert int(dailies["n"]) >= 30

    await seed_workspace(db)
    again = await db.fetchone("SELECT COUNT(*) AS n FROM projects WHERE archived_at IS NULL")
    assert int(again["n"]) == int(projects["n"])
