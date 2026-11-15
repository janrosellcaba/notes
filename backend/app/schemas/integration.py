"""Integration status payloads. Secrets are never returned."""

from pydantic import BaseModel


class AIIntegration(BaseModel):
    configured: bool
    provider: str | None = None


class CalendarIntegration(BaseModel):
    configured: bool


class Integrations(BaseModel):
    ai: AIIntegration
    google_calendar: CalendarIntegration
    microsoft_calendar: CalendarIntegration
