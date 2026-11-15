"""Process settings loaded from the environment."""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

MIN_SESSION_SECRET_BYTES = 32
DEFAULT_TIMEZONE = "Europe/Madrid"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    admin_username: str = ""
    admin_password_hash: str = ""
    admin_password: str = ""
    signup_code: str = ""
    session_secret: str = ""
    cookie_secure: bool = True
    allowed_origins: str = "https://notes.janrosell.com"
    trust_proxy: bool = True
    user_timezone: str = DEFAULT_TIMEZONE
    data_dir: Path = Path("/data")

    ai_api_key: str = ""
    google_calendar_client_id: str = ""
    ms_graph_client_id: str = ""

    @property
    def database_path(self) -> Path:
        return self.data_dir / "notes.db"

    @property
    def allowed_origin_list(self) -> list[str]:
        return [part.strip() for part in self.allowed_origins.split(",") if part.strip()]


def validate_startup(settings: Settings) -> None:
    """Exit the process when required secrets or credentials are missing."""
    secret_bytes = len(settings.session_secret.encode("utf-8"))
    if secret_bytes < MIN_SESSION_SECRET_BYTES:
        raise SystemExit(
            f"SESSION_SECRET must be at least {MIN_SESSION_SECRET_BYTES} bytes"
        )
    if not settings.admin_username.strip():
        raise SystemExit("ADMIN_USERNAME is required")
    if not settings.admin_password_hash.strip() and not settings.admin_password:
        raise SystemExit("Set ADMIN_PASSWORD_HASH or ADMIN_PASSWORD")
