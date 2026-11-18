"""Project deletion returns items to the inbox."""

from httpx import AsyncClient


async def test_project_due_on_create_and_patch(authed: tuple[object, AsyncClient]) -> None:
    _app, http = authed
    created = await http.post(
        "/api/projects",
        json={"name": "Deadline", "context_id": "ctx_job1", "due_on": "2026-12-01"},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["due_on"] == "2026-12-01"
    assert body["status"] == "active"
    patched = await http.patch(f"/api/projects/{body['id']}", json={"due_on": "2026-12-15"})
    assert patched.status_code == 200, patched.text
    assert patched.json()["due_on"] == "2026-12-15"
    cleared = await http.patch(f"/api/projects/{body['id']}", json={"due_on": None})
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["due_on"] is None


async def test_project_done_and_cancelled_are_listable(authed: tuple[object, AsyncClient]) -> None:
    _app, http = authed
    created = await http.post("/api/projects", json={"name": "Ship", "context_id": "ctx_job1"})
    assert created.status_code == 201, created.text
    project_id = created.json()["id"]

    done = await http.patch(f"/api/projects/{project_id}", json={"status": "done"})
    assert done.status_code == 200, done.text
    assert done.json()["status"] == "done"
    assert done.json()["archived_at"] is not None

    active_list = await http.get("/api/projects")
    assert project_id not in {row["id"] for row in active_list.json()["projects"]}

    closed_list = await http.get("/api/projects", params={"include_archived": "true"})
    assert project_id in {row["id"] for row in closed_list.json()["projects"]}
    fetched = await http.get(f"/api/projects/{project_id}")
    assert fetched.status_code == 200
    assert fetched.json()["status"] == "done"

    cancelled = await http.patch(f"/api/projects/{project_id}", json={"status": "cancelled"})
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"

    reopened = await http.patch(f"/api/projects/{project_id}", json={"status": "active"})
    assert reopened.status_code == 200, reopened.text
    assert reopened.json()["status"] == "active"
    assert reopened.json()["archived_at"] is None


async def test_closed_project_rejects_new_items(authed: tuple[object, AsyncClient]) -> None:
    _app, http = authed
    created = await http.post("/api/projects", json={"name": "Paused", "context_id": "ctx_job1"})
    assert created.status_code == 201, created.text
    project_id = created.json()["id"]
    closed = await http.patch(f"/api/projects/{project_id}", json={"status": "cancelled"})
    assert closed.status_code == 200, closed.text
    blocked = await http.post(
        "/api/items",
        json={"type": "task", "title": "Should fail", "project_id": project_id},
    )
    assert blocked.status_code == 404, blocked.text
    reopened = await http.patch(f"/api/projects/{project_id}", json={"status": "active"})
    assert reopened.status_code == 200, reopened.text
    allowed = await http.post(
        "/api/items",
        json={"type": "task", "title": "Should work", "project_id": project_id},
    )
    assert allowed.status_code == 201, allowed.text
    assert allowed.json()["project"]["id"] == project_id


async def test_empty_project_name_is_rejected(authed: tuple[object, AsyncClient]) -> None:
    _app, http = authed
    blank = await http.post("/api/projects", json={"name": "   ", "context_id": "ctx_job1"})
    assert blank.status_code == 422, blank.text
    created = await http.post("/api/projects", json={"name": "Keep", "context_id": "ctx_job1"})
    assert created.status_code == 201, created.text
    wiped = await http.patch(f"/api/projects/{created.json()['id']}", json={"name": "  "})
    assert wiped.status_code == 422, wiped.text


async def test_deleting_a_project_nulls_item_project_and_keeps_the_item(
    authed: tuple[object, AsyncClient],
) -> None:
    _app, http = authed
    project = await http.post("/api/projects", json={"name": "Atlas", "context_id": "ctx_job1"})
    assert project.status_code == 201, project.text
    assert project.json()["context"]["icon"] == "briefcase"
    project_id = project.json()["id"]
    note = await http.post(
        "/api/items",
        json={"type": "note", "title": "Kept", "body_md": "still here", "project_id": project_id},
    )
    assert note.status_code == 201, note.text
    deleted = await http.delete(f"/api/projects/{project_id}")
    assert deleted.status_code == 204
    assert deleted.content == b""
    missing = await http.get(f"/api/projects/{project_id}")
    assert missing.status_code == 404
    fetched = await http.get(f"/api/items/{note.json()['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["project"] is None
    inbox = await http.get("/api/items", params={"project_id": "none"})
    assert note.json()["id"] in {item["id"] for item in inbox.json()["items"]}
