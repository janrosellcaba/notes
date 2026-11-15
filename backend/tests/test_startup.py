"""Process startup refusals."""

from pathlib import Path

import pytest

from app.main import create_app
from app.security import hash_password, main, verify_password
from tests.helpers import ADMIN_PASSWORD, build_settings


def test_session_secret_shorter_than_32_bytes_exits(tmp_path: Path, admin_password_hash: str) -> None:
    settings = build_settings(tmp_path, admin_password_hash, session_secret="x" * 31)
    with pytest.raises(SystemExit) as caught:
        create_app(settings)
    assert "SESSION_SECRET" in str(caught.value)


def test_empty_admin_username_exits(tmp_path: Path, admin_password_hash: str) -> None:
    settings = build_settings(tmp_path, admin_password_hash, admin_username="   ")
    with pytest.raises(SystemExit) as caught:
        create_app(settings)
    assert "ADMIN_USERNAME" in str(caught.value)


def test_missing_password_exits(tmp_path: Path) -> None:
    settings = build_settings(tmp_path, "", admin_password="", admin_password_hash="")
    with pytest.raises(SystemExit) as caught:
        create_app(settings)
    assert "ADMIN_PASSWORD" in str(caught.value)


def test_hash_password_cli(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    monkeypatch.setattr("app.security.getpass.getpass", lambda prompt="": "correct horse")
    main(["hash-password"])
    encoded = capsys.readouterr().out.strip()
    assert encoded.startswith("$argon2id$")
    assert verify_password(encoded, "correct horse")
    assert hash_password("correct horse") != encoded


def test_hash_password_cli_rejects_unknown_args() -> None:
    with pytest.raises(SystemExit) as caught:
        main(["nope"])
    assert "usage:" in str(caught.value)


def test_plaintext_password_logs_one_warning_without_the_secret(
    tmp_path: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    import asyncio
    import logging

    from app.main import lifespan

    settings = build_settings(
        tmp_path,
        "",
        admin_password=ADMIN_PASSWORD,
        admin_password_hash="",
    )
    application = create_app(settings)
    caplog.set_level(logging.WARNING, logger="app.security")

    async def _boot() -> None:
        async with lifespan(application):
            return None

    asyncio.run(_boot())
    matches = [record for record in caplog.records if "ADMIN_PASSWORD_HASH" in record.getMessage()]
    assert len(matches) == 1
    assert ADMIN_PASSWORD not in matches[0].getMessage()
