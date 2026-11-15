"""Login, logout, session cookie, rate limit, and origin checks."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import jwt
from httpx import AsyncClient, Response

from tests.helpers import ADMIN_PASSWORD, ADMIN_USERNAME, ALLOWED_ORIGIN

UNAUTHENTICATED = {"detail": "Unauthenticated", "code": "unauthenticated"}
INVALID_LOGIN = {"detail": "Invalid username or password", "code": "invalid_credentials"}


def cookie_attributes(response: Response) -> dict[str, str | None]:
    header = response.headers["set-cookie"]
    parts = [part.strip() for part in header.split(";")]
    attributes: dict[str, str | None] = {}
    for part in parts[1:]:
        if "=" in part:
            name, value = part.split("=", 1)
            attributes[name.lower()] = value
        else:
            attributes[part.lower()] = None
    return attributes


async def login(http: AsyncClient, *, username: str = ADMIN_USERNAME, password: str = ADMIN_PASSWORD, **kwargs):
    return await http.post("/api/auth/login", json={"username": username, "password": password}, **kwargs)


async def test_login_cookie_is_httponly_and_lax(client: tuple[object, AsyncClient]) -> None:
    _app, http = client
    response = await login(http)
    assert response.status_code == 200
    assert response.json() == {"username": ADMIN_USERNAME}
    attributes = cookie_attributes(response)
    assert "httponly" in attributes
    assert attributes["samesite"] is not None
    assert attributes["samesite"].lower() == "lax"
    assert attributes["path"] == "/"
    assert attributes["max-age"] == "2592000"
    assert "secure" not in attributes


async def test_login_cookie_is_secure_when_configured(secure_client: tuple[object, AsyncClient]) -> None:
    _app, http = secure_client
    response = await login(http)
    assert response.status_code == 200
    attributes = cookie_attributes(response)
    assert "secure" in attributes
    assert "httponly" in attributes
    assert attributes["samesite"] is not None
    assert attributes["samesite"].lower() == "lax"


async def test_wrong_username_and_wrong_password_share_one_body(
    client: tuple[object, AsyncClient],
) -> None:
    _app, http = client
    wrong_password = await login(http, password="not-the-password")
    wrong_username = await login(http, username="nobody", password="not-the-password")
    assert wrong_password.status_code == 401
    assert wrong_username.status_code == 401
    assert wrong_password.json() == wrong_username.json() == INVALID_LOGIN


async def test_sixth_failure_is_rate_limited(client: tuple[object, AsyncClient]) -> None:
    _app, http = client
    for attempt in range(5):
        response = await login(http, password="not-the-password")
        assert response.status_code == 401, attempt
    blocked = await login(http, password="not-the-password")
    assert blocked.status_code == 429
    assert blocked.json() == {
        "detail": "Too many attempts. Wait a few minutes.",
        "code": "rate_limited",
    }
    still_blocked = await login(http, password=ADMIN_PASSWORD)
    assert still_blocked.status_code == 429


async def test_successful_login_resets_the_failure_bucket(client: tuple[object, AsyncClient]) -> None:
    _app, http = client
    for _ in range(4):
        assert (await login(http, password="not-the-password")).status_code == 401
    assert (await login(http)).status_code == 200
    for attempt in range(5):
        assert (await login(http, password="not-the-password")).status_code == 401, attempt
    assert (await login(http, password="not-the-password")).status_code == 429


async def test_rate_limit_uses_the_first_forwarded_hop(client: tuple[object, AsyncClient]) -> None:
    _app, http = client
    headers = {"X-Forwarded-For": "203.0.113.8, 10.0.0.2"}
    for _ in range(5):
        assert (await login(http, password="not-the-password", headers=headers)).status_code == 401
    assert (await login(http, password="not-the-password", headers=headers)).status_code == 429
    other = await login(http, password="not-the-password", headers={"X-Forwarded-For": "203.0.113.9"})
    assert other.status_code == 401


async def test_rate_limit_ignores_forwarded_for_without_a_trusted_proxy(
    untrusted_client: tuple[object, AsyncClient],
) -> None:
    _app, http = untrusted_client
    for index in range(5):
        response = await login(
            http,
            password="not-the-password",
            headers={"X-Forwarded-For": f"203.0.113.{index}"},
        )
        assert response.status_code == 401
    blocked = await login(
        http,
        password="not-the-password",
        headers={"X-Forwarded-For": "198.51.100.20"},
    )
    assert blocked.status_code == 429


async def test_me_requires_the_session_cookie(client: tuple[object, AsyncClient]) -> None:
    _app, http = client
    anonymous = await http.get("/api/auth/me")
    assert anonymous.status_code == 401
    assert anonymous.json() == UNAUTHENTICATED
    assert (await login(http)).status_code == 200
    authenticated = await http.get("/api/auth/me")
    assert authenticated.status_code == 200
    assert authenticated.json() == {"username": ADMIN_USERNAME}


async def test_expired_and_tampered_tokens_match_a_missing_cookie(
    client: tuple[object, AsyncClient],
) -> None:
    app, http = client
    secret = app.state.settings.session_secret
    expired = jwt.encode(
        {
            "sub": ADMIN_USERNAME,
            "sv": 1,
            "iat": datetime.now(UTC) - timedelta(days=2),
            "exp": datetime.now(UTC) - timedelta(days=1),
        },
        secret,
        algorithm="HS256",
    )
    tampered = expired[:-4] + "aaaa"
    http.cookies.set("notes_session", expired)
    expired_response = await http.get("/api/auth/me")
    http.cookies.set("notes_session", tampered)
    tampered_response = await http.get("/api/auth/me")
    http.cookies.clear()
    missing = await http.get("/api/auth/me")
    assert expired_response.status_code == 401
    assert tampered_response.status_code == 401
    assert expired_response.json() == tampered_response.json() == missing.json() == UNAUTHENTICATED


async def test_token_with_a_different_session_version_is_rejected(
    client: tuple[object, AsyncClient],
) -> None:
    app, http = client
    token = jwt.encode(
        {
            "sub": ADMIN_USERNAME,
            "sv": 2,
            "iat": datetime.now(UTC),
            "exp": datetime.now(UTC) + timedelta(days=1),
        },
        app.state.settings.session_secret,
        algorithm="HS256",
    )
    http.cookies.set("notes_session", token)
    response = await http.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json() == UNAUTHENTICATED


async def test_token_for_a_different_subject_is_rejected(client: tuple[object, AsyncClient]) -> None:
    app, http = client
    token = jwt.encode(
        {
            "sub": "someone-else",
            "sv": 1,
            "iat": datetime.now(UTC),
            "exp": datetime.now(UTC) + timedelta(days=1),
        },
        app.state.settings.session_secret,
        algorithm="HS256",
    )
    http.cookies.set("notes_session", token)
    response = await http.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json() == UNAUTHENTICATED


async def test_post_with_a_foreign_origin_is_forbidden(client: tuple[object, AsyncClient]) -> None:
    _app, http = client
    response = await login(http, headers={"Origin": "https://evil.example"})
    assert response.status_code == 403
    assert response.json() == {"detail": "Origin is not allowed", "code": "bad_origin"}


async def test_post_with_the_allowed_origin_can_log_in(client: tuple[object, AsyncClient]) -> None:
    _app, http = client
    response = await login(http, headers={"Origin": ALLOWED_ORIGIN})
    assert response.status_code == 200


async def test_logout_clears_the_cookie_with_or_without_a_session(
    client: tuple[object, AsyncClient],
) -> None:
    _app, http = client
    anonymous = await http.post("/api/auth/logout")
    assert anonymous.status_code == 204
    assert anonymous.content == b""
    assert cookie_attributes(anonymous)["max-age"] == "0"

    assert (await login(http)).status_code == 200
    assert (await http.get("/api/auth/me")).status_code == 200
    signed_out = await http.post("/api/auth/logout")
    assert signed_out.status_code == 204
    assert cookie_attributes(signed_out)["max-age"] == "0"
    assert (await http.get("/api/auth/me")).status_code == 401


async def test_login_validation_error_shape(client: tuple[object, AsyncClient]) -> None:
    _app, http = client
    response = await http.post("/api/auth/login", json={})
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert isinstance(body["detail"], list)
    assert body["detail"]
    assert "loc" in body["detail"][0]
    assert "msg" in body["detail"][0]
