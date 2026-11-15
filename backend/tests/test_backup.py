"""JSON and SQLite exports."""

import json
import sqlite3

from httpx import AsyncClient


async def test_json_backup_round_trips_contexts_projects_and_transcripts(
    authed: tuple[object, AsyncClient],
) -> None:
    _app, http = authed
    project = await http.post(
        "/api/projects",
        json={"name": "Atlas", "context_id": "ctx_job1", "color": "#112233"},
    )
    assert project.status_code == 201, project.text
    transcript = "spoken " * 2000 + "unique-transcript-marker"
    meeting = await http.post(
        "/api/items",
        json={
            "type": "meeting",
            "title": "Review",
            "body_md": "Takeaways",
            "project_id": project.json()["id"],
            "transcript_raw": transcript,
        },
    )
    assert meeting.status_code == 201, meeting.text
    response = await http.get("/api/backup/json")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert 'filename="notes-' in response.headers["content-disposition"]
    assert response.headers["content-disposition"].endswith('.json"')
    payload = response.json()
    assert "idempotency_keys" not in payload
    assert payload["schema_version"] == 1
    assert any(row["id"] == "ctx_job1" and row["name"] == "Job 1" for row in payload["contexts"])
    exported = next(row for row in payload["projects"] if row["id"] == project.json()["id"])
    assert exported["context_id"] == "ctx_job1"
    assert exported["color_override"] == "#112233"
    assert "context" not in exported
    exported_item = next(row for row in payload["items"] if row["id"] == meeting.json()["id"])
    assert exported_item["transcript_raw"] == transcript
    json.dumps(payload)


async def test_sqlite_backup_is_consistent(authed: tuple[object, AsyncClient], tmp_path) -> None:
    _app, http = authed
    created = await http.post("/api/items", json={"type": "note", "title": "Stored", "body_md": "inside"})
    item_id = created.json()["id"]
    token = http.cookies.get("notes_session")
    http.cookies.clear()
    denied = await http.get("/api/backup/sqlite")
    assert denied.status_code == 401
    http.cookies.set("notes_session", token)
    response = await http.get("/api/backup/sqlite")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/vnd.sqlite3")
    assert response.headers["cache-control"] == "no-store"
    path = tmp_path / "notes.db"
    path.write_bytes(response.content)
    connection = sqlite3.connect(path)
    try:
        assert connection.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        ids = {row[0] for row in connection.execute("SELECT id FROM items")}
    finally:
        connection.close()
    assert item_id in ids
