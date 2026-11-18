"""Item capture, triage, kanban moves, and idempotency."""

from httpx import AsyncClient


async def _create(http: AsyncClient, **body: object) -> dict:
    payload = {"type": "note", "title": "", "body_md": ""}
    payload.update(body)
    response = await http.post("/api/items", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def test_inbox_project_assignment_respects_null_and_omitted_fields(
    authed: tuple[object, AsyncClient],
) -> None:
    _app, http = authed
    project = await http.post("/api/projects", json={"name": "Atlas", "context_id": "ctx_job1"})
    assert project.status_code == 201, project.text
    project_id = project.json()["id"]

    note = await _create(http, body_md="Hold this")
    inbox = await http.get("/api/items", params={"project_id": "none"})
    assert note["id"] in {item["id"] for item in inbox.json()["items"]}

    assigned = await http.patch(f"/api/items/{note['id']}", json={"project_id": project_id})
    assert assigned.status_code == 200
    assert assigned.json()["project"]["context"]["icon"] == "briefcase"
    inbox = await http.get("/api/items", params={"project_id": "none"})
    assert note["id"] not in {item["id"] for item in inbox.json()["items"]}

    renamed = await http.patch(f"/api/items/{note['id']}", json={"title": "Still assigned"})
    assert renamed.status_code == 200
    assert renamed.json()["project"]["id"] == project_id
    inbox = await http.get("/api/items", params={"project_id": "none"})
    assert note["id"] not in {item["id"] for item in inbox.json()["items"]}

    cleared = await http.patch(f"/api/items/{note['id']}", json={"project_id": None})
    assert cleared.status_code == 200
    assert cleared.json()["project"] is None
    inbox = await http.get("/api/items", params={"project_id": "none"})
    assert note["id"] in {item["id"] for item in inbox.json()["items"]}


async def test_convert_keeps_the_id_and_rejects_a_second_convert(authed: tuple[object, AsyncClient]) -> None:
    _app, http = authed
    note = await _create(http, title="", body_md="Send the diagram\nlater")
    cleared = await http.patch(f"/api/items/{note['id']}", json={"title": ""})
    assert cleared.status_code == 200, cleared.text
    converted = await http.post(f"/api/items/{note['id']}/convert-to-task")
    assert converted.status_code == 200, converted.text
    body = converted.json()
    assert body["id"] == note["id"]
    assert body["type"] == "task"
    assert body["status"] == "todo"
    assert body["priority"] == "none"
    assert body["title"] == "Send the diagram"
    again = await http.post(f"/api/items/{note['id']}/convert-to-task")
    assert again.status_code == 409
    assert again.json()["code"] == "not_a_note"


async def test_extract_task_links_the_source_and_leaves_its_type(authed: tuple[object, AsyncClient]) -> None:
    _app, http = authed
    project = await http.post("/api/projects", json={"name": "Atlas", "context_id": "ctx_job1"})
    project_id = project.json()["id"]
    note = await _create(http, title="Notes", body_md="context", project_id=project_id)
    extracted = await http.post(
        f"/api/items/{note['id']}/extract-task",
        json={"title": "Send the revised diagram", "selection": "send the revised diagram"},
    )
    assert extracted.status_code == 201, extracted.text
    task = extracted.json()
    assert task["id"] != note["id"]
    assert task["type"] == "task"
    assert task["source_item_id"] == note["id"]
    assert task["project"]["id"] == project_id
    source = await http.get(f"/api/items/{note['id']}")
    assert source.json()["type"] == "note"


async def test_move_between_neighbors_and_toggle_completed_at(authed: tuple[object, AsyncClient]) -> None:
    _app, http = authed
    project = (await http.post("/api/projects", json={"name": "Atlas", "context_id": "ctx_job1"})).json()
    created = []
    for title in ("A", "B", "C"):
        response = await http.post(
            "/api/items",
            json={"type": "task", "title": title, "project_id": project["id"]},
        )
        assert response.status_code == 201, response.text
        created.append(response.json())
    first, second, third = created
    assert first["position"] < second["position"] < third["position"]

    moved = await http.post(
        f"/api/items/{first['id']}/move",
        json={"status": "todo", "before_id": second["id"], "after_id": third["id"]},
    )
    assert moved.status_code == 200, moved.text
    position = moved.json()["position"]
    assert second["position"] < position < third["position"]

    done = await http.post(
        f"/api/items/{first['id']}/move",
        json={"status": "done", "before_id": None, "after_id": None},
    )
    assert done.status_code == 200, done.text
    assert done.json()["status"] == "done"
    assert done.json()["completed_at"]

    restored = await http.post(
        f"/api/items/{first['id']}/move",
        json={"status": "todo", "before_id": None, "after_id": None},
    )
    assert restored.status_code == 200, restored.text
    assert restored.json()["status"] == "todo"
    assert restored.json()["completed_at"] is None


async def test_tiny_position_gap_renumbers_the_column(authed: tuple[object, AsyncClient]) -> None:
    app, http = authed
    project = (await http.post("/api/projects", json={"name": "Atlas", "context_id": "ctx_job1"})).json()
    rows = []
    for title in ("A", "B", "C"):
        response = await http.post(
            "/api/items",
            json={"type": "task", "title": title, "project_id": project["id"]},
        )
        rows.append(response.json())
    first, second, third = rows
    await app.state.db.execute("UPDATE items SET position = ? WHERE id = ?", (10.0, first["id"]))
    await app.state.db.execute(
        "UPDATE items SET position = ? WHERE id = ?",
        (10.0 + 1e-7, second["id"]),
    )
    moved = await http.post(
        f"/api/items/{third['id']}/move",
        json={"status": "todo", "before_id": first["id"], "after_id": second["id"]},
    )
    assert moved.status_code == 200, moved.text
    stored = await app.state.db.fetchall(
        "SELECT id, position FROM items WHERE type = 'task' ORDER BY position"
    )
    assert [row["id"] for row in stored] == [first["id"], third["id"], second["id"]]
    assert [row["position"] for row in stored] == [1024.0, 2048.0, 3072.0]


async def test_archive_hides_inbox_home_and_search_but_get_still_returns_it(
    authed: tuple[object, AsyncClient],
) -> None:
    _app, http = authed
    note = await _create(http, title="Pinned thought", body_md="archive-token-zebra")
    assert (await http.patch(f"/api/items/{note['id']}", json={"pinned": True})).status_code == 200
    archived = await http.post(f"/api/items/{note['id']}/archive")
    assert archived.status_code == 200
    inbox = await http.get("/api/items", params={"project_id": "none"})
    assert note["id"] not in {item["id"] for item in inbox.json()["items"]}
    home = await http.get("/api/home", params={"today": "2026-11-15"})
    assert note["id"] not in {item["id"] for item in home.json()["pinned"]}
    found = await http.get("/api/search", params={"q": "archive-token-zebra"})
    assert found.status_code == 200
    assert found.json()["results"] == []
    direct = await http.get(f"/api/items/{note['id']}")
    assert direct.status_code == 200
    assert direct.json()["archived_at"]


async def test_idempotency_replay_mismatch_and_expiry(authed: tuple[object, AsyncClient]) -> None:
    app, http = authed
    body = {"type": "note", "title": "Once", "body_md": "same"}
    headers = {"Idempotency-Key": "replay-key"}
    first = await http.post("/api/items", json=body, headers=headers)
    second = await http.post("/api/items", json=body, headers=headers)
    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    listed = await http.get("/api/items", params={"project_id": "none"})
    assert [item["id"] for item in listed.json()["items"]].count(first.json()["id"]) == 1

    conflict = await http.post(
        "/api/items",
        json={"type": "note", "title": "Other", "body_md": "different"},
        headers=headers,
    )
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "idempotency_conflict"
    listed = await http.get("/api/items", params={"project_id": "none"})
    assert len(listed.json()["items"]) == 1

    await app.state.db.execute(
        "UPDATE idempotency_keys SET created_at = ? WHERE key = ?",
        ("2000-01-01T00:00:00.000Z", "replay-key"),
    )
    expired = await http.post("/api/items", json=body, headers=headers)
    assert expired.status_code == 201
    assert expired.json()["id"] != first.json()["id"]
    remaining = await app.state.db.fetchone(
        "SELECT key FROM idempotency_keys WHERE key = ?",
        ("replay-key",),
    )
    assert remaining is not None
    stale = await app.state.db.fetchone(
        "SELECT created_at FROM idempotency_keys WHERE key = ?",
        ("replay-key",),
    )
    assert stale is not None
    assert stale["created_at"] != "2000-01-01T00:00:00.000Z"


async def test_oversized_title_is_413_and_task_fields_on_a_note_are_422(
    authed: tuple[object, AsyncClient],
) -> None:
    _app, http = authed
    too_big = await http.post("/api/items", json={"type": "note", "title": "x" * 501, "body_md": "ok"})
    assert too_big.status_code == 413
    assert too_big.json()["code"] == "payload_too_large"
    invalid = await http.post("/api/items", json={"type": "note", "title": "Nope", "status": "todo"})
    assert invalid.status_code == 422
    assert invalid.json()["code"] == "validation_error"
    assert invalid.json()["detail"][0]["loc"] == ["body", "status"]
    listed = await http.get("/api/items", params={"project_id": "none"})
    assert listed.json()["items"] == []


async def test_a_task_can_omit_project_and_keep_optional_details(
    authed: tuple[object, AsyncClient],
) -> None:
    _app, http = authed
    created = await http.post(
        "/api/items",
        json={
            "type": "task",
            "title": "Call the client",
            "priority": "high",
            "due_on": "2026-11-20",
            "starts_on": "2026-11-18",
            "assignee": "Marta",
        },
    )
    assert created.status_code == 201, created.text
    task = created.json()
    assert task["project"] is None
    assert task["context"] is None
    assert task["starts_on"] == "2026-11-18"
    assert task["assignee"] == "Marta"
    assert task["priority"] == "high"
    listed = await http.get("/api/items", params={"type": "task", "include_done": True, "limit": 50})
    assert task["id"] in {item["id"] for item in listed.json()["items"]}

    child = await http.post(
        "/api/items",
        json={"type": "task", "title": "Send the notes", "parent_id": task["id"]},
    )
    assert child.status_code == 201, child.text
    assert child.json()["parent_id"] == task["id"]
    parent = await http.get(f"/api/items/{task['id']}")
    assert parent.json()["subtask_total"] == 1
    assert parent.json()["subtask_done"] == 0
    nested = await http.post(
        "/api/items",
        json={"type": "task", "title": "Too deep", "parent_id": child.json()["id"]},
    )
    assert nested.status_code == 422
    assert nested.json()["detail"][0]["loc"] == ["body", "parent_id"]
    note = await http.post("/api/items", json={"type": "note", "title": "Nope", "assignee": "Marta"})
    assert note.status_code == 422


async def test_task_status_cancelled_round_trips(authed: tuple[object, AsyncClient]) -> None:
    _app, http = authed
    created = await http.post("/api/items", json={"type": "task", "title": "Drop it"})
    assert created.status_code == 201, created.text
    task_id = created.json()["id"]
    cancelled = await http.patch(f"/api/items/{task_id}", json={"status": "cancelled"})
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"
    blocked = await http.patch(f"/api/items/{task_id}", json={"status": "blocked"})
    assert blocked.status_code == 422, blocked.text
