"""Bearer API token access for scripts and assistants."""

from pathlib import Path

from httpx import AsyncClient

from tests.conftest import running_app
from tests.helpers import build_settings

TOKEN = "t" * 40


async def test_bearer_token_lists_and_updates_tasks(tmp_path: Path, admin_password_hash: str) -> None:
    settings = build_settings(tmp_path, admin_password_hash, api_token=TOKEN)
    async with running_app(settings) as (_app, http):
        assert isinstance(http, AsyncClient)
        headers = {"Authorization": f"Bearer {TOKEN}"}
        created = await http.post("/api/items", json={"type": "task", "title": "Ship it"}, headers=headers)
        assert created.status_code == 201, created.text
        item_id = created.json()["id"]
        projects = await http.get("/api/projects", headers=headers)
        assert projects.status_code == 200
        moved = await http.patch(f"/api/items/{item_id}", json={"status": "done"}, headers=headers)
        assert moved.status_code == 200
        assert moved.json()["status"] == "done"


async def test_wrong_or_missing_token_is_rejected(tmp_path: Path, admin_password_hash: str) -> None:
    settings = build_settings(tmp_path, admin_password_hash, api_token=TOKEN)
    async with running_app(settings) as (_app, http):
        assert (await http.get("/api/items")).status_code == 401
        bad = await http.get("/api/items", headers={"Authorization": "Bearer nope"})
        assert bad.status_code == 401


async def test_token_disabled_when_not_configured(tmp_path: Path, admin_password_hash: str) -> None:
    settings = build_settings(tmp_path, admin_password_hash)
    async with running_app(settings) as (_app, http):
        resp = await http.get("/api/items", headers={"Authorization": "Bearer "})
        assert resp.status_code == 401
        resp = await http.get("/api/items", headers={"Authorization": f"Bearer {TOKEN}"})
        assert resp.status_code == 401
