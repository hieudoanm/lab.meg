"""Internal storage endpoints for the local (file) backend.

These serve the short-lived, single-object, HMAC-signed URLs issued
by :class:`app.storage.local.FileStorage`. They are not part of the
public API surface and carry their own expiry and method-scoped
signature; possession of the URL is the only credential.
"""

from __future__ import annotations

import hashlib
import os
import tempfile
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import FileResponse
from starlette.responses import JSONResponse

from app.api.deps import get_settings
from app.core.exceptions import BadRequestError, PayloadTooLargeError, UnprocessableError
from app.storage.local import FileStorage, verify_signature

router = APIRouter()


def _file_storage(settings: Any) -> FileStorage:
    from app.storage.factory import create_storage

    storage = create_storage(settings)
    if not isinstance(storage, FileStorage):
        raise BadRequestError("internal storage is disabled", code="storage_backend_s3")
    return storage


@router.get("/internal/storage/{object_key:path}")
async def internal_get(
    object_key: str,
    request: Request,
    method: str = Query("GET"),
    expires: int = Query(...),
    sig: str = Query(...),
    size: int | None = Query(None, ge=0),
    checksum: str = Query(""),
    media_type: str = Query(""),
    settings=Depends(get_settings),
) -> Response:
    if method != "GET":
        raise BadRequestError("method not allowed for this URL", code="signed_url_method")
    if not verify_signature(settings, "GET", object_key, expires, size, checksum, media_type, sig):
        from app.core.exceptions import ForbiddenError

        raise ForbiddenError("signed URL is invalid or expired", code="signed_url_invalid")
    storage = _file_storage(settings)
    path = storage._path(object_key)  # noqa: SLF001 - internal router
    if not path.is_file():
        from app.core.exceptions import NotFoundError

        raise NotFoundError("object not found")
    return FileResponse(path, media_type="application/octet-stream")


@router.put("/internal/storage/{object_key:path}")
async def internal_put(
    object_key: str,
    request: Request,
    method: str = Query("PUT"),
    expires: int = Query(...),
    sig: str = Query(...),
    size: int | None = Query(None, ge=0),
    checksum: str = Query(""),
    media_type: str = Query(""),
    settings=Depends(get_settings),
) -> JSONResponse:
    if method != "PUT":
        raise BadRequestError("method not allowed for this URL", code="signed_url_method")
    if size is None:
        raise BadRequestError("signed upload size is missing", code="signed_url_size_missing")
    if not verify_signature(settings, "PUT", object_key, expires, size, checksum, media_type, sig):
        from app.core.exceptions import ForbiddenError

        raise ForbiddenError("signed URL is invalid or expired", code="signed_url_invalid")
    max_upload_bytes = settings.max_upload_bytes
    if size > max_upload_bytes:
        raise PayloadTooLargeError(
            "signed upload exceeds the upload limit", code="upload_too_large"
        )
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            declared_length = int(content_length)
        except ValueError as exc:
            raise BadRequestError(
                "invalid Content-Length header", code="upload_size_invalid"
            ) from exc
        if declared_length != size:
            raise UnprocessableError(
                f"upload size does not match signed size: expected {size}, received {declared_length}",
                code="upload_size_mismatch",
            )
    storage = _file_storage(settings)
    path = storage._path(object_key)  # noqa: SLF001 - internal router
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path: str | None = None
    bytes_received = 0
    digest = hashlib.sha256()
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", dir=path.parent, prefix=f".{path.name}.", delete=False
        ) as temp:
            temp_path = temp.name
            async for chunk in request.stream():
                bytes_received += len(chunk)
                if bytes_received > size or bytes_received > max_upload_bytes:
                    raise PayloadTooLargeError(
                        "uploaded content exceeds the signed size", code="upload_too_large"
                    )
                digest.update(chunk)
                temp.write(chunk)
            if bytes_received != size:
                raise UnprocessableError(
                    f"upload size does not match signed size: expected {size}, received {bytes_received}",
                    code="upload_size_mismatch",
                )
            if checksum and f"sha256:{digest.hexdigest()}" != checksum:
                raise UnprocessableError(
                    "uploaded content checksum mismatch", code="upload_checksum_mismatch"
                )
        os.replace(temp_path, path)
    except Exception:
        if temp_path:
            os.unlink(temp_path)
        raise
    return JSONResponse({"object_key": object_key, "size_bytes": bytes_received}, status_code=200)
