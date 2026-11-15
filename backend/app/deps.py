"""Request dependencies for the database handle and the signed-in admin."""

from __future__ import annotations

from fastapi import Request

from app.config import Settings
from app.db import Database
from app.errors import AppError
from app.security import COOKIE_NAME, decode_access_token


def get_db(request: Request) -> Database:
    return request.app.state.db


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


async def get_current_user(request: Request) -> str:
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
        "SELECT username, session_version FROM users WHERE username = ?",
        (subject,),
    )
    if row is None or session_version != int(row["session_version"]):
        raise AppError(401, "Unauthenticated", "unauthenticated")
    return str(row["username"])
