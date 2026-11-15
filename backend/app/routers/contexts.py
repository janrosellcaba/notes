"""Context routes."""

from fastapi import APIRouter, Depends

from app.db import Database
from app.deps import get_current_user, get_db
from app.schemas.context import Context, ContextList, ContextUpdate
from app.services import contexts

router = APIRouter(prefix="/api/contexts", tags=["contexts"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=ContextList)
async def list_contexts(db: Database = Depends(get_db)) -> ContextList:
    return ContextList(contexts=await contexts.list_contexts(db))


@router.patch("/{context_id}", response_model=Context)
async def update_context(
    context_id: str,
    body: ContextUpdate,
    db: Database = Depends(get_db),
) -> Context:
    return await contexts.update_context(db, context_id, body.model_dump(exclude_unset=True))
