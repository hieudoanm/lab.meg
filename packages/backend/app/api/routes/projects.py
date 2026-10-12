"""Project and sharing routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import (
    get_db,
    get_page_params,
    require_authenticated_user,
)
from app.schemas.common import UserPublic
from app.schemas.projects import (
    Project,
    ProjectCreate,
    ProjectInvitation,
    ProjectInvitationCreate,
    ProjectList,
    ProjectMember,
    ProjectMemberRoleUpdate,
    Share,
    ShareCreate,
)
from app.services import projects as project_service

router = APIRouter()


@router.get("/projects")
async def list_projects(
    conn=Depends(get_db),
    user: UserPublic = Depends(require_authenticated_user),
    page=Depends(get_page_params),
) -> ProjectList:
    items, next_cursor, has_more = await project_service.list_projects(
        conn, user_id=user.id, limit=page.limit, cursor=page.cursor
    )
    return ProjectList(items=items, next_cursor=next_cursor, has_more=has_more)


@router.post("/projects", status_code=201)
async def create_project(
    request: ProjectCreate,
    conn=Depends(get_db),
    user: UserPublic = Depends(require_authenticated_user),
) -> Project:
    return await project_service.create_project(conn, user_id=user.id, request=request)


@router.post("/projects/{project_id}/shares", status_code=201)
async def create_share(
    project_id: str,
    request: ShareCreate,
    conn=Depends(get_db),
    user: UserPublic = Depends(require_authenticated_user),
) -> Share:
    return await project_service.create_share(
        conn, project_id=project_id, user_id=user.id, request=request
    )


@router.get("/projects/{project_id}")
async def get_project(
    project_id: str,
    conn=Depends(get_db),
    user: UserPublic = Depends(require_authenticated_user),
) -> Project:
    return await project_service.get_project(conn, project_id=project_id, user_id=user.id)


@router.get("/projects/{project_id}/members")
async def list_members(
    project_id: str,
    conn=Depends(get_db),
    user: UserPublic = Depends(require_authenticated_user),
) -> dict:
    members = await project_service.list_project_members(
        conn, project_id=project_id, user_id=user.id
    )
    return {
        "items": [member.model_dump(mode="json") for member in members],
        "next_cursor": None,
        "has_more": False,
    }


@router.post("/projects/{project_id}/invitations", status_code=201)
async def invite_member(
    project_id: str,
    request: ProjectInvitationCreate,
    conn=Depends(get_db),
    user: UserPublic = Depends(require_authenticated_user),
) -> ProjectInvitation:
    return await project_service.invite_project_member(
        conn, project_id=project_id, user_id=user.id, request=request
    )


@router.patch("/projects/{project_id}/members/{member_id}")
async def update_member(
    project_id: str,
    member_id: str,
    request: ProjectMemberRoleUpdate,
    conn=Depends(get_db),
    user: UserPublic = Depends(require_authenticated_user),
) -> ProjectMember:
    return await project_service.update_project_member(
        conn,
        project_id=project_id,
        member_id=member_id,
        actor_id=user.id,
        request=request,
    )


@router.delete("/projects/{project_id}/members/{member_id}", status_code=204)
async def remove_member(
    project_id: str,
    member_id: str,
    conn=Depends(get_db),
    user: UserPublic = Depends(require_authenticated_user),
) -> None:
    await project_service.remove_project_member(
        conn, project_id=project_id, member_id=member_id, actor_id=user.id
    )


@router.post("/invitations/{token}/accept")
async def accept_invitation(
    token: str,
    conn=Depends(get_db),
    user: UserPublic = Depends(require_authenticated_user),
) -> ProjectMember:
    return await project_service.accept_project_invitation(conn, token=token, user_id=user.id)
