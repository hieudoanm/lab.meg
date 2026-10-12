# MEG Lab — Agent and Contributor Guide

This file contains the repository conventions that automated agents and human contributors must follow.

## 1. Project

MEG Lab is a full-stack computational-neuroimaging workbench demonstration for magnetoencephalography (MEG): organise projects, import MEG recordings, run reproducible signal-processing pipelines, and share results inside project-scoped workspaces.

Read `docs/` before implementing. The documents are normative:

| Document                         | Governs                                                |
| -------------------------------- | ------------------------------------------------------ |
| `docs/00-overview.md`            | Product vision and scope                               |
| `docs/01-requirements/01-requirements.md` | Functional/non-functional requirements (`FR-`, `NFR-`) |
| `docs/03-user-stories/03-user-stories.md` | User goals and acceptance scenarios                    |
| `docs/02-features/02-features.md` | User-visible behaviour                                 |
| `docs/04-architecture/04-architecture.md` | Module boundaries, request lifecycle, tenancy          |
| `docs/05-data-model/05-data-model.md` | Schema, constraints, state transitions                 |
| `docs/06-api-specification/06-api-specification.md` | REST contract, status codes, error envelope            |
| `docs/08-tech-stack/08-tech-stack.md` | Allowed technologies and dependency policy             |
| `docs/07-ui-ux-design/07-ui-ux-design.md` | UI tokens, layout, states, accessibility               |
| `docs/09-testing-strategy/09-testing-strategy.md` | Test layers, fixtures, acceptance criteria             |
| `docs/10-implementation-plan/10-implementation-plan.md` | Phased delivery plan                                   |
| `docs/11-deployment/11-deployment.md` | Operations and deployment                              |

The OpenAPI contract in `docs/06-api-specification/`, the schema in `docs/05-data-model/meg-lab.dbml`, and the diagrams in `docs/04-architecture/diagrams/` are also normative.

When an implementation and a document disagree, stop and resolve the disagreement explicitly rather than silently choosing one.

## 2. Repository layout

```text
meg-lab/
├── packages/
│   ├── frontend/         Next.js + React + TypeScript frontend (desktop-capable)
│   └── backend/          FastAPI application, SQL migrations, worker tasks
├── scripts/              Development, dispatch, and demo-recording scripts
├── docs/                 Normative project documentation
├── demo/                 Recorded feature-demo script and video
└── .github/workflows/    CI
```

Do not create empty placeholder modules. Prefer a small, coherent implementation.

## 3. Toolchain

| Area           | Tool                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Python         | `uv` (lockfile committed), Python 3.15.0 pinned via `.python-version`, `UV_PYTHON` in `.github/workflows/ci.yml`, and `packages/backend/pyproject.toml` |
| Node           | `pnpm`, version pinned to `packages/frontend/.nvmrc` and CI `pnpm/action-setup`                                              |
| Backend lint   | `ruff check`, `ruff format`                                                                                                  |
| Backend types  | `mypy`                                                                                                                       |
| Backend tests  | `pytest` (real PostgreSQL in CI)                                                                                             |
| Frontend lint  | `eslint`, `prettier`                                                                                                         |
| Frontend types | `tsc --noEmit`                                                                                                               |
| Frontend tests | `vitest`, `@testing-library/react`, `playwright` (BFF smoke tests)                                                           |

Run the relevant checks through the root `Makefile`. Never weaken a check to make CI pass.

## 4. Backend conventions

### Structure

- `app/api/` — routes, dependencies, error handlers. Keep handlers thin.
- `app/core/` — configuration, logging, exceptions, security helpers.
- `app/db/` — connection pool and transaction helpers.
- `app/repositories/` — explicit SQL and row mapping only.
- `app/services/` — business operations coordinating repositories and adapters.
- `app/schemas/` — Pydantic request/response models.
- `app/scientific/` — deterministic NumPy/MNE computations.
- `app/storage/` — object-storage adapter (local FS / S3-compatible).
- `app/workers/` — Celery application (or dispatcher) and tasks.

Never import route handlers into business logic. Never expose database rows directly as API responses.

### Database rules

1. All values are passed as query parameters. Never interpolate user input into SQL.
2. Dynamic identifiers come only from trusted allowlists.
3. Transaction boundaries are explicit and kept short. Do not hold a transaction open across object-storage or heavy CPU work.
4. Every tenant-owned query filters by a verified project context supplied by the application layer, never by a raw client value.
5. Every schema change ships as a reviewed, versioned SQL migration.
6. Connection pool usage is bounded; do not share one connection across unrelated tasks.

### API rules

1. Base path is `/api/v1`.
2. Responses use the error envelope from `docs/06-api-specification/06-api-specification.md`.
3. UUIDs identify resources; timestamps are ISO 8601 UTC (`...Z`).
4. Unknown request fields are rejected on writes (`extra="forbid"`).
5. List endpoints use cursor pagination, deterministic ordering, and `DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE`.
6. Never return stack traces, SQL, credentials, object keys, or signed URLs.

### Security rules

1. Deny by default. Authenticate before authorising.
2. `404` is preferred over disclosing another project's resource.
3. Validate and bound every upload before parsing; enforce `MAX_UPLOAD_BYTES`, duration, channel count, and sampling rate limits.
4. Never treat possession of an object-storage key as authorisation.
5. Keep secrets out of the repository, logs, and frontend bundles.
6. Every authorisation path needs a negative test.

## 5. Scientific conventions

1. MEG arrays carry explicit sensor configuration, sampling rate, and coordinate frame metadata.
2. Validation and statistics are deterministic: fixed seeds, no ambient randomness in `app/scientific/`.
3. Every persisted result records dataset version, pipeline version, image digest, parameters, and schema version.
4. MEG processing must not run inside ordinary web request handlers.
5. Never describe computed outputs as clinical findings.

## 6. Testing conventions

1. Tests assert observable behaviour, not internal implementation.
2. Scientific tests compare against independently computed expected values with explicit tolerances.
3. PostgreSQL-dependent tests use a real database, not SQLite or mocks (CI provides a `postgres:18-alpine` service).
4. Tenant (project) isolation and role enforcement are always tested negatively.
5. Worker tests assume duplicate delivery and interruption.
6. Fixtures are synthetic and deterministic. Never commit real patient scans.
7. Mark tests that need external services so they can be skipped deliberately, never silently.

## 7. Frontend conventions

1. Strict TypeScript, no `any`.
2. Design tokens from `docs/07-ui-ux-design/07-ui-ux-design.md`; avoid scattered arbitrary values.
3. Every data screen implements loading, empty, no-results, validation-error, permission-error, network-error, and unexpected-error states.
4. Never show success before the server confirms it.
5. Access the API through the BFF proxy (`/api/proxy/**`, `src/lib/api/`); never call the backend from the browser with raw secrets.
6. Hide unavailable actions for usability, but treat the server as the only authority.

## 8. Delivery rules

1. Keep every commit runnable.
2. Add tests alongside the behaviour they protect.
3. Update documentation when behaviour or scope changes.
4. Record significant decisions in `docs/decisions/`.
5. Do not commit generated data, credentials, or build artifacts.
6. Do not claim a feature that is not implemented and tested (see `demo/meg-lab-demo.md` claim discipline).
