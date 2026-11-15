"""Home feed."""

from fastapi import APIRouter, Depends, Query

from app.db import Database
from app.deps import get_current_user, get_db
from app.schemas.home import HomeFeed
from app.services import home

router = APIRouter(prefix="/api/home", tags=["home"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=HomeFeed)
async def read_home(
    today: str = Query(min_length=1),
    context_id: str | None = None,
    db: Database = Depends(get_db),
) -> HomeFeed:
    return await home.home_feed(db, context_id=context_id, today=today)
