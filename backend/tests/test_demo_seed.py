"""Demo login and bulk seed stay isolated per user."""

from httpx import AsyncClient

from app.demo_seed import ensure_test_user, seed_workspace
from app.security import verify_password
from tests.helpers import ADMIN_USERNAME, ADMIN_PASSWORD


async def test_demo_seed_stays_on_the_test_user(client: tuple[object, AsyncClient]) -> None:
    app, http = client
    db = app.state.db
    test_id = await ensure_test_user(db)
    row = await db.fetchone("SELECT username, password_hash FROM users WHERE id = ?", (test_id,))
    assert row is not None
    assert verify_password(str(row["password_hash"]), "test")

    await seed_workspace(db, test_id)
    test_projects = await db.fetchone(
        "SELECT COUNT(*) AS n FROM projects WHERE user_id = ? AND archived_at IS NULL",
        (test_id,),
    )
    admin = await db.fetchone("SELECT id FROM users WHERE username = ?", ("jan",))
    assert admin is not None
    admin_projects = await db.fetchone(
        "SELECT COUNT(*) AS n FROM projects WHERE user_id = ?",
        (admin["id"],),
    )
    assert int(test_projects["n"]) >= 10
    assert int(admin_projects["n"]) == 0

    login = await http.post("/api/auth/login", json={"username": "test", "password": "test"})
    assert login.status_code == 200
    listed = await http.get("/api/projects")
    assert listed.status_code == 200
    assert len(listed.json()["projects"]) >= 10

    await http.post("/api/auth/logout")
    admin_login = await http.post(
        "/api/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
    )
    assert admin_login.status_code == 200
    admin_listed = await http.get("/api/projects")
    assert admin_listed.json()["projects"] == []
