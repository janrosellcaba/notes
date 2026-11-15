"""Full-text search."""

from fastapi import APIRouter, Depends, Query

from app.db import Database
from app.deps import get_current_user, get_db
from app.schemas.search import SearchResults
from app.services import search

router = APIRouter(prefix="/api/search", tags=["search"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=SearchResults)
async def search_items(
    q: str = Query(min_length=1),
    context_id: str | None = None,
    limit: int = Query(default=20, ge=1, le=50),
    db: Database = Depends(get_db),
) -> SearchResults:
    return SearchResults(results=await search.search_items(db, query=q, context_id=context_id, limit=limit))
