"""Unit tests for project-scoped access decisions without a database."""

from __future__ import annotations

from typing import Any, cast

import pytest

from app.core.exceptions import ForbiddenError, NotFoundError
from app.services import tenancy

CONN = cast(Any, None)


def test_access_role_capabilities() -> None:
    assert tenancy.Access("owner").can_write
    assert tenancy.Access("editor").can_write
    assert not tenancy.Access("viewer").can_write
    assert tenancy.Access("viewer").can_read


def test_require_access_helpers_deny_missing_and_read_only_access() -> None:
    with pytest.raises(NotFoundError):
        tenancy.require_read(None, "project")
    viewer = tenancy.Access("viewer")
    assert tenancy.require_read(viewer) is viewer
    with pytest.raises(ForbiddenError, match="insufficient"):
        tenancy.require_write(viewer)
    editor = tenancy.Access("editor")
    assert tenancy.require_write(editor) is editor


@pytest.mark.asyncio
async def test_resolve_access_prefers_members_then_share_then_public(monkeypatch) -> None:
    class Member:
        role = "editor"

    class Project:
        visibility = "public"

    async def member(conn, project_id, user_id):
        return Member() if user_id == "member" else None

    async def share(conn, token_hash):
        return {"project_id": "project", "role": "viewer"} if token_hash == "hashed" else None

    async def project(conn, project_id):
        return Project() if project_id == "project" else None

    monkeypatch.setattr(tenancy.project_repo, "get_member", member)
    monkeypatch.setattr(tenancy.shared_repo, "get_share_by_token_hash", share)
    monkeypatch.setattr(tenancy.project_repo, "get_project_by_id", project)
    monkeypatch.setattr(tenancy, "hash_token", lambda value: "hashed")

    member_access = await tenancy.resolve_access(CONN, project_id="project", user_id="member")
    assert member_access is not None and member_access.role == "editor"
    shared = await tenancy.resolve_access(
        CONN, project_id="project", user_id=None, share_token="secret"
    )
    assert shared is not None and shared.via_share and shared.role == "viewer"
    public = await tenancy.resolve_access(CONN, project_id="project", user_id=None)
    assert public is not None and public.public and public.role == "viewer"


@pytest.mark.asyncio
async def test_resolve_access_rejects_share_for_other_project(monkeypatch) -> None:
    async def no_member(*args):
        return None

    async def other_share(*args):
        return {"project_id": "other", "role": "owner"}

    async def private_project(*args):
        return type("Project", (), {"visibility": "private"})()

    monkeypatch.setattr(tenancy.project_repo, "get_member", no_member)
    monkeypatch.setattr(tenancy.shared_repo, "get_share_by_token_hash", other_share)
    monkeypatch.setattr(tenancy.project_repo, "get_project_by_id", private_project)
    assert (
        await tenancy.resolve_access(CONN, project_id="project", user_id=None, share_token="x")
        is None
    )
