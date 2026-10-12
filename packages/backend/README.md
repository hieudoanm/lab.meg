# MEG Lab backend

FastAPI backend for MEG Lab: project-scoped magnetoencephalography data management,
sensor geometry, versioned pipelines, and reproducible experiment runs.

## Layout

- `app/` — API process: `core` (config, security, errors, pagination), `db` (pool,
  migrations), `schemas` (Pydantic boundary models), `repositories` (explicit
  parameterized SQL), `services` (business logic), `api` (HTTP routes), `storage`
  (S3-compatible object storage), `scientific` (format adapters, bounded signal
  reads, pipeline execution).
- `workers/` — Celery worker tasks and the transactional-outbox dispatcher.
- `tests/` — unit, integration, and security (tenant isolation) tests.

## Run locally

```bash
cd packages/backend
uv sync --extra dev
uv run python -m app.db.migrate          # apply versioned SQL migrations
uv run uvicorn app.main:app --reload     # API on :8000
uv run celery -A workers.celery_app worker --loglevel=INFO
uv run python -m workers.dispatcher
```

The full stack (PostgreSQL, Redis, MinIO, migrate, api, worker, dispatcher) is
defined in the repository-root `docker-compose.yml`:

```bash
cd ../..
docker compose -p meg-lab up --build
```

## Configuration

All settings are environment variables prefixed with `MEG_` (see
`app/core/config.py`). `AUTH_MODE=development` enables local dev identity with
session cookies (`meg-lab_session`); production requires `AUTH_MODE=oidc` with a
real OIDC provider. Raw and derived MEG signals never pass through PostgreSQL:
recording bytes live in S3-compatible object storage, referenced by object key.
