"""Project routes."""

from fastapi import APIRouter, Depends, Response

from app.db import Database
from app.deps import CurrentUser, get_current_user, get_db
from app.schemas.project import Project, ProjectCreate, ProjectList, ProjectUpdate
from app.services import projects

router = APIRouter(prefix="/api/projects", tags=["projects"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=ProjectList)
async def list_projects(
    context_id: str | None = None,
    include_archived: bool = False,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> ProjectList:
    return ProjectList(
        projects=await projects.list_projects(
            db, user.id, context_id=context_id, include_archived=include_archived
        )
    )


@router.post("", response_model=Project, status_code=201)
async def create_project(
    body: ProjectCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Project:
    return await projects.create_project(
        db,
        user.id,
        name=body.name,
        context_id=body.context_id,
        color=body.color,
        due_on=body.due_on,
    )


@router.get("/{project_id}", response_model=Project)
async def get_project(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Project:
    return await projects.get_project(db, user.id, project_id)


@router.patch("/{project_id}", response_model=Project)
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Project:
    return await projects.update_project(db, user.id, project_id, body.model_dump(exclude_unset=True))


@router.post("/{project_id}/archive", response_model=Project)
async def archive_project(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Project:
    return await projects.set_archived(db, user.id, project_id, archived=True)


@router.post("/{project_id}/unarchive", response_model=Project)
async def unarchive_project(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Project:
    return await projects.set_archived(db, user.id, project_id, archived=False)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Response:
    await projects.delete_project(db, user.id, project_id)
    return Response(status_code=204)
