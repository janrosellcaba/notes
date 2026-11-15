"""Settings payloads."""

from pydantic import BaseModel, ConfigDict


class SettingsView(BaseModel):
    timezone: str
    schema_version: int


class SettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timezone: str
