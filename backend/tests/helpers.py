"""Shared values for the API tests."""

from __future__ import annotations

from pathlib import Path

from app.config import Settings

ADMIN_USERNAME = "jan"
ADMIN_PASSWORD = "s3cret-password"
ALLOWED_ORIGIN = "https://notes.janrosell.com"


def build_settings(data_dir: Path, password_hash: str, **overrides: object) -> Settings:
    values: dict[str, object] = {
        "admin_username": ADMIN_USERNAME,
        "admin_password_hash": password_hash,
        "admin_password": "",
        "session_secret": "s" * 32,
        "cookie_secure": False,
        "allowed_origins": ALLOWED_ORIGIN,
        "trust_proxy": True,
        "user_timezone": "Europe/Madrid",
        "data_dir": data_dir,
    }
    values.update(overrides)
    return Settings(**values)
