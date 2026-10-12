"""Usage, audit, outbox, idempotency, and sharing repositories."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.db.pool import Connection
from app.repositories._shared import clean, cursor_where, to_jsonb, to_models
from app.schemas.common import Page
from app.schemas.projects import Share


async def record_usage(
    conn: Connection,
    *,
    user_id: str,
    run_id: str | None,
    resource_type: str,
    quantity: int,
) -> None:
    await conn.execute(
        """
        INSERT INTO usage_records (user_id, run_id, resource_type, quantity)
        VALUES (%s, %s, %s, %s)
        """,
        (user_id, run_id, resource_type, quantity),
    )


async def list_usage_for_user(
    conn: Connection,
    *,
    user_id: str,
    limit: int,
    cursor: str | None,
) -> tuple[list[dict[str, Any]], str | None, bool]:
    condition, params = cursor_where(cursor)
    sql = f"""
        SELECT * FROM usage_records
        WHERE user_id = %s {condition}
        ORDER BY created_at DESC, id ASC
        LIMIT %s
    """
    row = await conn.execute(sql, [user_id, *params, limit + 1])
    records = [clean(r) for r in await row.fetchall()]
    has_more = len(records) > limit
    page = records[:limit]
    next_cursor = _record_cursor(page) if has_more and page else None
    return page, next_cursor, has_more


def _record_cursor(page: list[dict[str, Any]]) -> str | None:
    from app.core.pagination import CursorPosition, encode_cursor

    last = page[-1]
    return encode_cursor(CursorPosition(created_at=last["created_at"], id=last["id"]))


async def usage_totals_for_user(conn: Connection, user_id: str) -> dict[str, float]:
    row = await conn.execute(
        """
        SELECT resource_type, sum(quantity) AS total
        FROM usage_records
        WHERE user_id = %s
        GROUP BY resource_type
        """,
        (user_id,),
    )
    totals = {record["resource_type"]: float(record["total"]) for record in await row.fetchall()}
    return {
        "storage_bytes": totals.get("storage_bytes", 0.0),
        "core_hours": totals.get("core_hours", 0.0),
    }


async def storage_bytes_for_project(conn: Connection, project_id: str) -> int:
    row = await conn.execute(
        """
        SELECT COALESCE(sum(fa.size_bytes), 0) AS total
        FROM file_assets fa
        JOIN recordings r ON r.id = fa.recording_id
        JOIN dataset_versions dv ON dv.id = r.dataset_version_id
        JOIN datasets ds ON ds.id = dv.dataset_id
        WHERE ds.project_id = %s
        """,
        (project_id,),
    )
    result = await row.fetchone()
    return int(result["total"])  # type: ignore[index]


async def create_audit_event(
    conn: Connection,
    *,
    actor_id: str | None,
    action: str,
    resource_type: str,
    resource_id: str | None,
) -> None:
    await conn.execute(
        """
        INSERT INTO audit_events (actor_id, action, resource_type, resource_id)
        VALUES (%s, %s, %s, %s)
        """,
        (actor_id, action, resource_type, resource_id),
    )


async def enqueue_outbox(
    conn: Connection,
    *,
    topic: str,
    payload: dict[str, Any],
) -> None:
    await conn.execute(
        "INSERT INTO outbox_events (topic, payload) VALUES (%s, %s)",
        (topic, to_jsonb(payload)),
    )


async def claim_outbox_events(conn: Connection, limit: int = 10) -> list[dict[str, Any]]:
    """Claim pending outbox events for the dispatcher (at-least-once)."""
    row = await conn.execute(
        """
        SELECT * FROM outbox_events
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT %s
        FOR UPDATE SKIP LOCKED
        """,
        (limit,),
    )
    return [clean(r) for r in await row.fetchall()]


async def mark_outbox_published(conn: Connection, event_id: str) -> None:
    await conn.execute(
        "UPDATE outbox_events SET status = 'published', published_at = now() WHERE id = %s",
        (event_id,),
    )


async def mark_outbox_failed(conn: Connection, event_id: str) -> None:
    await conn.execute(
        """
        UPDATE outbox_events
        SET status = 'failed', attempts = attempts + 1
        WHERE id = %s
        """,
        (event_id,),
    )


async def get_idempotency_record(conn: Connection, key: str, user_id: str) -> dict[str, Any] | None:
    row = await conn.execute(
        """
        SELECT * FROM idempotency_keys
        WHERE key = %s AND user_id = %s AND expires_at > now()
        """,
        (key, user_id),
    )
    result = await row.fetchone()
    return clean(result) if result else None


async def create_idempotency_record(
    conn: Connection,
    *,
    key: str,
    user_id: str,
    request_hash: str,
    response_status: int,
    response_body: dict[str, Any] | None,
    expires_at: datetime,
) -> None:
    await conn.execute(
        """
        INSERT INTO idempotency_keys
            (key, user_id, request_hash, response_status, response_body, expires_at)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (key, user_id, request_hash, response_status, to_jsonb(response_body), expires_at),
    )


async def delete_expired_idempotency(conn: Connection) -> int:
    row = await conn.execute("DELETE FROM idempotency_keys WHERE expires_at < now()")
    return row.rowcount or 0


async def create_share(
    conn: Connection,
    *,
    project_id: str,
    resource_id: str | None,
    scope: str,
    role: str,
    token_hash: str,
    token: str,
    base_url: str,
    created_by: str,
    expires_at: datetime | None,
) -> Share:
    row = await conn.execute(
        """
        INSERT INTO shares
            (project_id, resource_id, scope, role, token_hash, created_by, expires_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (project_id, resource_id, scope, role, token_hash, created_by, expires_at),
    )
    result = await row.fetchone()
    assert result is not None
    payload = clean(result)
    payload["token"] = token
    payload["url"] = f"{base_url.rstrip('/')}/share/{payload['id']}"
    return Share.model_validate(payload)


async def get_share_by_token_hash(conn: Connection, token_hash: str) -> dict[str, Any] | None:
    row = await conn.execute(
        """
        SELECT * FROM shares
        WHERE token_hash = %s
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
        """,
        (token_hash,),
    )
    result = await row.fetchone()
    return clean(result) if result else None


async def revoke_share(conn: Connection, share_id: str) -> None:
    await conn.execute(
        "UPDATE shares SET revoked_at = now() WHERE id = %s",
        (share_id,),
    )


async def list_shares_for_project(conn: Connection, project_id: str) -> list[dict[str, Any]]:
    row = await conn.execute(
        "SELECT * FROM shares WHERE project_id = %s ORDER BY created_at DESC",
        (project_id,),
    )
    return [clean(r) for r in await row.fetchall()]


_ = Page, to_models
