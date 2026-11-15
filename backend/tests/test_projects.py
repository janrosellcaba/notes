"""Project deletion returns items to the inbox."""

from httpx import AsyncClient


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
