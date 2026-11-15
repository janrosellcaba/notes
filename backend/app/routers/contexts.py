"""Context routes."""

from fastapi import APIRouter, Depends, Response

from app.db import Database
from app.deps import CurrentUser, get_current_user, get_db
from app.errors import field_error
from app.schemas.context import Context, ContextCreate, ContextList, ContextUpdate
from app.services import contexts

router = APIRouter(prefix="/api/contexts", tags=["contexts"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=ContextList)
async def list_contexts(user: CurrentUser = Depends(get_current_user), db: Database = Depends(get_db)) -> ContextList:
    return ContextList(contexts=await contexts.list_contexts(db, user.id))


@router.post("", response_model=Context, status_code=201)
async def create_context(
    body: ContextCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Context:
    return await contexts.create_context(db, user.id, name=body.name, color=body.color, icon=body.icon)


@router.delete("/{context_id}", status_code=204)
async def delete_context(
    context_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Response:
    await contexts.delete_context(db, user.id, context_id)
    return Response(status_code=204)


@router.post("/{context_id}/move", response_model=Context)
async def move_context(
    context_id: str,
    direction: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Context:
    if direction not in ("up", "down"):
        field_error("direction", "direction must be up or down")
    return await contexts.move_context(db, user.id, context_id, direction=-1 if direction == "up" else 1)


@router.patch("/{context_id}", response_model=Context)
async def update_context(
    context_id: str,
    body: ContextUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Context:
    return await contexts.update_context(db, user.id, context_id, body.model_dump(exclude_unset=True))
