"""Shared fixtures.

Integration tests require a disposable PostgreSQL instance
(testing strategy §"disposable Postgres per session"). Set
``TEST_DATABASE_URL`` to enable them; otherwise they skip.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import pytest


def _test_settings(**overrides: Any) -> Any:
    from app.core.config import Settings

    storage_dir = Path(os.environ.get("MEG_TEST_STORAGE_DIR", "/tmp/meglab-test-storage"))
    storage_dir.mkdir(parents=True, exist_ok=True)
    kwargs: dict[str, Any] = {
        "app_env": "development",
        "auth_mode": "development",
        "auto_migrate": False,
        "database_url": "postgresql+psycopg://meglab:meglab@localhost:5433/meglab",
        "redis_url": "redis://localhost:6380/0",
        "storage_backend": "file",
        "storage_data_dir": str(storage_dir),
        "public_base_url": "http://localhost:8000",
        "session_secret": "test-session-secret",
        "jwt_secret": "test-jwt-secret",
        "log_level": "WARNING",
    }
    kwargs.update(overrides)
    return Settings(**kwargs)


@pytest.fixture
def settings() -> Any:
    return _test_settings()


@pytest.fixture
def storage(settings: Any) -> Any:
    from app.storage.factory import create_storage

    storage_backend = create_storage(settings)
    import shutil

    shutil.rmtree(settings.storage_data_dir, ignore_errors=True)
    Path(settings.storage_data_dir).mkdir(parents=True, exist_ok=True)
    return storage_backend


@pytest.fixture
def test_db_url() -> str | None:
    url = os.environ.get("TEST_DATABASE_URL")
    return url


@pytest.fixture
async def db_conn(test_db_url: str | None, settings: Any):
    """Integration connection to a disposable PostgreSQL."""
    if test_db_url is None:
        pytest.skip("TEST_DATABASE_URL not set; skipping integration test")
    import psycopg
    from psycopg.rows import dict_row

    from app.db.migrate import run_migrations

    settings.database_url = test_db_url
    assert test_db_url is not None
    conn = await psycopg.AsyncConnection.connect(
        conninfo=test_db_url,
        row_factory=dict_row,
        autocommit=False,
        options="-c timezone=UTC",
    )
    await conn.execute("DROP SCHEMA public CASCADE")
    await conn.execute("CREATE SCHEMA public")
    await run_migrations(conn)
    yield conn
    await conn.close()


@pytest.fixture
async def app(settings: Any):
    from app.main import create_app

    application = create_app(settings)
    return application


@pytest.fixture
def client(app: Any):
    from fastapi.testclient import TestClient

    with TestClient(app) as test_client:
        yield test_client


def _parse_url(url: str) -> dict[str, str]:
    parsed = urlparse(url)
    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
    }
