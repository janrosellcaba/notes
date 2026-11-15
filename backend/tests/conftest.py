"""Temporary database and HTTP client for Milestone 1."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import Settings
from app.main import create_app
from app.security import hash_password
from tests.helpers import ADMIN_PASSWORD, ADMIN_USERNAME, build_settings


@pytest.fixture(scope="session")
def admin_password_hash() -> str:
    return hash_password(ADMIN_PASSWORD)


@asynccontextmanager
async def running_app(settings: Settings) -> AsyncIterator[tuple[object, AsyncClient]]:
    application = create_app(settings)
    async with application.router.lifespan_context(application):
        transport = ASGITransport(app=application)
        async with AsyncClient(transport=transport, base_url="http://test") as http:
            yield application, http


@pytest.fixture
async def client(tmp_path: Path, admin_password_hash: str) -> AsyncIterator[tuple[object, AsyncClient]]:
    settings = build_settings(tmp_path, admin_password_hash)
    async with running_app(settings) as stack:
        yield stack


@pytest.fixture
async def secure_client(
    tmp_path: Path, admin_password_hash: str
) -> AsyncIterator[tuple[object, AsyncClient]]:
    settings = build_settings(tmp_path, admin_password_hash, cookie_secure=True)
    async with running_app(settings) as stack:
        yield stack


@pytest.fixture
async def authed(client: tuple[object, AsyncClient]) -> AsyncIterator[tuple[object, AsyncClient]]:
    application, http = client
    response = await http.post(
        "/api/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
    )
    assert response.status_code == 200, response.text
    yield application, http


@pytest.fixture
async def untrusted_client(
    tmp_path: Path, admin_password_hash: str
) -> AsyncIterator[tuple[object, AsyncClient]]:
    settings = build_settings(tmp_path, admin_password_hash, trust_proxy=False)
    async with running_app(settings) as stack:
        yield stack
