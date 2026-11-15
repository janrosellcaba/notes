"""Database exports."""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, Response

from app.db import Database
from app.deps import get_current_user, get_db
from app.services import backup

router = APIRouter(prefix="/api/backup", tags=["backup"], dependencies=[Depends(get_current_user)])


@router.get("/json")
async def download_json(db: Database = Depends(get_db)) -> JSONResponse:
    payload, filename = await backup.export_json(db)
    return JSONResponse(
        content=payload,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/sqlite")
async def download_sqlite(db: Database = Depends(get_db)) -> Response:
    data, filename = await backup.export_sqlite(db)
    return Response(
        content=data,
        media_type="application/vnd.sqlite3",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )
