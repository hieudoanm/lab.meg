"""Unit tests for project and membership service orchestration."""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any, cast

import pytest

from app.core.exceptions import NotFoundError, UnprocessableError
from app.schemas.projects import (
    Project,
    ProjectCreate,
    ProjectInvitationCreate,
    ProjectMemberRoleUpdate,
    ShareCreate,
)
from app.services import projects

CONN = cast(Any, None)
NOW = datetime.now(UTC)
PROJECT = Project(
    id="project-1",
    owner_id="user-1",
    name="Project",
    visibility="private",
    created_at=NOW,
    updated_at=NOW,
)


@pytest.mark.asyncio
async def test_create_list_and_get_project(monkeypatch) -> None:
    async def create(*args, **kwargs):
        return PROJECT

    async def noop(*args, **kwargs):
        return None

    async def listing(*args, **kwargs):
        return [PROJECT], "next", True

    async def get_project(*args, **kwargs):
        return PROJECT

    monkeypatch.setattr(projects.project_repo, "create_project", create)
    monkeypatch.setattr(projects.project_repo, "add_member", noop)
    monkeypatch.setattr(projects.audit_repo, "create_audit_event", noop)
    assert (
        await projects.create_project(CONN, user_id="user-1", request=ProjectCreate(name="Project"))
        == PROJECT
    )
    monkeypatch.setattr(projects.project_repo, "list_projects_for_user", listing)
    assert await projects.list_projects(CONN, user_id="user-1", limit=10, cursor=None) == (
        [PROJECT],
        "next",
        True,
    )
    monkeypatch.setattr(projects.project_repo, "get_project_by_id", get_project)
    monkeypatch.setattr("app.services.tenancy.require_project_access", noop)
    assert await projects.get_project(CONN, project_id="project-1", user_id="user-1") == PROJECT


@pytest.mark.asyncio
async def test_invite_project_member_normalizes_and_rejects_owner(monkeypatch) -> None:
    async def access(*args, **kwargs):
        return None

    async def no_user(*args, **kwargs):
        return None

    async def invitation(*args, **kwargs):
        return {
            "id": "invitation-1",
            "project_id": "project-1",
            "email": kwargs["email"],
            "role": kwargs["role"],
            "expires_at": NOW,
            "created_at": NOW,
        }

    monkeypatch.setattr(projects, "require_project_access", access)
    monkeypatch.setattr(projects.user_repo, "get_user_by_email", no_user)
    monkeypatch.setattr(projects.project_repo, "create_invitation", invitation)
    monkeypatch.setattr(projects, "new_opaque_token", lambda: ("token", "hash"))
    result = await projects.invite_project_member(
        CONN,
        project_id="project-1",
        user_id="user-1",
        request=ProjectInvitationCreate(email=" New@Example.com ", role="viewer"),
    )
    assert result.email == "new@example.com"
    assert result.token == "token"
    with pytest.raises(UnprocessableError, match="owner"):
        await projects.invite_project_member(
            CONN,
            project_id="project-1",
            user_id="user-1",
            request=ProjectInvitationCreate(email="owner@example.com", role="owner"),
        )


@pytest.mark.asyncio
async def test_membership_updates_and_removals_enforce_owner_rules(monkeypatch) -> None:
    member = SimpleNamespace(role="viewer")
    owner = SimpleNamespace(role="owner")

    async def access(*args, **kwargs):
        return owner

    async def get_member(*args, **kwargs):
        return member

    async def update_member(*args, **kwargs):
        return member

    async def touch(*args, **kwargs):
        return None

    monkeypatch.setattr(projects, "require_project_access", access)
    monkeypatch.setattr(projects.project_repo, "get_member", get_member)
    monkeypatch.setattr(projects.project_repo, "update_member_role", update_member)
    monkeypatch.setattr(projects.project_repo, "touch_project", touch)
    conn = cast(Any, SimpleNamespace(transaction=lambda: _Transaction(), execute=touch))
    assert (
        await projects.update_project_member(
            conn,
            project_id="project-1",
            member_id="user-2",
            actor_id="user-1",
            request=ProjectMemberRoleUpdate(role="viewer"),
        )
        == member
    )

    async def missing_member(*args, **kwargs):
        return None

    monkeypatch.setattr(projects.project_repo, "get_member", missing_member)
    with pytest.raises(NotFoundError, match="member"):
        await projects.remove_project_member(
            conn, project_id="project-1", member_id="user-2", actor_id="user-1"
        )


class _Transaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None


@pytest.mark.asyncio
async def test_accept_invitation_and_share_validation(monkeypatch) -> None:
    async def no_invitation(*args):
        return None

    monkeypatch.setattr(projects.project_repo, "get_invitation", no_invitation)
    with pytest.raises(UnprocessableError, match="invalid"):
        await projects.accept_project_invitation(CONN, token="bad", user_id="user-1")

    async def access(*args, **kwargs):
        return None

    monkeypatch.setattr(projects, "require_project_access", access)
    with pytest.raises(UnprocessableError, match="resource_id"):
        await projects.create_share(
            CONN,
            project_id="project-1",
            user_id="user-1",
            request=ShareCreate(scope="dataset"),
        )

    user = SimpleNamespace(email="user@example.com")
    invitation = {"email": "user@example.com", "project_id": "project-1"}
    member = {
        "project_id": "project-1",
        "user_id": "user-1",
        "role": "viewer",
        "created_at": NOW,
    }

    async def get_invitation(*args):
        return invitation

    async def get_user(*args):
        return user

    async def accept_invitation(*args, **kwargs):
        return SimpleNamespace(user_id=member["user_id"])

    monkeypatch.setattr(projects.project_repo, "get_invitation", get_invitation)
    monkeypatch.setattr(projects.user_repo, "get_user_by_id", get_user)
    monkeypatch.setattr(projects.project_repo, "accept_invitation", accept_invitation)
    accepted = await projects.accept_project_invitation(
        cast(Any, SimpleNamespace(transaction=lambda: _Transaction())),
        token="valid",
        user_id="user-1",
    )
    assert accepted.user_id == "user-1"

    async def create_share(*args, **kwargs):
        return SimpleNamespace(id="share-1", token=kwargs["token"])

    async def audit(*args, **kwargs):
        return None

    monkeypatch.setattr(projects.shared_repo, "create_share", create_share)
    monkeypatch.setattr(projects.audit_repo, "create_audit_event", audit)
    monkeypatch.setattr(projects, "new_opaque_token", lambda: ("share-token", "share-hash"))
    share = await projects.create_share(
        CONN,
        project_id="project-1",
        user_id="user-1",
        request=ShareCreate(scope="project"),
    )
    assert share.token == "share-token"
