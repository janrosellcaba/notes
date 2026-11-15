"""Home feed context rules."""

from httpx import AsyncClient


async def test_home_context_filter_keeps_unassigned_tasks_and_counts_the_inbox(
    authed: tuple[object, AsyncClient],
) -> None:
    _app, http = authed
    job1 = (await http.post("/api/projects", json={"name": "Atlas", "context_id": "ctx_job1"})).json()
    job2 = (await http.post("/api/projects", json={"name": "Other", "context_id": "ctx_job2"})).json()
    today = "2026-11-15"
    job1_task = (
        await http.post(
            "/api/items",
            json={"type": "task", "title": "Job one", "project_id": job1["id"], "due_on": today},
        )
    ).json()
    job2_task = (
        await http.post(
            "/api/items",
            json={"type": "task", "title": "Job two", "project_id": job2["id"], "due_on": today},
        )
    ).json()
    loose_task = (
        await http.post("/api/items", json={"type": "task", "title": "Loose", "due_on": today})
    ).json()
    loose_note = (await http.post("/api/items", json={"type": "note", "title": "Loose note"})).json()

    home = await http.get("/api/home", params={"context_id": "ctx_job1", "today": today})
    assert home.status_code == 200, home.text
    body = home.json()
    task_ids = {item["id"] for item in body["today_tasks"]}
    assert job1_task["id"] in task_ids
    assert loose_task["id"] in task_ids
    assert job2_task["id"] not in task_ids
    assert body["inbox_count"] == 1
    assert loose_note["id"]
    assert body["today"] == today


async def test_a_filed_note_skips_the_inbox_and_stays_in_its_context(
    authed: tuple[object, AsyncClient],
) -> None:
    _app, http = authed
    created = await http.post("/api/items", json={"type": "note", "title": "Filed", "context_id": "ctx_job1"})
    assert created.status_code == 201, created.text
    inbox = await http.get("/api/items", params={"project_id": "none"})
    assert created.json()["id"] not in {item["id"] for item in inbox.json()["items"]}
    home = await http.get("/api/home", params={"today": "2026-11-15"})
    assert home.json()["inbox_count"] == 0
    own = await http.get("/api/items", params={"context_id": "ctx_job1"})
    other = await http.get("/api/items", params={"context_id": "ctx_job2"})
    assert created.json()["id"] in {item["id"] for item in own.json()["items"]}
    assert created.json()["id"] not in {item["id"] for item in other.json()["items"]}


async def test_home_requires_a_real_day(authed: tuple[object, AsyncClient]) -> None:
    _app, http = authed
    missing = await http.get("/api/home")
    assert missing.status_code == 422
    invalid = await http.get("/api/home", params={"today": "yesterday"})
    assert invalid.status_code == 422
