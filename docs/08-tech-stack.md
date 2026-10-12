# MEG Lab — Technology Stack

## 1. Purpose

This document defines the technologies, libraries, infrastructure, and development tools used to build MEG Lab. The stack is designed for production-oriented full-stack engineering of a cloud-based computational electrophysiology workbench, with emphasis on maintainability, explicit contracts, testability, reproducibility, and safe scientific data processing.

The implementation must remain consistent with:
- `docs/README.md` (product specification)
- `docs/01-overview.md`
- `docs/design/`
- `docs/database/`
- `docs/api-specs/`

## 2. Technology Principles

1. Use mature, actively maintained technologies.
2. Prefer explicit types and validation at system boundaries (Pydantic v2, strict TypeScript).
3. Keep frontend and backend independently testable.
4. Use asynchronous I/O where it improves throughput.
5. Use PostgreSQL for durable relational state.
6. Keep large scientific recordings and derived artifacts outside the relational database (S3-compatible object storage).
7. Use background workers for computationally expensive operations (no computation in web request handlers).
8. Keep database access explicit and reviewable (parameterised SQL).
9. Make the application reproducible through automated setup, pinned dependencies, and infrastructure configuration.
10. Avoid adding dependencies without a documented product or engineering benefit.

Two rules are non-negotiable:
- **Computation must never run in web request handlers.** No MEG signal processing, filtering, epoching, container invocation, or long-running analysis may execute inside FastAPI request handlers or Next.js server actions. The API returns promptly; Celery workers perform computation.
- **Dependency choices require justification.** Every non-trivial library, service, or runtime must have a documented reason, assigned responsibility, and no overlapping alternative already in the stack.

## 3. Stack Summary

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | Next.js (App Router), React, TypeScript | Interactive MEG signal workspace (Signal Viewer, Sensor Explorer, project/dataset workflows) |
| Styling | Tailwind CSS + daisyUI 5 | Responsive styling, design tokens, accessible UI primitives (`lab-light`/`lab-dark` themes with a toggle) |
| Frontend data layer | React Query (`@tanstack/react-query`) | Server-state caching, retries, revalidation for metadata/runs/signals |
| Signal rendering | Plotly.js (primary); evaluate custom WebGL/canvas renderer | High-density MEG time-series (channel counts up to 300+, ~1000 Hz), bounded windows, multiresolution summaries, smooth panning |
| Sensor visualisation | Three.js (primary); evaluate vtk.js; SVG fallback | 3D helmet/head model, sensor coils/positions/orientations, Sensor Explorer overview |
| API | Python FastAPI + Pydantic v2 | REST API, auth/authorisation, validation, project-scoped access |
| Testing (backend) | pytest, HTTPX | Unit/API integration tests with real PostgreSQL where appropriate |
| Database | PostgreSQL 18 | Relational state: users, projects, datasets, recordings, channels, events, sensor configs, pipelines, runs, artifacts, shares, audit |
| Database driver | Psycopg 3 (async) or asyncpg | Explicit async PostgreSQL access with parameterised queries |
| Database migrations | Alembic (SQL migrations) | Versioned, reviewable schema changes |
| Background jobs | Celery | Asynchronous MEG processing (filtering, epochs, spectra, OPM workflows) |
| Queue/broker | Redis | Job delivery and coordination |
| Reliability | Transactional outbox + outbox dispatcher | Durable, at-least-once job submission; idempotency keys |
| Scientific runtime | Versioned OCI containers (pinned by digest) | Isolated, reproducible execution environments (Python 3.15.0) |
| Scientific libraries | MNE-Python 1.8.x, NumPy, SciPy, Matplotlib | MEG I/O, preprocessing, epochs, spectra, sensor geometry, OPM workflows |
| OPM processing | MNE-Python OPM workflows; evaluate OPM-Python | OPM-specific preprocessing/diagnostics where required |
| Object storage | S3-compatible (MinIO locally, S3/GCS-compatible prod) | Private source recordings, derivatives, artifacts; short-lived signed URLs |
| Containerisation | Docker, Docker Compose | Local/topology reproducibility |
| Authentication | Managed OIDC-compatible identity provider | Identity; HttpOnly session cookie (BFF), Bearer tokens for API/CLI |
| Observability | Structured logs, request IDs, metrics | Request correlation, run logs, diagnostics |
| CI/CD | GitHub Actions | Quality gate (lint/typecheck/tests/build), security scans, container builds |
| Tooling | Husky + lint-staged, Ruff, mypy, ESLint, Prettier, TypeScript | Staged-file fast checks, linting, types |

## 4. Frontend

### 4.1 Next.js + React + TypeScript
- App Router, strict TypeScript (`strict: true`, no `any` without documented exception).
- Client components only where interactivity required (Signal Viewer, Sensor Explorer, forms).
- Keep MEG visualisation code in client components (Plotly.js/Three.js depend on browser APIs).
- Type API resources explicitly; model run states as finite union (`queued`, `running`, `succeeded`, `failed`, `cancelled`).

### 4.2 Styling (Tailwind CSS + daisyUI 5)
Two themes (`lab-light` default, `lab-dark`) with tokens aligned with the shipped prototype:
- `lab-light` background `#F6F8FB`, surface `#FFFFFF`, accent `#4059C7`
- `lab-dark` background `#0B0F14`, surface `#121821`, accent `#4C8DFF`

Requirements: centralise tokens, prefer daisyUI primitives, accessible focus states/contrast, avoid arbitrary values, reusable components.

### 4.3 Data Fetching (React Query)
- Typed API client centralising auth (Bearer/session), error normalisation, cancellation.
- Treat runs, artifacts, bounded signal windows as server state.
- Revalidate on mutations; paginate/bound requests (never fetch entire recordings client-side).
- Signals endpoint: request bounded windows with explicit `tmin/tmax` and resolution/decimation.

### 4.4 Signal Rendering (Plotly.js)
Primary: Plotly.js for multichannel time-series. Decision factors: up to ~300 channels, ~1000 Hz, smooth panning over minutes, channel selection/hiding/groups, event overlays. 
Evaluation: custom WebGL/canvas renderer if memory/overdraw becomes limiting for dense views; prefer multiresolution summaries + bounded windows by design (API returns bounded windows, never whole recording).

### 4.5 Sensor Visualisation (Three.js)
Primary: Three.js for 3D helmet/head model + sensor coils/positions/orientations with coordinate frame awareness (head/world). 
Secondary: evaluate vtk.js for alternate geometry workflows. SVG fallback for Sensor Explorer overview (simplified layout). Geometry consumed from `GET /api/v1/recordings/{id}/sensors`.

### 4.6 Frontend Conventions
- Arrow functions for all declarations.
- Prefer `const`; no `var`.
- Named exports for utilities/components; default exports for page/layouts as required.
- Colocate tests in `__tests__/`.
- Keep domain logic separate from visual components.

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

## 6. Database (PostgreSQL)

### 6.1 PostgreSQL 18
Authoritative state; arrays/large numeric blobs (raw MEG arrays) never stored in rows. Object storage for recordings/artifacts. JSONB allowed for geometry/manifest blobs where captured in DBML. 
Driver: Psycopg 3 (async) preferred; asyncpg acceptable if consistent with async stack.

### 6.2 Migrations
Alembic migrations (SQL-based migration scripts where appropriate), applied transactionally. Runner tracks versions/checksums; destructive changes treated carefully. CI runs migrations before tests.

### 6.3 Data Model (logical)
Core entities: `users`, `projects`, `project_members`, `datasets`, `dataset_versions`, `recordings`, `file_assets`, `channels`, `sensor_configurations`, `event_sets`, `pipelines`, `pipeline_versions`, `experiment_runs`, `artifacts`, `shares`, `audit_events`, `idempotency_keys`, `outbox_events`. Every tenant-owned query enforces project scope.

### 6.4 Access Rules
Parameterised SQL only; transactions for multi-step state changes; constraints/indexes by access patterns; connection pooling; row-level security may supplement (not substitute) app-level auth.

## 7. Object Storage & Uploads

### 7.1 S3-Compatible Storage
- Private by default; block public access.
- MinIO locally (dev/CI); S3/GCS-compatible in production.
- Short-lived signed URLs for banded reads/uploads (single-object scoped).
- Object key possession != authorisation.
- Validate upload authorisation before finalising; checksum (SHA-256) + size checks.
- Never expose object keys in public API responses.
- Bounded decompression and format validation on upload finalisation (`POST /api/v1/datasets/{id}/complete`).
- Resumable uploads supported.

## 8. Background Jobs & Execution

### 8.1 Celery + Redis
- Celery workers consume jobs from Redis broker.
- Transactional outbox: API writes run + outbox in same transaction; outbox dispatcher publishes to queue (idempotent).
- Idempotency keys on run submission (`POST /api/v1/runs`, `Idempotency-Key` header).
- Tasks idempotent under redelivery; explicit run-state transitions; concurrency controls prevent conflicting workers.
- Resource limits: CPU/memory/wall-clock per job; timeouts; bounded retries with backoff.
- Worker isolation: no cross-project access; no app secrets by default; restricted egress.
- OCI runtime: worker launches versioned OCI containers pinned by digest. Image includes Python 3.15.0, MNE-Python, NumPy, SciPy, and Matplotlib. Separate OPM-oriented image where preprocessing differs. Record `image_digest` in `pipeline_versions` and experiment manifests.

### 8.2 Processing Model
- All MEG computation in isolated containers/workers (never in API handlers).
- Bounded signal access: workers read only required windows/files; respect dataset scoping.
- Experiment manifest captures: `run_id`, pipeline (name/version/image_digest), inputs (dataset_version_id/checksum), parameters, environment, outputs, status.

## 9. Authentication & Session Model

- Managed OIDC-compatible identity provider.
- Browser: HttpOnly session cookie held by BFF (`meg-lab_session`).
- Machine/CLI: `Authorization: Bearer <token>`.
- Short-lived tokens; secure cookie attributes in prod (HttpOnly, Secure, SameSite, path/domain scoped).
- Logout invalidates session/token as appropriate.

## 10. Infrastructure, Local Topology & CI

### 10.1 Docker Compose (local/self-hosted)
Local topology includes: `frontend`, `api`, `celery worker`, `outbox dispatcher`, `postgres`, `redis`, `minio`. One-shot migration task. Services use same images across envs; env-specific values via `.env` (no secrets in repo).

### 10.2 CI (GitHub Actions)
Quality gate per repo conventions:
- Frontend: install (pnpm --frozen-lockfile), lint, format:check, typecheck, test, build; audit artifacts.
- Backend: sync (uv), Ruff format/check, mypy, migrations upgrade, pytest with coverage, pip-audit artifact.
- E2E: Playwright Chromium smoke tests (critical workflow).
- Security: Trivy filesystem scan (SARIF upload).
- Desktop builds/release (Tauri) on master as configured.

### 10.3 Monorepo
npm/pnpm monorepo `@meg-lab/workspace` with `packages/frontend` (`@meg-lab/web`) and `packages/backend`. Workspace layout supports independent build/test.

## 11. Tooling & Code Quality

- Python: Ruff (format+lint), mypy (strict where practical). uv for dependency management; `uv.lock` pinned.
- TypeScript: ESLint, Prettier, `tsc --noEmit`. pnpm with lockfile; `pnpm-lock.yaml` pinned.
- Git hooks: Husky + lint-staged (Ruff/ESLint+Prettier on staged files).
- Tests: Vitest + React Testing Library + Playwright (frontend); pytest + HTTPX (backend).
- Dependency policy: pinned versions in lockfiles; production deps reviewed; container digests pinned; avoid multiple libs for same responsibility.

## 12. Documented Trade-offs

| Decision | Considered | Chosen | Rationale |
|---|---|---|---|
| Signal rendering | Plotly.js vs custom WebGL/canvas | Plotly.js (primary); custom WebGL/canvas eval | Plotly fast for 300+ channels, event overlays, panning; custom gives max perf but higher surface area; API enforces bounded windows/multiresolution to mitigate cost. |
| Sensor visualisation | Three.js vs vtk.js vs SVG fallback | Three.js (primary); vtk.js eval; SVG fallback | Three.js lightweight for head+coils/orientations; vtk.js powerful but heavier for simple helmet; SVG good for overview. |
| DB access | ORM (SQLAlchemy) vs explicit SQL (Psycopg) | Explicit SQL (Psycopg 3 async) | Clarity for project-scoped queries, constraints, migrations reviewability, avoids hidden N+1/joins; repository layer centralises SQL. |
| Geometry/storage | JSONB geometry in DB vs normalised rows | JSONB where stable blobs (manifest/geometry) + normalised core entities | Balance queryability and schema simplicity for variable OPM arrays; never store raw signal arrays. |
| Queue | Celery+Redis vs managed queue | Celery+Redis (initial) | Open, testable locally, matches Docker Compose topology; can migrate to managed later. |
| Worker profiles | Single worker profile vs split (preprocess/analysis/OPM) | Single profile initially; split eval | Start simple; OPM preprocessing differs (separate image + potential resource profile) — plan split when justified. |
| Scientific core | MNE-Python vs OPM-Python alone | MNE-Python backbone + OPM-Python eval | MNE-Python broad MEG support (FIF/CTF/KIT/BIDS), active ecosystem; OPM-Python modular for OPM-specific cases; integrate as needed. |
| Deployment | Kubernetes vs Docker Compose | Docker Compose (now) | Proven self-hosting path first; avoid K8s complexity before scale/requirements justify. Terraform deferred until cloud deployment pursued. |
| Auth | Custom auth vs managed OIDC | Managed OIDC-compatible IdP | Reduce identity surface area; BFF pattern (HttpOnly cookie + Bearer for API/CLI). |

## 13. Configuration & Secrets

- Env vars via `.env` (local); managed secrets in prod. `.env.example` with placeholders only.
- Required: `APP_ENV`, `AUTH_MODE`/OIDC settings, `DATABASE_URL`, `REDIS_URL`, `S3_*` (endpoint/bucket/creds/region), `API_BASE_URL`, OCI image refs (by digest), limits (upload/job/timeouts), `LOG_LEVEL`, `CORS_ORIGINS`.
- Validate at startup; fail clearly on missing required config. Never commit secrets.

## 14. Definition of Done (Tech Stack)

1. Frontend/backend independent build/test/typecheck/lint in CI.
2. PostgreSQL migrations applied and tested.
3. All DB queries parameterised; project scope enforced.
4. No computation in web request handlers; Celery workers + transactional outbox.
5. Large recordings/artifacts in object storage; no raw arrays in DB rows.
6. MEG processing uses MNE-Python (and OPM paths where specified); spatial metadata preserved.
7. Coordinate frames/units documented and reflected in API (signals/sensors).
8. Config/secrets handled safely; local dev reproducible via Docker Compose.
9. Bounded signal access enforced (API returns bounded windows; workers bounded reads).
10. OCI images pinned by digest; `image_digest` recorded in pipeline versions/manifests.
11. Short-lived signed URLs, single-object scoped; authz on every protected op.
12. Each selected technology justified with responsibility and documented trade-offs; deferred tech not introduced without reason.

(End of document)