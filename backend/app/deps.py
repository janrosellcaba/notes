"""Request dependencies for the database handle and the signed-in user."""

from __future__ import annotations

from typing import NamedTuple

from fastapi import Request

from app.config import Settings
from app.db import Database
from app.errors import AppError
from app.security import COOKIE_NAME, decode_access_token, secrets_match


class CurrentUser(NamedTuple):
    id: str
    username: str


def get_db(request: Request) -> Database:
    return request.app.state.db


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


async def _api_token_user(request: Request) -> CurrentUser | None:
    """Return the admin user when a valid ``Authorization: Bearer`` API token is sent."""
    settings: Settings = request.app.state.settings
    header = request.headers.get("authorization", "")
    scheme, _, supplied = header.partition(" ")
    configured = settings.api_token.strip()
    if scheme.lower() != "bearer" or not configured or not supplied.strip():
        return None
    if not secrets_match(supplied.strip(), configured):
        raise AppError(401, "Unauthenticated", "unauthenticated")
    database: Database = request.app.state.db
    row = await database.fetchone(
        "SELECT id, username FROM users WHERE username = ?",
        (settings.admin_username.strip(),),
    )
    if row is None:
        raise AppError(401, "Unauthenticated", "unauthenticated")
    return CurrentUser(id=str(row["id"]), username=str(row["username"]))


async def get_current_user(request: Request) -> CurrentUser:
    api_user = await _api_token_user(request)
    if api_user is not None:
        return api_user
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise AppError(401, "Unauthenticated", "unauthenticated")
    settings = request.app.state.settings
    try:
        payload = decode_access_token(token, settings.session_secret)
        subject = payload["sub"]
        session_version = payload["sv"]
        if not isinstance(subject, str) or not isinstance(session_version, int):
            raise AppError(401, "Unauthenticated", "unauthenticated")
    except AppError:
        raise
    except Exception as exc:
        raise AppError(401, "Unauthenticated", "unauthenticated") from exc
    database: Database = request.app.state.db
    row = await database.fetchone(
        "SELECT id, username, session_version FROM users WHERE username = ?",
        (subject,),
    )
    if row is None or session_version != int(row["session_version"]):
        raise AppError(401, "Unauthenticated", "unauthenticated")
    return CurrentUser(id=str(row["id"]), username=str(row["username"]))
