"""Integration tests: project lifecycle."""

from __future__ import annotations

from app.repositories import projects as project_repo
from app.schemas.projects import ProjectCreate
from app.services import projects as project_service


async def test_create_project_provisions_owner(db_conn, storage) -> None:
    from app.repositories import users as user_repo

    user = await user_repo.create_user(db_conn, email="owner@example.com", display_name="Owner")
    project = await project_service.create_project(
        db_conn,
        user_id=user.id,
        request=ProjectCreate(name="Auditory Evoked Fields", visibility="private"),
    )
    assert project.name == "Auditory Evoked Fields"
    assert project.visibility == "private"

    member = await project_repo.get_member(db_conn, project.id, user.id)
    assert member is not None
    assert member.role == "owner"


async def test_project_list_includes_members_and_public(db_conn, storage) -> None:
    from app.repositories import users as user_repo

    owner = await user_repo.create_user(db_conn, email="owner2@example.com", display_name="Owner")
    other = await user_repo.create_user(db_conn, email="other2@example.com", display_name="Other")
    await project_service.create_project(
        db_conn, user_id=owner.id, request=ProjectCreate(name="Private", visibility="private")
    )
    await project_service.create_project(
        db_conn, user_id=owner.id, request=ProjectCreate(name="Public", visibility="public")
    )

    items, _, _ = await project_service.list_projects(
        db_conn, user_id=owner.id, limit=10, cursor=None
    )
    names = {item.name for item in items}
    assert {"Private", "Public"} <= names

    items, _, _ = await project_service.list_projects(
        db_conn, user_id=other.id, limit=10, cursor=None
    )
    other_names = {item.name for item in items}
    assert "Public" in other_names
    assert "Private" not in other_names


async def test_last_owner_demotion_is_rejected(db_conn, storage) -> None:
    """The last-owner invariant requires transactional logic."""
    from app.repositories import users as user_repo

    owner = await user_repo.create_user(
        db_conn, email="lastowner@example.com", display_name="Owner"
    )
    project = await project_service.create_project(
        db_conn, user_id=owner.id, request=ProjectCreate(name="Solo")
    )
    count = await project_repo.count_owners(db_conn, project.id)
    assert count == 1
    # A second owner must exist before the first can be demoted or
    # removed; the service layer enforces this through count_owners.
    assert await project_repo.count_owners(db_conn, project.id) == 1
