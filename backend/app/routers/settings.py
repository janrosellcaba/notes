"""Timezone and schema settings."""

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends

from app.db import Database, SCHEMA_VERSION
from app.deps import get_current_user, get_db
from app.errors import field_error
from app.schemas.settings import SettingsUpdate, SettingsView

router = APIRouter(prefix="/api/settings", tags=["settings"], dependencies=[Depends(get_current_user)])


async def _view(db: Database) -> SettingsView:
    row = await db.fetchone("SELECT value FROM app_meta WHERE key = 'timezone'")
    timezone = "Europe/Madrid" if row is None else str(row["value"])
    return SettingsView(timezone=timezone, schema_version=int(SCHEMA_VERSION))


@router.get("", response_model=SettingsView)
async def read_settings(db: Database = Depends(get_db)) -> SettingsView:
    return await _view(db)


@router.patch("", response_model=SettingsView)
async def update_settings(body: SettingsUpdate, db: Database = Depends(get_db)) -> SettingsView:
    changes = body.model_dump(exclude_unset=True)
    timezone = changes.get("timezone", "")
    try:
        ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError):
        field_error("timezone", "Unknown timezone")
    await db.execute("UPDATE app_meta SET value = ? WHERE key = 'timezone'", (timezone,))
    return await _view(db)
