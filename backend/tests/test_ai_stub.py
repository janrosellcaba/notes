"""The AI route is a stable 501 until a provider is wired."""

from httpx import AsyncClient


async def test_ai_process_is_not_implemented_and_does_not_touch_the_item(
    authed: tuple[object, AsyncClient],
) -> None:
    _app, http = authed
    created = await http.post("/api/items", json={"type": "note", "title": "Later", "body_md": "text"})
    item = created.json()
    response = await http.post(f"/api/items/{item['id']}/ai-process")
    assert response.status_code == 501
    body = response.json()
    assert body["code"] == "ai_not_configured"
    assert body["detail"] == "AI processing is not configured"
    assert body["item_id"] == item["id"]
    assert body["planned_effects"]["writes"] == ["ai_summary", "ai_action_items"]
    assert body["planned_effects"]["may_create"] == "tasks with source_item_id"
    fetched = await http.get(f"/api/items/{item['id']}")
    assert fetched.json()["updated_at"] == item["updated_at"]
    assert fetched.json()["ai_summary"] is None
    assert fetched.json()["ai_action_items"] is None
