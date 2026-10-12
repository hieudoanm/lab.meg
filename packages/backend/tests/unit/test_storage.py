"""Unit tests for signed upload constraints."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest

from app.core.config import Settings
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
