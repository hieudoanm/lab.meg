"""API error taxonomy and error envelope.

All errors are returned as
``{"error": {"code", "message", "details"?, "trace_id"}}`` with a
matching ``X-Request-Id`` response header (API spec §4, §14).
"""

from __future__ import annotations

from typing import Any


class ApiError(Exception):
    status_code: int = 500
    code: str = "internal_error"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        details: list[dict[str, Any]] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        self.details = details
        self.headers = headers


class BadRequestError(ApiError):
    status_code = 400
    code = "bad_request"


class UnauthorizedError(ApiError):
    status_code = 401
    code = "unauthorized"

    def __init__(self, message: str = "Authentication required", **kwargs: Any) -> None:
        super().__init__(message, **kwargs)
        self.headers = {"WWW-Authenticate": "Bearer"}


class ForbiddenError(ApiError):
    status_code = 403
    code = "forbidden"


class NotFoundError(ApiError):
    status_code = 404
    code = "not_found"


class ConflictError(ApiError):
    status_code = 409
    code = "conflict"


class PayloadTooLargeError(ApiError):
    status_code = 413
    code = "payload_too_large"


class UnprocessableError(ApiError):
    status_code = 422
    code = "unprocessable"


class TooManyRequestsError(ApiError):
    status_code = 429
    code = "too_many_requests"


class InternalError(ApiError):
    status_code = 500
    code = "internal_error"


def error_payload(error: ApiError, trace_id: str) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "error": {
            "code": error.code,
            "message": error.message,
            "trace_id": trace_id,
        }
    }
    if error.details:
        payload["error"]["details"] = error.details
    return payload
