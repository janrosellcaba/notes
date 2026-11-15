"""Trash, recurrence, backlinks, meeting templates, and attachments."""

import base64
import json
import sqlite3
import tempfile
from pathlib import Path

from httpx import AsyncClient

from app.services.items import purge_expired_trash


async def test_trash_hides_restores_and_expires(authed: tuple[object, AsyncClient]) -> None:
    app, http = authed
    created = await http.post("/api/items", json={"type": "note", "title": "Keep me", "body_md": "trash-token-opal"})
    assert created.status_code == 201, created.text
    item_id = created.json()["id"]

    assert (await http.delete(f"/api/items/{item_id}")).status_code == 204
    listed = await http.get("/api/items", params={"type": "note"})
    assert item_id not in {row["id"] for row in listed.json()["items"]}
    assert (await http.get("/api/search", params={"q": "trash-token-opal"})).json()["results"] == []

    trash = await http.get("/api/items/trash")
    assert trash.status_code == 200
    assert item_id in {row["id"] for row in trash.json()["items"]}

    restored = await http.post(f"/api/items/{item_id}/restore")
    assert restored.status_code == 200
    assert restored.json()["deleted_at"] is None
    assert (await http.get("/api/search", params={"q": "trash-token-opal"})).json()["results"]

    assert (await http.delete(f"/api/items/{item_id}/permanent")).status_code == 409
    assert (await http.delete(f"/api/items/{item_id}")).status_code == 204
    assert (await http.delete(f"/api/items/{item_id}/permanent")).status_code == 204
    assert (await http.get(f"/api/items/{item_id}")).status_code == 404

    doomed = await http.post("/api/items", json={"type": "note", "title": "Old trash"})
    doomed_id = doomed.json()["id"]
    assert (await http.delete(f"/api/items/{doomed_id}")).status_code == 204
    await app.state.db.execute(
        "UPDATE items SET deleted_at = ? WHERE id = ?",
        ("2000-01-01T00:00:00.000Z", doomed_id),
    )
    await purge_expired_trash(app.state.db)
    assert (await http.get(f"/api/items/{doomed_id}")).status_code == 404


async def test_blank_meeting_uses_the_template(authed: tuple[object, AsyncClient]) -> None:
    _app, http = authed
    blank = await http.post("/api/items", json={"type": "meeting"})
    assert blank.status_code == 201, blank.text
    assert "Attendees" in blank.json()["body_md"]
    assert "Decisions" in blank.json()["body_md"]
    assert "Action items" in blank.json()["body_md"]
    custom = await http.post("/api/items", json={"type": "meeting", "title": "Board", "body_md": "Already written"})
    assert custom.json()["body_md"] == "Already written"


async def test_completing_a_repeating_task_creates_the_next_one(authed: tuple[object, AsyncClient]) -> None:
    _app, http = authed
    weekly = await http.post(
        "/api/items",
        json={
            "type": "task",
            "title": "Weekly review",
            "due_on": "2026-11-16",
            "recurrence": "weekly",
            "recurrence_weekday": 0,
        },
    )
    assert weekly.status_code == 201, weekly.text
    done = await http.patch(f"/api/items/{weekly.json()['id']}", json={"status": "done"})
    assert done.status_code == 200
    assert done.json()["status"] == "done"
    listed = await http.get("/api/items", params={"type": "task", "include_done": "true"})
    nxt = next(row for row in listed.json()["items"] if row["title"] == "Weekly review" and row["status"] == "todo")
    assert nxt["due_on"] == "2026-11-23"
    assert nxt["recurrence"] == "weekly"

    monthly = await http.post(
        "/api/items",
        json={
            "type": "task",
            "title": "Rent",
            "due_on": "2026-01-31",
            "recurrence": "monthly",
            "recurrence_monthday": 31,
        },
    )
    assert (await http.patch(f"/api/items/{monthly.json()['id']}", json={"status": "done"})).status_code == 200
    listed = await http.get("/api/items", params={"type": "task", "include_done": "true"})
    rent = next(row for row in listed.json()["items"] if row["title"] == "Rent" and row["status"] == "todo")
    assert rent["due_on"] == "2026-02-28"


async def test_daily_note_is_idempotent_and_stays_out_of_inbox(authed: tuple[object, AsyncClient]) -> None:
    _app, http = authed
    first = await http.put("/api/items/daily/2026-11-15")
    assert first.status_code == 201, first.text
    assert first.json()["type"] == "note"
    assert first.json()["daily_on"] == "2026-11-15"
    assert first.json()["title"] == "2026-11-15"
    second = await http.put("/api/items/daily/2026-11-15")
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    inbox = await http.get("/api/items", params={"project_id": "none"})
    assert first.json()["id"] not in {row["id"] for row in inbox.json()["items"]}
    bad = await http.put("/api/items/daily/not-a-day")
    assert bad.status_code == 422


async def test_wikilinks_resolve_and_list_backlinks(authed: tuple[object, AsyncClient]) -> None:
    _app, http = authed
    target = await http.post("/api/items", json={"type": "note", "title": "Beta note", "body_md": "target"})
    source = await http.post(
        "/api/items",
        json={"type": "note", "title": "Alpha", "body_md": "See [[Beta note]] for the rest."},
    )
    assert target.status_code == 201 and source.status_code == 201
    found = await http.get("/api/items/lookup", params={"title": "Beta note"})
    assert found.status_code == 200
    assert found.json()["id"] == target.json()["id"]
    links = await http.get(f"/api/items/{target.json()['id']}/backlinks")
    assert [row["id"] for row in links.json()["items"]] == [source.json()["id"]]
    missing = await http.get("/api/items/lookup", params={"title": "Nothing here"})
    assert missing.status_code == 404


async def test_attachments_round_trip_into_json_and_sqlite(authed: tuple[object, AsyncClient]) -> None:
    _app, http = authed
    note = await http.post("/api/items", json={"type": "note", "title": "With file", "body_md": "body"})
    item_id = note.json()["id"]
    payload = b"%PDF-1.4 tiny"
    uploaded = await http.post(
        f"/api/items/{item_id}/attachments",
        files={"file": ("scan.pdf", payload, "application/pdf")},
    )
    assert uploaded.status_code == 201, uploaded.text
    assert uploaded.json()["filename"] == "scan.pdf"
    assert uploaded.json()["size"] == len(payload)
    rejected = await http.post(
        f"/api/items/{item_id}/attachments",
        files={"file": ("run.exe", b"MZ", "application/octet-stream")},
    )
    assert rejected.status_code == 415

    downloaded = await http.get(f"/api/items/{item_id}/attachments/{uploaded.json()['id']}")
    assert downloaded.status_code == 200
    assert downloaded.content == payload
    assert downloaded.headers["content-type"].startswith("application/pdf")

    exported = await http.get("/api/backup/json")
    attachment = next(row for row in exported.json()["attachments"] if row["id"] == uploaded.json()["id"])
    assert base64.b64decode(attachment["data_base64"]) == payload

    sqlite_response = await http.get("/api/backup/sqlite")
    assert sqlite_response.status_code == 200
    handle = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    handle.write(sqlite_response.content)
    handle.close()
    connection = sqlite3.connect(handle.name)
    row = connection.execute("SELECT data FROM attachments WHERE id = ?", (uploaded.json()["id"],)).fetchone()
    connection.close()
    Path(handle.name).unlink()
    assert row is not None and bytes(row[0]) == payload
    assert json.dumps({"ok": True})
