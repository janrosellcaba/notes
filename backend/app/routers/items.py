"""Item routes, including the AI stub."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, Header, Query, Response, UploadFile
from fastapi.responses import JSONResponse

from app.db import Database
from app.deps import CurrentUser, get_current_user, get_db
from app.schemas.ai import AIProcessResult, PlannedEffects
from app.schemas.item import (
    AttachmentMeta,
    DueFilter,
    ExtractTask,
    Item,
    ItemCreate,
    ItemList,
    ItemMove,
    ItemRef,
    ItemStatus,
    ItemType,
    ItemUpdate,
)
from app.services import attachments, items

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
    trashed: bool = False,
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = None,
    parent_id: str | None = None,
    roots: bool = False,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> ItemList:
    found, next_cursor = await items.list_items(
        db,
        user.id,
        type=type,
        project_id=project_id,
        context_id=context_id,
        pinned=pinned,
        status=status,
        due=due,
        today=today,
        include_done=include_done,
        archived=archived,
        trashed=trashed,
        limit=limit,
        cursor=cursor,
        parent_id=parent_id,
        roots=roots,
    )
    return ItemList(items=found, next_cursor=next_cursor)


@router.post("", response_model=Item, status_code=201)
async def create_item(
    body: ItemCreate,
    response: Response,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Item:
    item, created = await items.create_item(db, user.id, body, idempotency_key=idempotency_key)
    if not created:
        response.status_code = 200
    return item


@router.get("/trash", response_model=ItemList)
async def trash(user: CurrentUser = Depends(get_current_user), db: Database = Depends(get_db)) -> ItemList:
    found, _cursor = await items.list_items(
        db,
        user.id,
        type=None,
        project_id=None,
        context_id=None,
        pinned=None,
        status=None,
        due=None,
        today=None,
        include_done=True,
        archived=False,
        trashed=True,
        limit=200,
        cursor=None,
    )
    return ItemList(items=found, next_cursor=None)


@router.get("/lookup", response_model=ItemRef)
async def lookup(
    title: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> ItemRef:
    item = await items.lookup_title(db, user.id, title)
    return ItemRef(id=item.id, type=item.type, title=item.title)


@router.put("/daily/{day}", response_model=Item)
async def ensure_daily(
    day: str,
    response: Response,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Item:
    item, created = await items.ensure_daily(db, user.id, day)
    response.status_code = 201 if created else 200
    return item


@router.get("/{item_id}", response_model=Item)
async def get_item(
    item_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Item:
    return await items.get_item(db, user.id, item_id)


@router.patch("/{item_id}", response_model=Item)
async def update_item(
    item_id: str,
    body: ItemUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Item:
    return await items.update_item(db, user.id, item_id, body.model_dump(exclude_unset=True))


@router.delete("/{item_id}", status_code=204)
async def delete_item(
    item_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Response:
    await items.delete_item(db, user.id, item_id)
    return Response(status_code=204)


@router.post("/{item_id}/restore", response_model=Item)
async def restore_item(
    item_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Item:
    return await items.restore_item(db, user.id, item_id)


@router.delete("/{item_id}/permanent", status_code=204)
async def purge_item(
    item_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Response:
    await items.purge_item(db, user.id, item_id)
    return Response(status_code=204)


@router.get("/{item_id}/backlinks", response_model=ItemList)
async def backlinks(
    item_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> ItemList:
    found = await items.backlinks(db, user.id, item_id)
    return ItemList(items=found, next_cursor=None)


@router.get("/{item_id}/attachments", response_model=list[AttachmentMeta])
async def list_attachments(
    item_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> list[AttachmentMeta]:
    return await attachments.list_attachments(db, user.id, item_id)


@router.post("/{item_id}/attachments", response_model=AttachmentMeta, status_code=201)
async def upload_attachment(
    item_id: str,
    file: Annotated[UploadFile, File()],
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> AttachmentMeta:
    data = await file.read()
    return await attachments.add_attachment(
        db,
        user.id,
        item_id,
        filename=file.filename or "file",
        content_type=file.content_type or "",
        data=data,
    )


@router.get("/{item_id}/attachments/{attachment_id}")
async def download_attachment(
    item_id: str,
    attachment_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Response:
    meta, data = await attachments.read_attachment(db, user.id, item_id, attachment_id)
    return Response(
        content=data,
        media_type=meta.content_type,
        headers={"Content-Disposition": f'inline; filename="{meta.filename}"'},
    )


@router.delete("/{item_id}/attachments/{attachment_id}", status_code=204)
async def remove_attachment(
    item_id: str,
    attachment_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Response:
    await attachments.delete_attachment(db, user.id, item_id, attachment_id)
    return Response(status_code=204)


@router.post("/{item_id}/archive", response_model=Item)
async def archive_item(
    item_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Item:
    return await items.set_archived(db, user.id, item_id, archived=True)


@router.post("/{item_id}/unarchive", response_model=Item)
async def unarchive_item(
    item_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Item:
    return await items.set_archived(db, user.id, item_id, archived=False)


@router.post("/{item_id}/convert-to-task", response_model=Item)
async def convert_to_task(
    item_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Item:
    return await items.convert_to_task(db, user.id, item_id)


@router.post("/{item_id}/extract-task", response_model=Item, status_code=201)
async def extract_task(
    item_id: str,
    body: ExtractTask,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Item:
    return await items.extract_task(db, user.id, item_id, body)


@router.post("/{item_id}/move", response_model=Item)
async def move_item(
    item_id: str,
    body: ItemMove,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Item:
    return await items.move_item(
        db,
        user.id,
        item_id,
        status=body.status,
        before_id=body.before_id,
        after_id=body.after_id,
    )


@router.post("/{item_id}/ai-process", status_code=501)
async def ai_process(
    item_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> JSONResponse:
    await items.get_item(db, user.id, item_id)
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
