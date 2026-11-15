"""Project routes."""

from fastapi import APIRouter, Depends, Response

from app.db import Database
from app.deps import get_current_user, get_db
from app.schemas.project import Project, ProjectCreate, ProjectList, ProjectUpdate
from app.services import projects

router = APIRouter(prefix="/api/projects", tags=["projects"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=ProjectList)
async def list_projects(
    context_id: str | None = None,
    include_archived: bool = False,
    db: Database = Depends(get_db),
) -> ProjectList:
    return ProjectList(
        projects=await projects.list_projects(db, context_id=context_id, include_archived=include_archived)
    )


@router.post("", response_model=Project, status_code=201)
async def create_project(body: ProjectCreate, db: Database = Depends(get_db)) -> Project:
    return await projects.create_project(db, name=body.name, context_id=body.context_id, color=body.color)


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str, db: Database = Depends(get_db)) -> Project:
    return await projects.get_project(db, project_id)


@router.patch("/{project_id}", response_model=Project)
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    db: Database = Depends(get_db),
) -> Project:
    return await projects.update_project(db, project_id, body.model_dump(exclude_unset=True))


@router.post("/{project_id}/archive", response_model=Project)
async def archive_project(project_id: str, db: Database = Depends(get_db)) -> Project:
    return await projects.set_archived(db, project_id, archived=True)


@router.post("/{project_id}/unarchive", response_model=Project)
async def unarchive_project(project_id: str, db: Database = Depends(get_db)) -> Project:
    return await projects.set_archived(db, project_id, archived=False)


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, db: Database = Depends(get_db)) -> Response:
    await projects.delete_project(db, project_id)
    return Response(status_code=204)
