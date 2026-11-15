"""Context rename and ordering."""

from httpx import AsyncClient


async def test_contexts_can_be_renamed_and_reject_a_duplicate_order(
    authed: tuple[object, AsyncClient],
) -> None:
    _app, http = authed
    listed = await http.get("/api/contexts")
    assert listed.status_code == 200
    assert [row["id"] for row in listed.json()["contexts"]] == [
        "ctx_job1",
        "ctx_job2",
        "ctx_job3",
        "ctx_personal",
    ]
    renamed = await http.patch("/api/contexts/ctx_job1", json={"name": "Acme"})
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "Acme"
    assert renamed.json()["slug"] == "job1"
    duplicate = await http.patch("/api/contexts/ctx_job2", json={"sort_order": 1})
    assert duplicate.status_code == 422
    assert duplicate.json()["code"] == "validation_error"
    assert listed.json()["contexts"][0]["icon"] == "briefcase"
    assert listed.json()["contexts"][3]["icon"] == "house"


async def test_contexts_can_be_added_reordered_and_removed(
    authed: tuple[object, AsyncClient],
) -> None:
    _app, http = authed
    created = await http.post("/api/contexts", json={"name": "Studio", "icon": "palette"})
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["name"] == "Studio"
    assert body["slug"] == "studio"
    assert body["icon"] == "palette"
    assert body["sort_order"] == 5
    moved = await http.post(f"/api/contexts/{body['id']}/move", params={"direction": "up"})
    assert moved.status_code == 200
    assert moved.json()["sort_order"] == 4
    await http.post("/api/projects", json={"name": "Atlas", "context_id": "ctx_job1"})
    blocked = await http.delete("/api/contexts/ctx_job1")
    assert blocked.status_code == 409
    removed = await http.delete(f"/api/contexts/{body['id']}")
    assert removed.status_code == 204
