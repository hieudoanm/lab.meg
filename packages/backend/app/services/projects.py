"""Project and sharing services."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.exceptions import NotFoundError
from app.core.security import new_opaque_token
from app.db.pool import Connection
from app.repositories import audit as audit_repo
from app.repositories import projects as project_repo
from app.repositories import shared as shared_repo
from app.schemas.projects import Project, ProjectCreate, Share, ShareCreate
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
