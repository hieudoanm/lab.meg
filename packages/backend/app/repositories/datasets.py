"""Dataset, dataset version, upload session, and file asset repositories."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.db.pool import Connection
from app.repositories._shared import (
    clean,
    cursor_where,
    paginate,
    to_jsonb,
    to_model,
    to_models,
)
from app.schemas.datasets import (
    Dataset,
    DatasetCreate,
    DatasetVersion,
    FileDeclaration,
    UploadSession,
    UploadTarget,
)


async def create_dataset(
    conn: Connection,
    *,
    project_id: str,
    name: str,
    source_type: str,
    status: str = "uploading",
) -> Dataset:
    row = await conn.execute(
        """
        INSERT INTO datasets (project_id, name, source_type, status)
        VALUES (%s, %s, %s, %s)
        RETURNING *
        """,
        (project_id, name, source_type, status),
    )
    dataset = to_model(Dataset, await row.fetchone())
    assert dataset is not None
    return dataset


async def get_dataset_by_id(conn: Connection, dataset_id: str) -> Dataset | None:
    row = await conn.execute(
        """
        SELECT d.*,
               (SELECT dv.version FROM dataset_versions dv
                WHERE dv.dataset_id = d.id ORDER BY dv.created_at DESC LIMIT 1) AS latest_version
        FROM datasets d WHERE d.id = %s
        """,
        (dataset_id,),
    )
    return to_model(Dataset, await row.fetchone())


async def list_datasets_for_project(
    conn: Connection,
    *,
    project_id: str,
    limit: int,
    cursor: str | None,
) -> tuple[list[Dataset], str | None, bool]:
    condition, params = cursor_where(cursor)
    sql = f"""
        SELECT d.*,
               (SELECT dv.version FROM dataset_versions dv
                WHERE dv.dataset_id = d.id ORDER BY dv.created_at DESC LIMIT 1) AS latest_version
        FROM datasets d
        WHERE d.project_id = %s {condition}
        ORDER BY d.created_at DESC, d.id ASC
        LIMIT %s
    """
    row = await conn.execute(sql, [project_id, *params, limit + 1])
    datasets = to_models(Dataset, await row.fetchall())
    return paginate(datasets, limit)


async def update_dataset_status(conn: Connection, dataset_id: str, status: str) -> None:
    await conn.execute(
        "UPDATE datasets SET status = %s, updated_at = now() WHERE id = %s",
        (status, dataset_id),
    )


async def next_version_label(conn: Connection, dataset_id: str) -> str:
    row = await conn.execute(
        "SELECT count(*) AS n FROM dataset_versions WHERE dataset_id = %s",
        (dataset_id,),
    )
    result = await row.fetchone()
    return f"v{int(result['n']) + 1}"  # type: ignore[index]


async def create_dataset_version(
    conn: Connection,
    *,
    dataset_id: str,
    version: str,
    manifest: dict[str, Any],
    status: str,
    checksum: str | None,
) -> DatasetVersion:
    row = await conn.execute(
        """
        INSERT INTO dataset_versions (dataset_id, version, manifest, status, checksum)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING *
        """,
        (dataset_id, version, to_jsonb(manifest), status, checksum),
    )
    dataset_version = to_model(DatasetVersion, await row.fetchone())
    assert dataset_version is not None
    return dataset_version


async def get_dataset_version_by_id(conn: Connection, version_id: str) -> DatasetVersion | None:
    row = await conn.execute(
        """
        SELECT dv.*,
               (SELECT COALESCE(jsonb_agg(r.id::text ORDER BY r.created_at), '[]'::jsonb)
                FROM recordings r WHERE r.dataset_version_id = dv.id) AS recording_ids
        FROM dataset_versions dv WHERE dv.id = %s
        """,
        (version_id,),
    )
    return to_model(DatasetVersion, await row.fetchone())


async def get_dataset_version_by_label(
    conn: Connection, dataset_id: str, version: str
) -> DatasetVersion | None:
    row = await conn.execute(
        "SELECT * FROM dataset_versions WHERE dataset_id = %s AND version = %s",
        (dataset_id, version),
    )
    return to_model(DatasetVersion, await row.fetchone())


async def get_latest_dataset_version(conn: Connection, dataset_id: str) -> DatasetVersion | None:
    row = await conn.execute(
        """
        SELECT dv.* FROM dataset_versions dv
        WHERE dv.dataset_id = %s
        ORDER BY dv.created_at DESC LIMIT 1
        """,
        (dataset_id,),
    )
    return to_model(DatasetVersion, await row.fetchone())


async def update_dataset_version_status(
    conn: Connection, version_id: str, status: str, checksum: str | None = None
) -> None:
    await conn.execute(
        "UPDATE dataset_versions SET status = %s, checksum = COALESCE(%s, checksum) WHERE id = %s",
        (status, checksum, version_id),
    )


async def create_upload_session(
    conn: Connection,
    *,
    dataset_id: str,
    project_id: str,
    expected_size_bytes: int | None,
    checksum_sha256: str | None,
    expires_at: datetime,
    declared_format: str | None = None,
    acquisition_system: str | None = None,
) -> UploadSession:
    row = await conn.execute(
        """
        INSERT INTO upload_sessions
            (dataset_id, project_id, expected_size_bytes, checksum_sha256,
             expires_at, declared_format, acquisition_system)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            dataset_id,
            project_id,
            expected_size_bytes,
            checksum_sha256,
            expires_at,
            declared_format,
            acquisition_system,
        ),
    )
    session = to_model(UploadSession, await row.fetchone())
    assert session is not None
    return session


async def get_active_upload_session(conn: Connection, dataset_id: str) -> UploadSession | None:
    row = await conn.execute(
        """
        SELECT * FROM upload_sessions
        WHERE dataset_id = %s AND status = 'pending' AND expires_at > now()
        ORDER BY created_at DESC LIMIT 1
        """,
        (dataset_id,),
    )
    return to_model(UploadSession, await row.fetchone())


async def get_active_upload_session_row(conn: Connection, dataset_id: str) -> dict[str, Any] | None:
    """Raw active upload session row, including declared format context."""
    row = await conn.execute(
        """
        SELECT * FROM upload_sessions
        WHERE dataset_id = %s AND status = 'pending' AND expires_at > now()
        ORDER BY created_at DESC LIMIT 1
        """,
        (dataset_id,),
    )
    result = await row.fetchone()
    return clean(result) if result else None


async def get_upload_session(conn: Connection, session_id: str) -> UploadSession | None:
    row = await conn.execute(
        "SELECT * FROM upload_sessions WHERE id = %s",
        (session_id,),
    )
    return to_model(UploadSession, await row.fetchone())


async def add_upload_target(
    conn: Connection,
    *,
    upload_session_id: str,
    name: str,
    object_key: str,
    size_bytes: int,
    checksum_sha256: str | None,
    media_type: str | None,
    role: str,
) -> UploadTarget:
    row = await conn.execute(
        """
        INSERT INTO upload_targets
            (upload_session_id, name, object_key, size_bytes, checksum_sha256, media_type, role)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (upload_session_id, name, object_key, size_bytes, checksum_sha256, media_type, role),
    )
    target = to_model(UploadTarget, await row.fetchone())
    assert target is not None
    return target


async def list_upload_targets(conn: Connection, upload_session_id: str) -> list[UploadTarget]:
    row = await conn.execute(
        "SELECT * FROM upload_targets WHERE upload_session_id = %s ORDER BY created_at ASC",
        (upload_session_id,),
    )
    return to_models(UploadTarget, await row.fetchall())


async def mark_upload_session_completed(conn: Connection, session_id: str) -> None:
    await conn.execute(
        "UPDATE upload_sessions SET status = 'completed', completed_at = now() WHERE id = %s",
        (session_id,),
    )


async def create_file_asset(
    conn: Connection,
    *,
    recording_id: str,
    object_key: str,
    checksum: str,
    size_bytes: int,
    media_type: str,
    role: str,
) -> None:
    await conn.execute(
        """
        INSERT INTO file_assets (recording_id, object_key, checksum, size_bytes, media_type, role)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (object_key) DO NOTHING
        """,
        (recording_id, object_key, checksum, size_bytes, media_type, role),
    )


async def list_file_assets(conn: Connection, recording_id: str) -> list[dict[str, Any]]:
    row = await conn.execute(
        "SELECT * FROM file_assets WHERE recording_id = %s ORDER BY created_at ASC",
        (recording_id,),
    )
    return [clean(r) for r in await row.fetchall()]


async def get_file_asset_by_key(conn: Connection, object_key: str) -> dict[str, Any] | None:
    row = await conn.execute(
        "SELECT * FROM file_assets WHERE object_key = %s",
        (object_key,),
    )
    result = await row.fetchone()
    return clean(result) if result else None


async def count_file_assets_for_dataset_version(conn: Connection, dataset_version_id: str) -> int:
    row = await conn.execute(
        """
        SELECT count(*) AS n
        FROM file_assets fa
        JOIN recordings r ON r.id = fa.recording_id
        WHERE r.dataset_version_id = %s
        """,
        (dataset_version_id,),
    )
    result = await row.fetchone()
    return int(result["n"])  # type: ignore[index]


def _unused(declarations: list[FileDeclaration], create: DatasetCreate) -> None:  # pragma: no cover
    pass
