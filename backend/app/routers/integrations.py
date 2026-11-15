"""Read-only integration status. No secrets leave the process."""

from fastapi import APIRouter, Depends, Request

from app.deps import get_current_user
from app.schemas.integration import AIIntegration, CalendarIntegration, Integrations

router = APIRouter(
    prefix="/api/integrations",
    tags=["integrations"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=Integrations)
async def read_integrations(request: Request) -> Integrations:
    settings = request.app.state.settings
    return Integrations(
        ai=AIIntegration(configured=bool(settings.ai_api_key.strip()), provider=None),
        google_calendar=CalendarIntegration(configured=bool(settings.google_calendar_client_id.strip())),
        microsoft_calendar=CalendarIntegration(configured=bool(settings.ms_graph_client_id.strip())),
    )
