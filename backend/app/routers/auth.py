"""Username and password session routes."""

from __future__ import annotations

import asyncio
import sqlite3
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, Request
from starlette.responses import Response

from app.db import Database
from app.deps import CurrentUser, get_current_user
from app.errors import AppError
from app.schemas.auth import AuthUser, LoginRequest, PasswordChangeRequest, RegisterRequest
from app.security import (
    LoginRateLimiter,
    clear_session_cookie,
    client_ip,
    create_access_token,
    hash_password,
    secrets_match,
    set_session_cookie,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.000Z")


async def ensure_admin_user(database: Database, username: str, password_hash: str) -> None:
    """Create the env admin the first time. Later password changes stay in the database."""
    existing = await database.fetchone("SELECT id FROM users WHERE username = ?", (username,))
    if existing is not None:
        return
    await database.execute(
        """
        INSERT INTO users (id, username, password_hash, session_version, created_at)
        VALUES (?, ?, ?, 1, ?)
        """,
        (str(uuid4()), username, password_hash, _now()),
    )


def _issue(request: Request, response: Response, username: str, session_version: int) -> AuthUser:
    settings = request.app.state.settings
    token = create_access_token(
        username=username,
        session_version=session_version,
        secret=settings.session_secret,
    )
    set_session_cookie(response, token, secure=settings.cookie_secure)
    return AuthUser(username=username)


@router.post("/login", response_model=AuthUser)
async def login(body: LoginRequest, request: Request, response: Response) -> AuthUser:
    settings = request.app.state.settings
    limiter: LoginRateLimiter = request.app.state.rate_limiter
    database: Database = request.app.state.db
    ip = client_ip(request, trust_proxy=settings.trust_proxy)
    row = await database.fetchone(
        "SELECT username, password_hash, session_version FROM users WHERE username = ?",
        (body.username,),
    )
    password_ok = await asyncio.to_thread(
        verify_password,
        str(row["password_hash"]) if row is not None else request.app.state.password_hash,
        body.password,
    )
    outcome = await limiter.evaluate(ip, credentials_ok=row is not None and password_ok)
    if outcome == "blocked":
        raise AppError(429, "Too many attempts. Wait a few minutes.", "rate_limited")
    if outcome != "ok" or row is None:
        raise AppError(401, "Invalid username or password", "invalid_credentials")

    return _issue(request, response, str(row["username"]), int(row["session_version"]))


@router.post("/register", response_model=AuthUser, status_code=201)
async def register(body: RegisterRequest, request: Request, response: Response) -> AuthUser:
    settings = request.app.state.settings
    limiter: LoginRateLimiter = request.app.state.rate_limiter
    database: Database = request.app.state.db
    ip = client_ip(request, trust_proxy=settings.trust_proxy)
    code_ok = bool(settings.signup_code) and secrets_match(body.code, settings.signup_code)
    outcome = await limiter.evaluate(ip, credentials_ok=code_ok)
    if outcome == "blocked":
        raise AppError(429, "Too many attempts. Wait a few minutes.", "rate_limited")
    if not code_ok:
        raise AppError(403, "Invalid code", "invalid_code")

    taken = await database.fetchone(
        "SELECT id FROM users WHERE lower(username) = lower(?)",
        (body.username,),
    )
    if taken is not None:
        raise AppError(409, "That username is taken", "username_taken")

    password_hash = await asyncio.to_thread(hash_password, body.password)
    user_id = str(uuid4())
    try:
        await database.execute(
            """
            INSERT INTO users (id, username, password_hash, session_version, created_at)
            VALUES (?, ?, ?, 1, ?)
            """,
            (user_id, body.username, password_hash, _now()),
        )
    except sqlite3.IntegrityError as exc:
        raise AppError(409, "That username is taken", "username_taken") from exc
    from app import tenancy

    await tenancy.ensure_user_contexts(database, user_id)
    return _issue(request, response, body.username, 1)


@router.post("/password", response_model=AuthUser)
async def change_password(
    body: PasswordChangeRequest,
    request: Request,
    response: Response,
    user: CurrentUser = Depends(get_current_user),
) -> AuthUser:
    database: Database = request.app.state.db
    row = await database.fetchone(
        "SELECT password_hash, session_version FROM users WHERE id = ?",
        (user.id,),
    )
    if row is None:
        raise AppError(401, "Unauthenticated", "unauthenticated")
    current_ok = await asyncio.to_thread(verify_password, str(row["password_hash"]), body.current_password)
    if not current_ok:
        raise AppError(400, "Current password is wrong", "invalid_credentials")
    password_hash = await asyncio.to_thread(hash_password, body.new_password)
    session_version = int(row["session_version"]) + 1
    await database.execute(
        "UPDATE users SET password_hash = ?, session_version = ? WHERE id = ?",
        (password_hash, session_version, user.id),
    )
    return _issue(request, response, user.username, session_version)


@router.get("/me", response_model=AuthUser)
async def me(user: CurrentUser = Depends(get_current_user)) -> AuthUser:
    return AuthUser(username=user.username)


@router.post("/logout", status_code=204)
async def logout(request: Request) -> Response:
    response = Response(status_code=204)
    clear_session_cookie(response, secure=request.app.state.settings.cookie_secure)
    return response
