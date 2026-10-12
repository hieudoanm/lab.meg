"""Async PostgreSQL connection pool (Psycopg 3)."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from app.core.config import Settings

# Connections are configured with ``dict_row`` so every row is a mapping.
# Annotating the generic parameter reflects that and keeps repositories
# type-safe (rows are ``dict[str, Any]`` rather than tuples).
Connection = psycopg.AsyncConnection[dict[str, Any]]

_pool: AsyncConnectionPool[Connection] | None = None


def _pool_kwargs(settings: Settings) -> dict[str, Any]:
    return {
        "row_factory": dict_row,
        "autocommit": False,
        # All timestamps are UTC; the API never performs local-time math.
        "options": "-c timezone=UTC",
    }


async def init_pool(settings: Settings) -> AsyncConnectionPool[Connection]:
    global _pool
    _pool = AsyncConnectionPool[Connection](
        conninfo=settings.database_url,
        kwargs=_pool_kwargs(settings),
        open=True,
        min_size=2,
        max_size=16,
    )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> AsyncConnectionPool[Connection]:
    if _pool is None:
        raise RuntimeError("connection pool is not initialised")
    return _pool


@asynccontextmanager
async def get_connection() -> AsyncIterator[Connection]:
    """Yield a pooled connection; transactions are opened explicitly by services."""
    pool = get_pool()
    async with pool.connection() as conn:
        yield conn
