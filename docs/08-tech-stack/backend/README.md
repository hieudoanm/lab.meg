# Backend

## 5. Backend (API + Services)

### 5.1 Python + FastAPI + Pydantic v2
- Python 3.15.0 pinned in OCI images and tooling.
- Router/Repository/Service layout (thin route handlers). No MEG processing in handlers.
- Pydantic v2 for request/response/config validation; separate request/response models where lifecycle differs; reject unknown fields on write where practical.
- Async handlers for I/O-bound operations; delegate CPU-bound work to Celery.

### 5.2 Auth & Authorisation
- Managed OIDC-compatible identity provider.
- HttpOnly session cookie held by BFF (browser), Bearer tokens for API/CLI.
- Project-scoped RBAC (owner/editor/viewer); membership checks on every protected resource; `404` for inaccessible (avoid leakage); cross-project denied.

### 5.3 Error Handling
Consistent Error Envelope with stable codes, human-readable message, optional field details, `request_id`. No stack traces, SQL, credentials, internal paths, or raw signal data in responses/logs.

