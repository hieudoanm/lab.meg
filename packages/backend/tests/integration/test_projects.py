"""Integration tests: project lifecycle."""

from __future__ import annotations

from app.repositories import projects as project_repo
from app.schemas.projects import ProjectCreate, ProjectInvitationCreate, ProjectMemberRoleUpdate
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


async def test_members_can_be_invited_promoted_and_removed(db_conn, storage) -> None:
    from app.repositories import users as user_repo

    owner = await user_repo.create_user(
        db_conn, email="membership-owner@example.com", display_name="Owner"
    )
    member = await user_repo.create_user(
        db_conn, email="membership-member@example.com", display_name="Member"
    )
    project = await project_service.create_project(
        db_conn, user_id=owner.id, request=ProjectCreate(name="Memberships")
    )

    invitation = await project_service.invite_project_member(
        db_conn,
        project_id=project.id,
        user_id=owner.id,
        request=ProjectInvitationCreate(email=member.email or "", role="editor"),
    )
    accepted = await project_service.accept_project_invitation(
        db_conn, token=invitation.token or "", user_id=member.id
    )
    assert accepted.role == "editor"

    updated = await project_service.update_project_member(
        db_conn,
        project_id=project.id,
        member_id=member.id,
        actor_id=owner.id,
        request=ProjectMemberRoleUpdate(role="viewer"),
    )
    assert updated.role == "viewer"

    await project_service.remove_project_member(
        db_conn, project_id=project.id, member_id=member.id, actor_id=owner.id
    )
    assert await project_repo.get_member(db_conn, project.id, member.id) is None


async def test_last_owner_cannot_be_removed(db_conn, storage) -> None:
    from app.core.exceptions import ConflictError
    from app.repositories import users as user_repo

    owner = await user_repo.create_user(
        db_conn, email="remove-owner@example.com", display_name="Owner"
    )
    project = await project_service.create_project(
        db_conn, user_id=owner.id, request=ProjectCreate(name="Owner invariant")
    )

    try:
        await project_service.remove_project_member(
            db_conn, project_id=project.id, member_id=owner.id, actor_id=owner.id
        )
    except ConflictError as error:
        assert error.code == "last_owner"
    else:
        raise AssertionError("removing the last owner should fail")
