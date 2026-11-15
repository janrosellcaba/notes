"""Username and password session routes."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, Request
from starlette.responses import Response

from app.db import Database
from app.deps import get_current_user
from app.errors import AppError
from app.schemas.auth import AuthUser, LoginRequest
from app.security import (
    LoginRateLimiter,
    clear_session_cookie,
    client_ip,
    create_access_token,
    secrets_match,
    set_session_cookie,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=AuthUser)
async def login(body: LoginRequest, request: Request, response: Response) -> AuthUser:
    settings = request.app.state.settings
    limiter: LoginRateLimiter = request.app.state.rate_limiter
    ip = client_ip(request, trust_proxy=settings.trust_proxy)
    username_ok = secrets_match(body.username, settings.admin_username)
    password_ok = await asyncio.to_thread(
        verify_password,
        request.app.state.password_hash,
        body.password,
    )
    outcome = await limiter.evaluate(ip, credentials_ok=username_ok and password_ok)
    if outcome == "blocked":
        raise AppError(429, "Too many attempts. Wait a few minutes.", "rate_limited")
    if outcome != "ok":
        raise AppError(401, "Invalid username or password", "invalid_credentials")

    database: Database = request.app.state.db
    row = await database.fetchone("SELECT value FROM app_meta WHERE key = 'session_version'")
    if row is None:
        raise AppError(500, "Session version is missing", "internal_error")
    token = create_access_token(
        username=settings.admin_username,
        session_version=int(row["value"]),
        secret=settings.session_secret,
    )
    set_session_cookie(response, token, secure=settings.cookie_secure)
    return AuthUser(username=settings.admin_username)


@router.get("/me", response_model=AuthUser)
async def me(username: str = Depends(get_current_user)) -> AuthUser:
    return AuthUser(username=username)


@router.post("/logout", status_code=204)
async def logout(request: Request) -> Response:
    response = Response(status_code=204)
    clear_session_cookie(response, secure=request.app.state.settings.cookie_secure)
    return response
