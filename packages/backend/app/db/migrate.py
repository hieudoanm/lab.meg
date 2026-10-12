"""Versioned SQL migration runner.

Migrations are plain numbered SQL files under ``app/db/migrations``.
Each file is applied once inside a single transaction and recorded in
``schema_migrations``. The canonical ERD lives in
``docs/database/meg-lab.dbml`` and must stay in sync with these files.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import cast

import psycopg
from psycopg.rows import dict_row

from app.db.pool import Connection

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def _available_migrations() -> list[tuple[int, str, str]]:
    entries: list[tuple[int, str, str]] = []
    for path in MIGRATIONS_DIR.glob("*.sql"):
        match = re.match(r"^(\d+)_(.+)\.sql$", path.name)
        if match:
            entries.append((int(match.group(1)), match.group(2), path.read_text()))
    entries.sort(key=lambda e: e[0])
    return entries


async def _applied_versions(conn: Connection) -> set[int]:
    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version integer PRIMARY KEY,
            name text NOT NULL,
            applied_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    rows = await conn.execute("SELECT version FROM schema_migrations")
    return {row["version"] for row in await rows.fetchall()}


async def run_migrations(conn: Connection) -> list[int]:
    """Apply all pending migrations. Idempotent; safe to call repeatedly."""
    applied = await _applied_versions(conn)
    applied_now: list[int] = []
    for version, name, sql in _available_migrations():
        if version in applied:
            continue
        async with conn.transaction():
            await conn.execute(sql)
            await conn.execute(
                "INSERT INTO schema_migrations (version, name) VALUES (%s, %s)",
                (version, name),
            )
        applied_now.append(version)
    return applied_now


async def migrate(conninfo: str | None = None) -> list[int]:
    """Standalone entry point (``python -m app.db.migrate``)."""
    from app.core.config import get_settings

    settings = get_settings()
    kwargs: dict[str, object] = {
        "conninfo": conninfo or settings.database_url,
        "row_factory": dict_row,
        "autocommit": False,
        "options": "-c timezone=UTC",
    }
    async with await psycopg.AsyncConnection.connect(**kwargs) as conn:  # type: ignore[arg-type]
        versions = await run_migrations(cast(Connection, conn))
    return versions


if __name__ == "__main__":
    applied = __import__("asyncio").run(migrate())
    print(f"applied migrations: {applied}")
