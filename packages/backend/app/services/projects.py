"""Project and sharing services."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta, timezone
from typing import Any

from app.core.config import get_settings
from app.core.exceptions import ConflictError, NotFoundError, UnprocessableError
from app.core.security import hash_token, new_opaque_token
from app.db.pool import Connection
from app.repositories import audit as audit_repo
from app.repositories import projects as project_repo
from app.repositories import shared as shared_repo
from app.repositories import users as user_repo
from app.schemas.projects import (
    Project,
    ProjectCreate,
    ProjectInvitation,
    ProjectInvitationCreate,
    ProjectMember,
    ProjectMemberRoleUpdate,
    Share,
    ShareCreate,
)
from app.services.tenancy import require_project_access, resolve_access


async def create_project(conn: Connection, *, user_id: str, request: ProjectCreate) -> Project:
    project = await project_repo.create_project(
        conn,
        owner_id=user_id,
        name=request.name,
        description=request.description,
        visibility=request.visibility,
    )
    await project_repo.add_member(conn, project_id=project.id, user_id=user_id, role="owner")
    await audit_repo.create_audit_event(
        conn,
        actor_id=user_id,
        action="project.created",
        resource_type="project",
        resource_id=project.id,
    )
    return project


async def list_projects(
    conn: Connection, *, user_id: str, limit: int, cursor: str | None
) -> tuple[list[Project], str | None, bool]:
    return await project_repo.list_projects_for_user(
        conn, user_id=user_id, limit=limit, cursor=cursor
    )


async def get_project(conn: Connection, *, project_id: str, user_id: str) -> Project:
    from app.services.tenancy import require_project_access

    project = await project_repo.get_project_by_id(conn, project_id)
    if project is None:
        from app.core.exceptions import NotFoundError

        raise NotFoundError("project not found")
    await require_project_access(conn, project_id=project_id, user_id=user_id)
    return project


async def list_project_members(
    conn: Connection, *, project_id: str, user_id: str
) -> list[ProjectMember]:
    await require_project_access(conn, project_id=project_id, user_id=user_id)
    return await project_repo.list_members(conn, project_id)


async def invite_project_member(
    conn: Connection,
    *,
    project_id: str,
    user_id: str,
    request: ProjectInvitationCreate,
) -> ProjectInvitation:
    await require_project_access(conn, project_id=project_id, user_id=user_id, write=True)
    email = request.email.strip().lower()
    if request.role == "owner":
        raise UnprocessableError(
            "owner invitations are not supported; promote an existing member instead",
            code="invitation_role_invalid",
        )
    invited = await user_repo.get_user_by_email(conn, email)
    if invited is not None and await project_repo.get_member(conn, project_id, invited.id):
        raise ConflictError("user is already a project member", code="member_exists")
    token, token_hash = new_opaque_token()
    invitation = await project_repo.create_invitation(
        conn,
        project_id=project_id,
        email=email,
        role=request.role,
        token_hash=token_hash,
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    invitation["id"] = str(invitation["id"])
    invitation["project_id"] = str(invitation["project_id"])
    invitation["token"] = token
    return ProjectInvitation.model_validate(invitation)


async def update_project_member(
    conn: Connection,
    *,
    project_id: str,
    member_id: str,
    actor_id: str,
    request: ProjectMemberRoleUpdate,
) -> ProjectMember:
    access = await require_project_access(conn, project_id=project_id, user_id=actor_id, write=True)
    member = await project_repo.get_member(conn, project_id, member_id)
    if member is None:
        raise NotFoundError("project member not found")
    if request.role == "owner" and access.role != "owner":
        raise ConflictError("only an owner can grant owner role", code="owner_role_required")
    async with conn.transaction():
        if member.role == "owner" and request.role != "owner":
            await conn.execute("SELECT id FROM projects WHERE id = %s FOR UPDATE", (project_id,))
            if await project_repo.count_owners(conn, project_id) <= 1:
                raise ConflictError("a project must retain at least one owner", code="last_owner")
        updated = await project_repo.update_member_role(conn, project_id, member_id, request.role)
    assert updated is not None
    await project_repo.touch_project(conn, project_id)
    return updated


async def remove_project_member(
    conn: Connection, *, project_id: str, member_id: str, actor_id: str
) -> None:
    access = await require_project_access(conn, project_id=project_id, user_id=actor_id, write=True)
    member = await project_repo.get_member(conn, project_id, member_id)
    if member is None:
        raise NotFoundError("project member not found")
    if member.role == "owner":
        if access.role != "owner":
            raise ConflictError("only an owner can remove an owner", code="owner_role_required")
        async with conn.transaction():
            await conn.execute("SELECT id FROM projects WHERE id = %s FOR UPDATE", (project_id,))
            if await project_repo.count_owners(conn, project_id) <= 1:
                raise ConflictError("a project must retain at least one owner", code="last_owner")
            await project_repo.delete_member(conn, project_id, member_id)
    else:
        await project_repo.delete_member(conn, project_id, member_id)
    await project_repo.touch_project(conn, project_id)


async def accept_project_invitation(conn: Connection, *, token: str, user_id: str) -> ProjectMember:
    invitation = await project_repo.get_invitation(conn, hash_token(token))
    if invitation is None:
        raise UnprocessableError(
            "invitation is invalid, expired, or already accepted",
            code="invitation_invalid",
        )
    user = await user_repo.get_user_by_id(conn, user_id)
    if user is None or user.email.lower() != invitation["email"].lower():
        raise UnprocessableError(
            "invitation email does not match the authenticated user",
            code="invitation_email_mismatch",
        )
    async with conn.transaction():
        member = await project_repo.accept_invitation(
            conn, token_hash=hash_token(token), user_id=user_id
        )
        if member is None:
            raise UnprocessableError(
                "invitation is invalid, expired, or already accepted",
                code="invitation_invalid",
            )
    return member


async def create_share(
    conn: Connection,
    *,
    project_id: str,
    user_id: str,
    request: ShareCreate,
) -> Share:
    await require_project_access(conn, project_id=project_id, user_id=user_id, write=True)

    if request.scope != "project" and request.resource_id is None:
        from app.core.exceptions import UnprocessableError

        raise UnprocessableError(
            "resource_id is required for dataset- and run-scoped shares",
            code="share_resource_required",
        )

    if request.scope == "dataset":
        from app.repositories import datasets as dataset_repo

        dataset = await dataset_repo.get_dataset_by_id(conn, request.resource_id or "")
        if dataset is None or dataset.project_id != project_id:
            raise NotFoundError("dataset not found")
    elif request.scope == "run":
        from app.repositories import runs as run_repo

        run = await run_repo.get_run_row(conn, request.resource_id or "")
        if run is None or run["project_id"] != project_id:
            raise NotFoundError("run not found")

    if request.role != "viewer":
        from app.core.exceptions import UnprocessableError

        raise UnprocessableError(
            "sharing links grant read-only access",
            code="share_role_invalid",
        )

    token, token_hash = new_opaque_token()
    base_url = get_settings().public_base_url
    share = await shared_repo.create_share(
        conn,
        project_id=project_id,
        resource_id=request.resource_id,
        scope=request.scope,
        role=request.role,
        token_hash=token_hash,
        token=token,
        base_url=base_url,
        created_by=user_id,
        expires_at=request.expires_at,
    )
    await audit_repo.create_audit_event(
        conn,
        actor_id=user_id,
        action="share.created",
        resource_type=f"share:{request.scope}",
        resource_id=str(share.id),
    )
    return share


async def resolve_share_access(
    conn: Connection, *, project_id: str, share_token: str | None
) -> Any:
    return await resolve_access(conn, project_id=project_id, user_id=None, share_token=share_token)


_ = datetime, timezone
