# Backend Guidelines

## Structure

- `app/api/` contains HTTP routes and dependency wiring; keep request parsing and response mapping at the API boundary.
- `app/services/` contains business operations and authorization-aware orchestration.
- `app/repositories/` contains explicit parameterized SQL, transactions, project-scoped filters, and row-to-domain mapping. Never build SQL by interpolating user input.
- `app/schemas/` contains Pydantic API boundary models. Preserve strict validation and reject unknown write fields.
- `app/scientific/` contains deterministic MEG format adapters and bounded signal operations. Keep expensive scientific processing out of request handlers.
- `app/storage/` abstracts local and S3-compatible object storage. Recording bytes and artifacts must not be routed through PostgreSQL or held in API memory unnecessarily.
- `workers/` contains Celery tasks and the transactional-outbox dispatcher. Worker execution must be safe under duplicate delivery, retries, restarts, and stale runs.
- `tests/unit`, `tests/integration`, and `tests/security` mirror the unit, infrastructure, and tenant-isolation concerns.

## Backend Conventions

- Enforce project membership and resource ownership on every protected operation; inaccessible resources should follow the API contract and return `404` where required to avoid information leakage.
- Keep database access asynchronous where the surrounding code is asynchronous, use the existing pool/repository helpers, and preserve transaction boundaries.
- Use explicit typed schemas and domain models rather than broad casts or unvalidated dictionaries.
- Bound upload size, recording duration, channel count, sampling rate, and viewer slice size before parsing. Do not use pickle or unrestricted NumPy loading for untrusted files.
- Preserve provenance, checksums, idempotency, and safe failure states for uploads, pipelines, runs, and artifacts.
- Use deterministic, small synthetic MEG fixtures; do not add large raw recordings without a documented reason and license.

## Commands

Run commands from `packages/backend`:

```bash
uv sync --extra dev
uv run ruff check .
uv run ruff format --check .
uv run mypy app workers
uv run pytest
```

Apply migrations and run local processes with:

```bash
uv run python -m app.db.migrate
uv run uvicorn app.main:app --reload
uv run celery -A workers.celery_app worker --loglevel=INFO
uv run python -m workers.dispatcher
```

Use repository-root Docker Compose when PostgreSQL, Redis, or MinIO is required:

```bash
docker compose -p meg-lab up --build
```

Run the smallest relevant test selection first, for example `uv run pytest tests/unit/test_security.py` or `uv run pytest tests/security/test_isolation.py`. Run integration tests against the configured disposable services rather than silently falling back to mocks.

## Related Documentation

- Backend overview and local setup: `packages/backend/README.md`
- Architecture and boundaries: `docs/05-architecture.md`
- API behavior and security contract: `docs/07-api-spec.md` and `SECURITY.md`
- Testing strategy and scientific invariants: `docs/10-testing-strategy.md`