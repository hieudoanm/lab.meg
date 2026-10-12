"""Project-scoped authorization (deny by default, FR-015).

Every operation resolves access to the owning project first. Callers
with no access receive 404 (no information leakage); authenticated
callers lacking the required role receive 403.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.core.exceptions import ForbiddenError, NotFoundError
from app.core.security import hash_token
from app.db.pool import Connection
from app.repositories import projects as project_repo
from app.repositories import shared as shared_repo

Role = Literal["owner", "editor", "viewer"]


@dataclass
class Access:
    role: Role
    via_share: bool = False
    public: bool = False

    @property
    def can_read(self) -> bool:
        return True

    @property
    def can_write(self) -> bool:
        return self.role in ("owner", "editor")


async def resolve_access(
    conn: Connection,
    *,
    project_id: str,
    user_id: str | None,
    share_token: str | None = None,
) -> Access | None:
    """Resolve the caller's access to a project, or None when denied."""
    if user_id is not None:
        member = await project_repo.get_member(conn, project_id, user_id)
        if member is not None:
            return Access(role=member.role)
    if share_token is not None:
        share = await shared_repo.get_share_by_token_hash(conn, hash_token(share_token))
        if share is not None and share["project_id"] == project_id:
            return Access(role=share["role"], via_share=True)
    project = await project_repo.get_project_by_id(conn, project_id)
    if project is not None and project.visibility == "public":
        return Access(role="viewer", public=True)
    return None


def require_read(access: Access | None, resource: str = "resource") -> Access:
    if access is None:
        raise NotFoundError(f"{resource} not found")
    return access


def require_write(access: Access | None, resource: str = "resource") -> Access:
    if access is None:
        raise NotFoundError(f"{resource} not found")
    if not access.can_write:
        raise ForbiddenError(
            "insufficient permissions for this operation",
            code="insufficient_role",
        )
    return access


async def require_project_access(
    conn: Connection,
    *,
    project_id: str,
    user_id: str | None,
    share_token: str | None = None,
    write: bool = False,
) -> Access:
    access = await resolve_access(
        conn, project_id=project_id, user_id=user_id, share_token=share_token
    )
    return require_write(access, "project") if write else require_read(access, "project")
