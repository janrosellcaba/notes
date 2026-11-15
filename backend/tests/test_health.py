"""Public health route."""

from httpx import AsyncClient

from app.security import SECURITY_HEADERS


async def test_health_is_public(client: tuple[object, AsyncClient]) -> None:
    _app, http = client
    response = await http.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert "notes_session" not in response.headers.get("set-cookie", "")


async def test_health_ignores_a_foreign_origin(client: tuple[object, AsyncClient]) -> None:
    _app, http = client
    response = await http.get("/api/health", headers={"Origin": "https://evil.example"})
    assert response.status_code == 200


async def test_security_headers(client: tuple[object, AsyncClient]) -> None:
    _app, http = client
    response = await http.get("/api/health")
    for name, value in SECURITY_HEADERS.items():
        assert response.headers[name.lower()] == value
