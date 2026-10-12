"""Unit tests for signed upload constraints."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest

from app.core.config import Settings
from app.storage.factory import create_storage
from app.storage.local import FileStorage, verify_signature
from app.storage.s3 import S3Storage


@pytest.mark.asyncio
async def test_local_put_signature_binds_expected_size(tmp_path) -> None:
    settings = Settings(
        storage_backend="file",
        storage_data_dir=str(tmp_path),
        public_base_url="http://localhost:8000",
    )
    storage = FileStorage(settings)

    signed = await storage.presign_put(
        "uploads/example.fif",
        size_bytes=12,
        checksum_sha256=None,
        media_type="application/octet-stream",
    )
    query = parse_qs(urlparse(signed.url).query)
    expires = int(query["expires"][0])
    signature = query["sig"][0]
    size = int(query["size"][0])

    assert signed.headers == {
        "Content-Length": "12",
    }
    assert size == 12
    assert verify_signature(
        settings,
        "PUT",
        "uploads/example.fif",
        expires,
        size,
        "",
        "application/octet-stream",
        signature,
    )
    assert not verify_signature(
        settings,
        "PUT",
        "uploads/example.fif",
        expires,
        13,
        "",
        "application/octet-stream",
        signature,
    )


def test_s3_presign_binds_content_length(monkeypatch) -> None:
    calls: list[dict[str, object]] = []

    class Client:
        def generate_presigned_url(self, operation, *, Params, ExpiresIn):
            calls.append({"operation": operation, "params": Params, "expires": ExpiresIn})
            return "https://storage.test/upload"

    monkeypatch.setattr("app.storage.s3.boto3.client", lambda *args, **kwargs: Client())
    settings = Settings(
        storage_backend="s3",
        s3_endpoint="http://localhost:9000",
        s3_access_key="access",
        s3_secret_key="secret",
    )
    storage = S3Storage(settings)

    import asyncio

    signed = asyncio.run(
        storage.presign_put(
            "uploads/example.fif",
            size_bytes=12,
            checksum_sha256=None,
            media_type=None,
        )
    )

    assert signed.headers == {"Content-Length": "12"}
    assert calls[0]["params"] == {
        "Bucket": settings.s3_bucket,
        "Key": "uploads/example.fif",
        "ContentLength": 12,
    }


def test_storage_factory_selects_backend(tmp_path) -> None:
    assert (
        type(
            create_storage(Settings(storage_backend="file", storage_data_dir=str(tmp_path)))
        ).__name__
        == "FileStorage"
    )
    assert (
        type(
            create_storage(Settings(storage_backend="s3", s3_access_key="a", s3_secret_key="b"))
        ).__name__
        == "S3Storage"
    )


@pytest.mark.asyncio
async def test_file_storage_round_trip_and_path_escape(tmp_path) -> None:
    settings = Settings(
        storage_backend="file", storage_data_dir=str(tmp_path), session_secret="secret"
    )
    storage = FileStorage(settings)
    await storage.upload_bytes("nested/data.bin", b"hello")
    info = await storage.head_object("nested/data.bin")
    assert info is not None
    assert info.size_bytes == 5
    assert info.checksum_sha256 is not None
    assert info.checksum_sha256.startswith("sha256:")
    assert await storage.get_object("nested/data.bin") == b"hello"
    await storage.delete_object("nested/data.bin")
    assert await storage.head_object("nested/data.bin") is None
    with pytest.raises(ValueError, match="escapes"):
        await storage.get_object("../outside")


def test_s3_presign_includes_optional_constraints(monkeypatch) -> None:
    calls = []

    class Client:
        def generate_presigned_url(self, operation, *, Params, ExpiresIn):
            calls.append((operation, Params, ExpiresIn))
            return "https://storage.test/upload"

    monkeypatch.setattr("app.storage.s3.boto3.client", lambda *args, **kwargs: Client())
    settings = Settings(storage_backend="s3", s3_access_key="access", s3_secret_key="secret")
    storage = S3Storage(settings)
    import asyncio

    signed = asyncio.run(
        storage.presign_put("x", size_bytes=4, checksum_sha256="abc", media_type="text/plain")
    )
    assert signed.headers == {
        "Content-Length": "4",
        "x-amz-checksum-sha256": "abc",
        "Content-Type": "text/plain",
    }
    assert calls[0][1]["ChecksumSHA256"] == "abc"
    assert calls[0][1]["ContentType"] == "text/plain"
