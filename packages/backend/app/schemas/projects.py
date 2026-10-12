"""Project, membership, and sharing schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import ProjectRole, ShareScope, UtcDatetime, Visibility


class Project(BaseModel):
    id: str
    owner_id: str
    name: str
    description: str | None = None
    visibility: Visibility
    created_at: UtcDatetime
    updated_at: UtcDatetime
    archived_at: UtcDatetime | None = None


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    visibility: Visibility = "private"


class ProjectList(BaseModel):
    items: list[Project]
    next_cursor: str | None = None
    has_more: bool


class ProjectMember(BaseModel):
    project_id: str
    user_id: str
    role: ProjectRole
    display_name: str | None = None
    email: str | None = None
    created_at: UtcDatetime


class ProjectMemberRoleUpdate(BaseModel):
    role: ProjectRole


class ProjectInvitationCreate(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    role: ProjectRole = "viewer"


class ProjectInvitation(BaseModel):
    id: str
    project_id: str
    email: str
    role: ProjectRole
    token: str | None = None
    expires_at: UtcDatetime
    accepted_at: UtcDatetime | None = None
    created_at: UtcDatetime


class Share(BaseModel):
    id: str
    project_id: str
    scope: ShareScope
    resource_id: str | None = None
    role: ProjectRole
    token: str
    url: str
    expires_at: UtcDatetime | None = None
    revoked_at: UtcDatetime | None = None
    created_by: str
    created_at: UtcDatetime


class ShareCreate(BaseModel):
    scope: ShareScope
    resource_id: str | None = None
    role: ProjectRole = "viewer"
    expires_at: UtcDatetime | None = None
