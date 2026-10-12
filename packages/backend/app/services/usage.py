"""Usage accounting and quotas."""

from __future__ import annotations

from typing import Any

from app.db.pool import Connection
from app.repositories import projects as project_repo
from app.repositories import shared as shared_repo
from app.schemas.common import Page
from app.services.tenancy import require_project_access


async def list_usage(
    conn: Connection,
    *,
    user_id: str,
    limit: int,
    cursor: str | None,
) -> Page:
    records, next_cursor, has_more = await shared_repo.list_usage_for_user(
        conn, user_id=user_id, limit=limit, cursor=cursor
    )
    return Page(items=records, next_cursor=next_cursor, has_more=has_more)


async def quotas(conn: Connection, *, user_id: str) -> dict[str, float]:
    """Storage across accessible projects plus metered core hours."""
    memberships = await project_repo.list_project_ids_for_user(conn, user_id)
    storage_bytes = 0
    for project_id in memberships:
        storage_bytes += await shared_repo.storage_bytes_for_project(conn, project_id)
    totals = await shared_repo.usage_totals_for_user(conn, user_id)
    return {
        "storage_bytes": float(storage_bytes),
        "core_hours": totals["core_hours"],
    }


_ = require_project_access, Any
