"""Security tests: project-scoped tenant isolation (FR-015).

Cross-tenant negative cases: substituted identifiers, reused
object references, and role escalation attempts must all be
denied.
"""

from __future__ import annotations

from app.repositories import users as user_repo
from app.schemas.projects import ProjectCreate
from app.services import projects as project_service
from app.services.tenancy import resolve_access


async def _make_user(db_conn, email: str):
    return await user_repo.create_user(db_conn, email=email, display_name=email)


async def test_cross_project_access_denied(db_conn, storage) -> None:
    """A user with no membership cannot see another tenant's project."""
    owner = await _make_user(db_conn, "tenant-a@example.com")
    stranger = await _make_user(db_conn, "tenant-b@example.com")
    project = await project_service.create_project(
        db_conn, user_id=owner.id, request=ProjectCreate(name="Secret", visibility="private")
    )
    access = await resolve_access(db_conn, project_id=project.id, user_id=stranger.id)
    assert access is None


async def test_viewer_cannot_write(db_conn, storage) -> None:
    owner = await _make_user(db_conn, "viewer-owner@example.com")
    viewer = await _make_user(db_conn, "viewer@example.com")
    project = await project_service.create_project(
        db_conn, user_id=owner.id, request=ProjectCreate(name="Viewable")
    )
    from app.repositories import projects as project_repo

    await project_repo.add_member(db_conn, project_id=project.id, user_id=viewer.id, role="viewer")
    access = await resolve_access(db_conn, project_id=project.id, user_id=viewer.id)
    assert access is not None
    assert access.can_read
    assert not access.can_write


async def test_public_project_is_readable_without_membership(db_conn, storage) -> None:
    owner = await _make_user(db_conn, "public-owner@example.com")
    stranger = await _make_user(db_conn, "public-stranger@example.com")
    project = await project_service.create_project(
        db_conn,
        user_id=owner.id,
        request=ProjectCreate(name="Open", visibility="public"),
    )
    access = await resolve_access(db_conn, project_id=project.id, user_id=stranger.id)
    assert access is not None
    assert access.can_read
    assert not access.can_write


async def test_share_token_grants_scoped_read(db_conn, storage) -> None:
    from app.schemas.projects import ShareCreate

    owner = await _make_user(db_conn, "share-owner@example.com")
    project = await project_service.create_project(
        db_conn, user_id=owner.id, request=ProjectCreate(name="Shared")
    )
    share = await project_service.create_share(
        db_conn,
        project_id=project.id,
        user_id=owner.id,
        request=ShareCreate(scope="project", role="viewer"),
    )
    access = await resolve_access(
        db_conn, project_id=project.id, user_id=None, share_token=share.token
    )
    assert access is not None
    assert access.can_read
    assert not access.can_write

    # A share token does not grant access to other projects.
    other = await project_service.create_project(
        db_conn,
        user_id=owner.id,
        request=ProjectCreate(name="NotShared", visibility="private"),
    )
    denied = await resolve_access(
        db_conn, project_id=other.id, user_id=None, share_token=share.token
    )
    assert denied is None


async def test_anonymous_private_project_denied(db_conn, storage) -> None:
    owner = await _make_user(db_conn, "anon-owner@example.com")
    project = await project_service.create_project(
        db_conn, user_id=owner.id, request=ProjectCreate(name="Hidden", visibility="private")
    )
    access = await resolve_access(db_conn, project_id=project.id, user_id=None)
    assert access is None
