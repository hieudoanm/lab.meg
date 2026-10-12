"""Unit tests for S3 storage method wiring."""

from __future__ import annotations

import pytest

from app.core.config import Settings
from app.storage.s3 import S3Storage, _quote_key


class FakeClient:
    class exceptions:
        class ClientError(Exception):
            pass

    def __init__(self):
        self.calls = []

    def head_bucket(self, **kwargs):
        return None

    def head_object(self, **kwargs):
        return {"ContentLength": 3, "ChecksumSHA256": "sum", "ContentType": "text/plain"}

    def put_object(self, **kwargs):
        self.calls.append(("put", kwargs))

    def get_object(self, **kwargs):
        return {"Body": type("Body", (), {"read": lambda self: b"abc"})()}

    def delete_object(self, **kwargs):
        self.calls.append(("delete", kwargs))

    def generate_presigned_url(self, operation, Params, ExpiresIn):
        self.calls.append((operation, Params, ExpiresIn))
        return "https://example.test/object"


@pytest.mark.asyncio
async def test_s3_object_operations_and_presigning(monkeypatch) -> None:
    storage = S3Storage.__new__(S3Storage)
    storage._settings = Settings(s3_bucket="bucket", s3_signed_url_ttl_seconds=60)
    storage._client = FakeClient()

    async def threaded(fn, *args, **kwargs):
        if fn.__name__ == "get_object":
            return {"Body": type("Body", (), {"read": lambda self: b"abc"})()}
        return {"ContentLength": 3, "ChecksumSHA256": "sum", "ContentType": "text/plain"}

    monkeypatch.setattr("app.storage.s3._to_thread", threaded)
    info = await storage.head_object("key")
    assert info is not None and info.size_bytes == 3
    await storage.ensure_bucket()
    await storage.upload_bytes("key", b"abc", checksum_sha256="sum")
    assert await storage.get_object("key") == b"abc"
    await storage.delete_object("key")
    put = await storage.presign_put(
        "key", size_bytes=3, checksum_sha256="sum", media_type="text/plain"
    )
    get = await storage.presign_get("key")
    assert put.headers == {
        "Content-Length": "3",
        "x-amz-checksum-sha256": "sum",
        "Content-Type": "text/plain",
    }
    assert get.method == "GET"
    assert _quote_key("a b/c") == "a%20b/c"
