"""Coverage for shared persistence helpers, pool lifecycle, and health routes."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any, cast

import pytest
from pydantic import BaseModel
from starlette.requests import Request

from app.api.routes import internal, usage
from app.core.exceptions import BadRequestError, PayloadTooLargeError, UnprocessableError
from app.db import pool
from app.repositories import _shared


class Item(BaseModel):
    id: str
    created_at: datetime


def request_with_body(
    body: bytes = b"", headers: list[tuple[bytes, bytes]] | None = None
) -> Request:
    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    return Request(
        {
            "type": "http",
            "method": "PUT",
            "path": "/",
            "query_string": b"",
            "headers": headers or [],
        },
        receive,
    )


def test_shared_helpers_cover_json_uuid_models_and_pagination() -> None:
    now = datetime.now(UTC)
    item = Item(id="item-1", created_at=now)
    assert _shared.to_jsonb(None) is None
    assert _shared.to_jsonb({"x": 1}) is not None
    assert _shared.clean({"id": uuid.UUID(int=1)})["id"] == str(uuid.UUID(int=1))
    assert _shared.to_model(Item, None) is None
    assert _shared.to_model(Item, {"id": "item-1", "created_at": now}) == item
    assert _shared.to_models(Item, [{"id": "item-1", "created_at": now}]) == [item]
    assert _shared.cursor_where(None) == ("", [])
    assert _shared.cursor_where("invalid") == ("", [])
    cursor = _shared.next_cursor(item)
    assert _shared.cursor_where(cursor, "i")[0].startswith("((i.created_at")
    page, next_cursor, has_more = _shared.paginate([item, item], 1)
    assert page == [item] and next_cursor and has_more
    assert _shared.paginate([item], 2) == ([item], None, False)
    value = uuid.uuid4()
    assert _shared.coerce_uuid(value) == value
    assert _shared.coerce_uuid(str(value)) == value


@pytest.mark.asyncio
async def test_pool_lifecycle_and_connection_context(monkeypatch) -> None:
    class FakePool:
        @classmethod
        def __class_getitem__(cls, item):
            return cls

        def __init__(self, **kwargs):
            self.kwargs = kwargs
            self.closed = False

        async def close(self):
            self.closed = True

        def connection(self):
            return _ConnectionContext()

    class _ConnectionContext:
        async def __aenter__(self):
            return "connection"

        async def __aexit__(self, *args):
            return None

    monkeypatch.setattr(pool, "AsyncConnectionPool", FakePool)
    settings = cast(Any, SimpleNamespace(database_url="postgresql://localhost/db"))
    created = await pool.init_pool(settings)
    assert pool.get_pool() is created
    async with pool.get_connection() as conn:
        assert conn == "connection"
    await pool.close_pool()
    with pytest.raises(RuntimeError, match="not initialised"):
        pool.get_pool()
    await pool.close_pool()


@pytest.mark.asyncio
async def test_internal_signed_storage_validates_uploads(monkeypatch) -> None:
    settings = SimpleNamespace(max_upload_bytes=4, storage_backend="local")
    with pytest.raises(BadRequestError, match="method"):
        await internal.internal_put(
            "object", request_with_body(), method="GET", expires=1, sig="", settings=settings
        )
    with pytest.raises(BadRequestError, match="missing"):
        await internal.internal_put(
            "object",
            request_with_body(),
            method="PUT",
            expires=1,
            sig="",
            size=None,
            settings=settings,
        )
    monkeypatch.setattr(internal, "verify_signature", lambda *args: False)
    with pytest.raises(Exception, match="invalid"):
        await internal.internal_put(
            "object",
            request_with_body(),
            method="PUT",
            expires=1,
            sig="bad",
            size=1,
            settings=settings,
        )
    monkeypatch.setattr(internal, "verify_signature", lambda *args: True)
    monkeypatch.setattr(internal, "_file_storage", lambda settings: SimpleNamespace())
    with pytest.raises(PayloadTooLargeError, match="limit"):
        await internal.internal_put(
            "object",
            request_with_body(),
            method="PUT",
            expires=1,
            sig="ok",
            size=5,
            settings=settings,
        )
    with pytest.raises(UnprocessableError, match="expected"):
        await internal.internal_put(
            "object",
            request_with_body(b"x", [(b"content-length", b"1")]),
            method="PUT",
            expires=1,
            sig="ok",
            size=2,
            settings=settings,
        )


@pytest.mark.asyncio
async def test_internal_signed_storage_writes_and_reads_object(monkeypatch, tmp_path) -> None:
    settings = SimpleNamespace(max_upload_bytes=10)
    object_path = tmp_path / "object.bin"
    storage = SimpleNamespace(_path=lambda key: object_path)
    monkeypatch.setattr(internal, "_file_storage", lambda settings: storage)
    monkeypatch.setattr(internal, "verify_signature", lambda *args: True)
    response = await internal.internal_put(
        "object.bin",
        request_with_body(b"abc", [(b"content-length", b"3")]),
        method="PUT",
        expires=1,
        sig="ok",
        size=3,
        checksum="",
        media_type="",
        settings=settings,
    )
    assert response.status_code == 200
    assert object_path.read_bytes() == b"abc"
    get_response = await internal.internal_get(
        "object.bin",
        request_with_body(),
        method="GET",
        expires=1,
        sig="ok",
        checksum="",
        media_type="",
        settings=settings,
    )
    assert get_response.media_type == "application/octet-stream"


@pytest.mark.asyncio
async def test_internal_storage_get_and_health_routes(monkeypatch, tmp_path) -> None:
    settings = SimpleNamespace(max_upload_bytes=10)
    monkeypatch.setattr(internal, "verify_signature", lambda *args: False)
    with pytest.raises(Exception, match="invalid"):
        await internal.internal_get(
            "object", request_with_body(), method="GET", expires=1, sig="", settings=settings
        )
    assert (await usage.health_live()).status == "ok"

    def no_pool():
        raise RuntimeError("offline")

    async def no_bucket():
        raise RuntimeError("offline")

    monkeypatch.setattr(usage, "get_pool", no_pool)
    monkeypatch.setattr(
        "app.storage.factory.create_storage",
        lambda settings: SimpleNamespace(ensure_bucket=no_bucket),
    )
    response = await usage.health_ready()
    assert response.status_code == 503
    assert (await usage.healthz()).status == "ok"
    assert (await usage.readyz()).status_code == 503
