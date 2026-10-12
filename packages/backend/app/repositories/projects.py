"""Project and membership repositories."""

from __future__ import annotations

from typing import Any

from app.db.pool import Connection
from app.repositories._shared import cursor_where, paginate, to_model, to_models
from app.schemas.common import ProjectRole
from app.schemas.projects import Project, ProjectMember


async def create_project(
    conn: Connection,
    *,
    owner_id: str,
    name: str,
    description: str | None,
    visibility: str,
) -> Project:
    row = await conn.execute(
        """
        INSERT INTO projects (owner_id, name, description, visibility)
        VALUES (%s, %s, %s, %s)
        RETURNING *
        """,
        (owner_id, name, description, visibility),
    )
    project = to_model(Project, await row.fetchone())
    assert project is not None
    return project


async def get_project_by_id(conn: Connection, project_id: str) -> Project | None:
    row = await conn.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
    return to_model(Project, await row.fetchone())


async def list_projects_for_user(
    conn: Connection,
    *,
    user_id: str,
    limit: int,
    cursor: str | None,
) -> tuple[list[Project], str | None, bool]:
    condition, params = cursor_where(cursor, "p")
    sql = f"""
        SELECT p.*
        FROM projects p
        LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = %s
        WHERE pm.user_id IS NOT NULL OR p.visibility = 'public' {condition}
        ORDER BY p.created_at DESC, p.id ASC
        LIMIT %s
    """
    row = await conn.execute(sql, [user_id, *params, limit + 1])
    projects = to_models(Project, await row.fetchall())
    return paginate(projects, limit)


async def add_member(
    conn: Connection,
    *,
    project_id: str,
    user_id: str,
    role: ProjectRole,
) -> ProjectMember:
    row = await conn.execute(
        """
        INSERT INTO project_members (project_id, user_id, role)
        VALUES (%s, %s, %s)
        RETURNING *
        """,
        (project_id, user_id, role),
    )
    member = to_model(ProjectMember, await row.fetchone())
    assert member is not None
    return member


async def get_member(conn: Connection, project_id: str, user_id: str) -> ProjectMember | None:
    row = await conn.execute(
        "SELECT * FROM project_members WHERE project_id = %s AND user_id = %s",
        (project_id, user_id),
    )
    return to_model(ProjectMember, await row.fetchone())


async def list_members(conn: Connection, project_id: str) -> list[ProjectMember]:
    row = await conn.execute(
        "SELECT * FROM project_members WHERE project_id = %s ORDER BY created_at ASC",
        (project_id,),
    )
    return to_models(ProjectMember, await row.fetchall())


async def count_owners(conn: Connection, project_id: str) -> int:
    row = await conn.execute(
        "SELECT count(*) AS n FROM project_members WHERE project_id = %s AND role = 'owner'",
        (project_id,),
    )
    result = await row.fetchone()
    return int(result["n"])  # type: ignore[index]


async def project_member_count(conn: Connection, project_id: str) -> int:
    row = await conn.execute(
        "SELECT count(*) AS n FROM project_members WHERE project_id = %s",
        (project_id,),
    )
    result = await row.fetchone()
    return int(result["n"])  # type: ignore[index]


async def list_project_ids_for_user(conn: Connection, user_id: str) -> list[str]:
    row = await conn.execute(
        "SELECT project_id FROM project_members WHERE user_id = %s",
        (user_id,),
    )
    return [str(result["project_id"]) for result in await row.fetchall()]


async def delete_member(conn: Connection, project_id: str, user_id: str) -> None:
    await conn.execute(
        "DELETE FROM project_members WHERE project_id = %s AND user_id = %s",
        (project_id, user_id),
    )


async def touch_project(conn: Connection, project_id: str) -> None:
    await conn.execute(
        "UPDATE projects SET updated_at = now() WHERE id = %s",
        (project_id,),
    )


def _unused(*args: Any) -> None:  # pragma: no cover
    pass
