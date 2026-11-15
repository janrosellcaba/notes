"""Item routes, including the AI stub."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Response
from fastapi.responses import JSONResponse

from app.db import Database
from app.deps import get_current_user, get_db
from app.schemas.ai import AIProcessResult, PlannedEffects
from app.schemas.item import (
    DueFilter,
    ExtractTask,
    Item,
    ItemCreate,
    ItemList,
    ItemMove,
    ItemStatus,
    ItemType,
    ItemUpdate,
)
from app.services import items

router = APIRouter(prefix="/api/items", tags=["items"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=ItemList)
async def list_items(
    type: ItemType | None = None,
    project_id: str | None = None,
    context_id: str | None = None,
    pinned: bool | None = None,
    status: ItemStatus | None = None,
    due: DueFilter | None = None,
    today: str | None = None,
    include_done: bool = False,
    archived: bool = False,
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = None,
    db: Database = Depends(get_db),
) -> ItemList:
    found, next_cursor = await items.list_items(
        db,
        type=type,
        project_id=project_id,
        context_id=context_id,
        pinned=pinned,
        status=status,
        due=due,
        today=today,
        include_done=include_done,
        archived=archived,
        limit=limit,
        cursor=cursor,
    )
    return ItemList(items=found, next_cursor=next_cursor)


@router.post("", response_model=Item, status_code=201)
async def create_item(
    body: ItemCreate,
    response: Response,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    db: Database = Depends(get_db),
) -> Item:
    item, created = await items.create_item(db, body, idempotency_key=idempotency_key)
    if not created:
        response.status_code = 200
    return item


@router.get("/{item_id}", response_model=Item)
async def get_item(item_id: str, db: Database = Depends(get_db)) -> Item:
    return await items.get_item(db, item_id)


@router.patch("/{item_id}", response_model=Item)
async def update_item(item_id: str, body: ItemUpdate, db: Database = Depends(get_db)) -> Item:
    return await items.update_item(db, item_id, body.model_dump(exclude_unset=True))


@router.delete("/{item_id}", status_code=204)
async def delete_item(item_id: str, db: Database = Depends(get_db)) -> Response:
    await items.delete_item(db, item_id)
    return Response(status_code=204)


@router.post("/{item_id}/archive", response_model=Item)
async def archive_item(item_id: str, db: Database = Depends(get_db)) -> Item:
    return await items.set_archived(db, item_id, archived=True)


@router.post("/{item_id}/unarchive", response_model=Item)
async def unarchive_item(item_id: str, db: Database = Depends(get_db)) -> Item:
    return await items.set_archived(db, item_id, archived=False)


@router.post("/{item_id}/convert-to-task", response_model=Item)
async def convert_to_task(item_id: str, db: Database = Depends(get_db)) -> Item:
    return await items.convert_to_task(db, item_id)


@router.post("/{item_id}/extract-task", response_model=Item, status_code=201)
async def extract_task(item_id: str, body: ExtractTask, db: Database = Depends(get_db)) -> Item:
    return await items.extract_task(db, item_id, body)


@router.post("/{item_id}/move", response_model=Item)
async def move_item(item_id: str, body: ItemMove, db: Database = Depends(get_db)) -> Item:
    return await items.move_item(
        db,
        item_id,
        status=body.status,
        before_id=body.before_id,
        after_id=body.after_id,
    )


@router.post("/{item_id}/ai-process", status_code=501)
async def ai_process(item_id: str, db: Database = Depends(get_db)) -> JSONResponse:
    await items.get_item(db, item_id)
    payload = AIProcessResult(
        detail="AI processing is not configured",
        code="ai_not_configured",
        item_id=item_id,
        planned_effects=PlannedEffects(
            writes=["ai_summary", "ai_action_items"],
            may_create="tasks with source_item_id",
        ),
    )
    return JSONResponse(status_code=501, content=payload.model_dump())
