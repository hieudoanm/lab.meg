# MEG Lab — Deployment

## 1. Purpose

This document defines how to run, test, deploy, monitor, maintain, and safely tear down MEG Lab.

MEG Lab is an independent cloud-based computational electrophysiology SaaS portfolio project built with:

- Next.js (App Router), React, and TypeScript.
- Python 3.14, FastAPI, and Pydantic.
- PostgreSQL and Psycopg 3.
- Celery and Redis.
- MNE-Python, NumPy, SciPy, and Matplotlib for scientific I/O and analysis.
- MinIO (S3-compatible) object storage for local and self-hosted environments.
- Docker and Docker Compose.
- GitHub Actions.

The deployment strategy prioritises reproducibility, security, reasonable operating costs, and a clear path from local development to a publicly accessible demonstration.

The primary deployment target is a **CI-first, Docker-Compose-first self-hosted stack**. Cloud providers, Terraform, and Kubernetes are explicitly deferred and are documented only as a future evolution. The platform must build, test, and run without them.

The repository is a pnpm monorepo rooted at `@meg-lab/workspace` with `packages/frontend` (`@meg-lab/web`) and `packages/backend` (FastAPI API, Celery worker, outbox dispatcher, and migrations).

## 2. Deployment Principles

1. Keep local development straightforward.
2. Keep production credentials out of source control.
3. Separate frontend, API, background-worker, and dispatcher responsibilities.
4. Keep raw recordings, derivatives, and artifacts in private object storage.
5. Keep PostgreSQL inaccessible to unauthorised public clients.
6. Use least-privilege storage credentials and short-lived signed URLs.
7. Manage the environment as code through `docker-compose.yaml`.
8. Apply database migrations through a controlled, one-shot step.
9. Make deployments observable and recoverable.
10. Minimise always-on infrastructure for a portfolio project.
11. Document recurring costs and resource cleanup.
12. Never use real participant or clinical recordings in the demonstration without an appropriate data-governance process.
13. Do not introduce a cloud provider, Terraform, or Kubernetes until the Compose deployment is proven and a demonstrated requirement justifies the extra operational cost.

## 3. Environment Strategy

Use three logical environments.

| Environment            | Purpose                        | Data                        | Runtime                                       |
| ---------------------- | ------------------------------ | --------------------------- | --------------------------------------------- |
| Local                  | Daily development              | Synthetic data              | Docker Compose or host processes              |
| CI                     | Automated testing              | Isolated synthetic fixtures | GitHub Actions, pinned PostgreSQL service     |
| Self-hosted production | Public portfolio demonstration | Synthetic data only         | Docker Compose on a single hardened host      |

A separate staging environment may be introduced when the deployment complexity justifies it. Until then, the self-hosted stack is promoted only after CI passes on `master`.

### 3.1 Environment isolation

Each environment should have its own:

- Configuration (`.env` file or CI environment variables).
- Database (separate database or instance).
- Object-storage bucket and credentials.
- Scientific worker image digest.
- Authentication configuration.
- Secrets.
- Logging context.

Do not let CI or local development accidentally write to the production database or production storage bucket. CI uses an ephemeral, throwaway PostgreSQL service and does not require object-storage credentials for the default jobs. The worker image used by CI is built and pinned by digest within the workflow rather than pulled from production.

## 4. Local Development

### 4.1 Prerequisites

Install supported versions of:

- Node.js (see `packages/frontend/.nvmrc`).
- pnpm (pinned through `packageManager` in `package.json`).
- Python 3.14 managed through `uv`.
- Docker and Docker Compose.
- Git.

Run `pnpm install` from the repository root to install JavaScript dependencies and set up Husky Git hooks. Before each commit, lint-staged runs Ruff on staged backend Python files and ESLint/Prettier on staged frontend source files; these local checks do not replace CI.

Pin or document supported versions. Do not assume that the newest release of every tool is compatible with the repository. The scientific runtime is pinned deliberately to Python 3.14 and MNE-Python 1.8.1 so that behaviour matches the versioned worker image.

### 4.2 Suggested local services

Run these services with Docker Compose (`docker compose up --build`):

- Next.js frontend (`web`, `localhost:3000`).
- FastAPI API (`api`, `localhost:8000`, serving `/api/v1`).
- PostgreSQL (`postgres`) and Redis (`redis`).
- MinIO (`minio`, S3-compatible object storage) with its console on `localhost:9001`.
- Celery worker (`worker`) and outbox dispatcher (`dispatcher`).
- A one-shot migration service that completes before the API and worker start.

Compose persists PostgreSQL data, MinIO objects, and local uploads in named volumes. Use `docker compose down` to stop the stack without deleting those volumes, or `docker compose down --volumes` to remove the development data.

The frontend's browser API URL can be changed at build time with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1`. Server-side frontend requests use `API_INTERNAL_BASE_URL`, which Compose sets to the API service address.

The frontend Docker build uses the repository-level pnpm workspace lockfile and Next.js standalone output. For running application processes directly on the host, use the package-specific commands instead.

### 4.3 Example `.env.example`

```dotenv
# ---------------------------------------------------------------------------
# Frontend
# ---------------------------------------------------------------------------
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
# Client-side display limit for the recording upload form; keep in step with
# MAX_UPLOAD_BYTES. The server remains the authority.
NEXT_PUBLIC_MAX_UPLOAD_BYTES=2147483648

# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
APP_ENV=development
APP_NAME=meg-lab-api
LOG_LEVEL=DEBUG
LOG_FORMAT=json
API_CORS_ORIGINS=http://localhost:3000
DATABASE_URL=postgresql://meg-lab:meg-lab@localhost:5432/meg-lab
DATABASE_POOL_MIN_SIZE=1
DATABASE_POOL_MAX_SIZE=10
DATABASE_STATEMENT_TIMEOUT_MS=15000
REDIS_URL=redis://localhost:6379/0

# ---------------------------------------------------------------------------
# Worker and dispatcher
# ---------------------------------------------------------------------------
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_TASK_TIME_LIMIT_SECONDS=1800
CELERY_TASK_SOFT_TIME_LIMIT_SECONDS=1740
RUN_LEASE_SECONDS=600
RUN_MAX_ATTEMPTS=3
OUTBOX_DISPATCH_MAX_ATTEMPTS=10
IDEMPOTENCY_TTL_SECONDS=86400

# ---------------------------------------------------------------------------
# Object storage (MinIO / S3-compatible)
# ---------------------------------------------------------------------------
STORAGE_BACKEND=s3
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=meg-lab
S3_REGION=us-east-1
S3_ACCESS_KEY=meg-lab
S3_SECRET_KEY=meg-lab-secret
S3_USE_SSL=false
S3_SIGNED_URL_TTL_SECONDS=900

# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
# "development" enables the local development identity for host and CI.
# Production must use OIDC and provide real provider values below.
AUTH_MODE=development
SESSION_SECRET=insecure-development-session-secret-change-me
JWT_SECRET=insecure-development-jwt-secret-change-me
# OIDC provider configuration (required when AUTH_MODE=oidc)
AUTH_PROVIDER_ISSUER=https://accounts.example.com
AUTH_PROVIDER_DISCOVERY_URL=https://accounts.example.com/.well-known/openid-configuration
AUTH_PROVIDER_CLIENT_ID=meg-lab-web
AUTH_PROVIDER_CLIENT_SECRET=replace-me
AUTH_PROVIDER_SCOPES=openid profile email
AUTH_COOKIE_NAME=meg-lab_session
AUTH_COOKIE_SAMESITE=lax
# AUTH_COOKIE_SECURE=       # defaults to true in production, false otherwise
# AUTH_COOKIE_DOMAIN=       # defaults to a host-only cookie

# ---------------------------------------------------------------------------
# Scientific worker image
# ---------------------------------------------------------------------------
# Pinned by digest; see the mne-worker-image build step. Never use floating tags.
MNE_WORKER_IMAGE=ghcr.io/hieudoanm/meg-lab-mne-worker@sha256:0000000000000000000000000000000000000000000000000000000000000000

# ---------------------------------------------------------------------------
# Resource limits
# ---------------------------------------------------------------------------
MAX_UPLOAD_BYTES=2147483648
MAX_RECORDING_DURATION_S=7200
MAX_CHANNEL_COUNT=1024
MAX_FILES_PER_DATASET=2000
MAX_REQUEST_BODY_BYTES=1048576
UPLOAD_SESSION_TTL_SECONDS=3600
RUN_CPU_LIMIT=2
RUN_MEMORY_LIMIT_MB=4096
RUN_DISK_LIMIT_MB=8192
RUN_TIMEOUT_SECONDS=1800
MAX_CONCURRENT_RUNS_PER_USER=2
DEFAULT_PAGE_SIZE=20
MAX_PAGE_SIZE=100
```

These values are examples for local development only. Production must use managed credentials and secure configuration. When `APP_ENV=production`, the API refuses to start with `AUTH_MODE=development`, a default or short `SESSION_SECRET`/`JWT_SECRET`, or an OIDC mode without provider values.

`S3_ENDPOINT` points at MinIO locally. In the Compose network it resolves to the `minio` service (`http://minio:9000`), while host-side tools use `http://localhost:9000`.

### 4.4 Local setup workflow

The exact commands depend on the package scripts and dependency manager selected for the repository. Document the final commands in the README and Makefile.

The setup process should perform these steps:

1. Install frontend dependencies (`pnpm install`).
2. Install backend and worker dependencies (`uv sync --all-groups` in `packages/backend`).
3. Start PostgreSQL, Redis, and MinIO.
4. Apply database migrations.
5. Generate synthetic MEG fixtures (FIF, CTF `.ds`, KIT, and a small OPM `.bin` set).
6. Start the API.
7. Start the worker and outbox dispatcher.
8. Start the frontend.
9. Run the smoke tests.

### 4.5 Local development acceptance criteria

- A new developer can reproduce the environment.
- No production credentials are required.
- Migrations work against a fresh database.
- The frontend can communicate with the API.
- The worker can process a submitted experiment run inside the pinned scientific image.
- Synthetic uploads can be validated and opened in the Signal Viewer.
- The full analysis workflow can be demonstrated locally, including an OPM ingestion path.

## 5. Containerisation

Containerise every runtime component so that configuration lives in the environment, not the image.

| Image                          | Dockerfile                              | Runtime command                                              | Port |
| ------------------------------ | --------------------------------------- | ------------------------------------------------------------ | ---- |
| Frontend (`@meg-lab/web`)      | `packages/frontend/Dockerfile`          | Next.js standalone server (`node server.js`)                 | 3000 |
| Backend API (`api`)            | `packages/backend/Dockerfile`           | `uv`-managed FastAPI ASGI server                             | 8000 |
| Celery worker (`worker`)       | `packages/backend/Dockerfile.worker`    | `celery -A app.workers.celery worker`                        | —    |
| Outbox dispatcher              | `packages/backend/Dockerfile.dispatcher`| `python -m app.workers.outbox_dispatcher` (looped)           | —    |
| Migrations (one-shot)          | `packages/backend/Dockerfile`           | `python -m app.db.migrations upgrade`                        | —    |
| Scientific worker (`mne-worker-image`) | `packages/backend/Dockerfile.mne`| Loaded by the worker to execute runs                         | —    |

The API, worker, dispatcher, and migration runner share a Python dependency base image (`uv.lock`, Python 3.14) while retaining separate runtime commands. Sharing an image does not mean sharing the same execution role: the API does not need broker publishing rights, and the dispatcher does not need HTTP exposure.

### 5.1 The versioned scientific container

Scientific computation runs in a separate, versioned OCI image so that results are reproducible and the worker cannot silently change algorithms:

- Base: Python 3.14.
- Pinned: MNE-Python 1.8.1, NumPy, SciPy, and Matplotlib.
- Pinned by digest: every pipeline version records the exact `image_digest` it executed.
- Built as an explicit `mne-worker-image` build step in Compose and in CI, not pulled from a mutable `latest` tag.
- Contains no application secrets and no project data; inputs are mounted or fetched at runtime under least privilege.

Do not bake recordings or artifacts into any image layer.

### 5.2 Container requirements

- Use a maintained, supported base image; pin Python 3.14 and Node deliberately.
- Build the frontend with `output: 'standalone'` so only the traced runtime is shipped.
- Prefer multi-stage builds; do not copy development dependencies into production images.
- Run as a non-root user.
- Do not copy `.env` files or credentials into images; inject configuration at runtime.
- Avoid placing recordings, derivatives, or artifacts in container layers.
- Use a predictable working directory (`/app`).
- Install `init`/a proper PID 1 so the worker and dispatcher handle `SIGTERM` and shut down cleanly.
- Define container health checks for the API and frontend.
- Do not run migrations from the application start-up path; use the dedicated one-shot service.

### 5.3 Example container layout

```text
packages/
├── frontend/
│   └── Dockerfile              # multi-stage: deps -> build -> standalone runner
└── backend/
    ├── Dockerfile              # API
    ├── Dockerfile.worker       # Celery worker
    ├── Dockerfile.dispatcher   # outbox dispatcher
    └── Dockerfile.mne          # versioned MNE-Python scientific runtime
```

The frontend build uses the repository-level `pnpm-lock.yaml`. Install with `pnpm install --frozen-lockfile` in the build stage and rely on the workspace lockfile rather than the package-specific one.

## 6. Docker Compose Stack

Docker Compose is the current deployment topology, both for local development and for the self-hosted production demonstration.

```mermaid
flowchart TD
    User["User's browser"]
    Web["Next.js frontend / web (3000)"]
    API["FastAPI API / api (8000)"]
    DB["PostgreSQL"]
    Redis["Redis broker"]
    Worker["Celery worker"]
    Dispatcher["Outbox dispatcher"]
    MNE["Versioned MNE-Python image"]
    MinIO["MinIO (S3-compatible)"]
    Migrate["One-shot migrations"]
    CI["GitHub Actions"]

    User --> Web
    Web --> API
    API --> DB
    API --> Redis
    API --> MinIO
    Dispatcher --> DB
    Dispatcher --> Redis
    Redis --> Worker
    Worker --> DB
    Worker --> MinIO
    Worker --> MNE
    Migrate --> DB
    CI --> Web
    CI --> API
    CI --> Worker
    CI --> MNE
```

### 6.1 Services

| Service      | Image / build                        | Purpose                                                     | Depends on                                           |
| ------------ | ------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------- |
| `postgres`   | `postgres:18-alpine`                | Authoritative metadata and run state                          | —                                                    |
| `redis`      | `redis:7-alpine`                     | Celery broker and coordination                              | —                                                    |
| `minio`      | `minio/minio`                        | Private S3-compatible object storage                        | —                                                    |
| `minio-init` | `minio/mc`                           | One-shot bucket creation and private bucket policy          | `minio` healthy                                      |
| `migrate`    | `packages/backend/Dockerfile`        | One-shot schema migration (`app.db.migrations upgrade`)     | `postgres` healthy                                   |
| `api`        | `packages/backend/Dockerfile`        | FastAPI API on port 8000 (`/api/v1`)                        | `postgres`, `redis`, `minio` healthy; `migrate` done |
| `worker`     | `packages/backend/Dockerfile.worker` | Celery worker executing experiment runs                     | `postgres`, `redis`, `minio` healthy; `migrate` done |
| `dispatcher` | `packages/backend/Dockerfile.dispatcher` | Publishes committed outbox events to Redis             | `postgres`, `redis` healthy; `migrate` done          |
| `web`        | `packages/frontend/Dockerfile`       | Next.js standalone application on port 3000                  | `api` healthy                                        |

The versioned scientific image (`packages/backend/Dockerfile.mne`) is built by a separate `mne-worker-image` build step and referenced by the worker through `MNE_WORKER_IMAGE`, pinned by digest. It is not a long-running Compose service.

### 6.2 Example service definitions

The following excerpts are consistent with the repository layout and the environment variables in section 4.3.

```yaml
services:
  postgres:
    image: postgres:18-alpine
    container_name: meg-lab-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-meg-lab}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-meg-lab}
      POSTGRES_DB: ${POSTGRES_DB:-meg-lab}
    ports:
      - '5432:5432'
    volumes:
      - meg-lab-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-meg-lab} -d ${POSTGRES_DB:-meg-lab}']
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: meg-lab-redis
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 10
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    container_name: meg-lab-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY:-meg-lab}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY:-meg-lab-secret}
    ports:
      - '9000:9000'
      - '9001:9001'
    volumes:
      - meg-lab-minio:/data
    healthcheck:
      test: ['CMD', 'mc', 'ready', 'local']
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 ${S3_ACCESS_KEY:-meg-lab} ${S3_SECRET_KEY:-meg-lab-secret} &&
      mc mb --ignore-existing local/${S3_BUCKET:-meg-lab} &&
      mc anonymous set none local/${S3_BUCKET:-meg-lab} &&
      mc version enable local/${S3_BUCKET:-meg-lab}
      "
    restart: 'no'
```

The `minio-init` service disables anonymous access and enables bucket versioning so that source recordings are retained and protected against accidental overwrite. Object storage is private by default; all access is via short-lived signed URLs issued after an authorisation check.

```yaml
  migrate:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
    command: ['/app/.venv/bin/python', '-m', 'app.db.migrations', 'upgrade']
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-meg-lab}:${POSTGRES_PASSWORD:-meg-lab}@postgres:5432/${POSTGRES_DB:-meg-lab}
    depends_on:
      postgres:
        condition: service_healthy
    restart: 'no'

  api:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
    environment:
      APP_ENV: ${APP_ENV:-development}
      AUTH_MODE: ${AUTH_MODE:-development}
      SESSION_SECRET: ${SESSION_SECRET:-insecure-development-session-secret-change-me}
      JWT_SECRET: ${JWT_SECRET:-insecure-development-jwt-secret-change-me}
      AUTH_PROVIDER_ISSUER: ${AUTH_PROVIDER_ISSUER:-}
      AUTH_PROVIDER_CLIENT_ID: ${AUTH_PROVIDER_CLIENT_ID:-}
      AUTH_PROVIDER_CLIENT_SECRET: ${AUTH_PROVIDER_CLIENT_SECRET:-}
      DATABASE_URL: postgresql://${POSTGRES_USER:-meg-lab}:${POSTGRES_PASSWORD:-meg-lab}@postgres:5432/${POSTGRES_DB:-meg-lab}
      REDIS_URL: redis://redis:6379/0
      STORAGE_BACKEND: s3
      S3_ENDPOINT: http://minio:9000
      S3_BUCKET: ${S3_BUCKET:-meg-lab}
      S3_ACCESS_KEY: ${S3_ACCESS_KEY:-meg-lab}
      S3_SECRET_KEY: ${S3_SECRET_KEY:-meg-lab-secret}
      MAX_UPLOAD_BYTES: ${MAX_UPLOAD_BYTES:-2147483648}
      API_CORS_ORIGINS: '["http://localhost:3000","http://127.0.0.1:3000"]'
    ports:
      - '8000:8000'
    healthcheck:
      test: ['CMD', 'python', '-c', "import urllib.request; urllib.request.urlopen('http://localhost:8000/ready')"]
      interval: 10s
      timeout: 5s
      retries: 6
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    restart: unless-stopped
```

```yaml
  worker:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile.worker
    environment:
      APP_ENV: ${APP_ENV:-development}
      DATABASE_URL: postgresql://${POSTGRES_USER:-meg-lab}:${POSTGRES_PASSWORD:-meg-lab}@postgres:5432/${POSTGRES_DB:-meg-lab}
      CELERY_BROKER_URL: redis://redis:6379/0
      STORAGE_BACKEND: s3
      S3_ENDPOINT: http://minio:9000
      S3_BUCKET: ${S3_BUCKET:-meg-lab}
      S3_ACCESS_KEY: ${S3_ACCESS_KEY:-meg-lab}
      S3_SECRET_KEY: ${S3_SECRET_KEY:-meg-lab-secret}
      MNE_WORKER_IMAGE: ${MNE_WORKER_IMAGE:?set a pinned MNE worker digest}
      RUN_CPU_LIMIT: ${RUN_CPU_LIMIT:-2}
      RUN_MEMORY_LIMIT_MB: ${RUN_MEMORY_LIMIT_MB:-4096}
      RUN_TIMEOUT_SECONDS: ${RUN_TIMEOUT_SECONDS:-1800}
    init: true
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    restart: unless-stopped

  dispatcher:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile.dispatcher
    entrypoint: ['/bin/sh', '-c']
    command:
      - |
        set -e
        while true; do
          /app/.venv/bin/python -m app.workers.outbox_dispatcher
          sleep 5
        done
    environment:
      APP_ENV: ${APP_ENV:-development}
      DATABASE_URL: postgresql://${POSTGRES_USER:-meg-lab}:${POSTGRES_PASSWORD:-meg-lab}@postgres:5432/${POSTGRES_DB:-meg-lab}
      REDIS_URL: redis://redis:6379/0
    init: true
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: packages/frontend/Dockerfile
      args:
        NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_API_BASE_URL:-http://localhost:8000/api/v1}
    environment:
      API_INTERNAL_BASE_URL: http://api:8000/api/v1
    ports:
      - '3000:3000'
    depends_on:
      api:
        condition: service_healthy
    restart: unless-stopped

volumes:
  meg-lab-pgdata:
  meg-lab-minio:
```

### 6.3 Building the scientific image

The versioned scientific container is built once and pinned by digest. A typical build is:

```bash
docker build \
  -f packages/backend/Dockerfile.mne \
  -t ghcr.io/hieudoanm/meg-lab-mne-worker:mne1.8-py3.12 \
  packages/backend

docker buildx imagetools inspect \
  ghcr.io/hieudoanm/meg-lab-mne-worker:mne1.8-py3.12
```

Record the resulting `sha256:` digest and set `MNE_WORKER_IMAGE` to the digest-qualified reference. Pipeline versions store the digest they executed so a result is traceable to the exact scientific runtime.

### 6.4 Named volumes

Persist state in named volumes so that `docker compose down` does not destroy data:

| Volume           | Mount                      | Contents                                          |
| ---------------- | -------------------------- | ------------------------------------------------- |
| `meg-lab-pgdata` | `/var/lib/postgresql/data` | PostgreSQL cluster data                           |
| `meg-lab-minio`  | `/data`                    | Raw recordings, derived signals, plots, manifests |

Object storage is the only home for MEG recording bytes and derived artifacts; the database stores only metadata and object references.

### 6.5 Storage abstraction

The object-storage interface must allow MinIO locally and self-hosted, and an S3-compatible provider later, interchangeably. Configure the endpoint, bucket, region, credentials, and TLS through environment variables so the provider can be substituted without code changes. Block public access, keep credentials out of images, and never treat possession of an object key as authorisation.

### 6.6 Self-hosted production notes

For the self-hosted demo:

- Run the same images built from a reviewed `master` commit; do not build on the production host.
- Terminate TLS at a reverse proxy (for example Caddy, Nginx, or Traefik) in front of the frontend and API.
- Expose only the frontend (and the proxy) publicly; keep PostgreSQL, Redis, and the MinIO console on the internal network.
- Set `APP_ENV=production`, `AUTH_MODE=oidc`, strong `SESSION_SECRET` and `JWT_SECRET` values, and secure cookies.
- Provide real `S3_ACCESS_KEY`/`S3_SECRET_KEY` values distinct from the defaults.
- Restrict `API_CORS_ORIGINS` to the production origin.
- Configure log rotation and disk capacity alerts on the host.

## 7. Infrastructure as Code

Use **Docker Compose** as the current infrastructure-as-code mechanism. It is version-controlled, reviewable, and reproducible:

- Keep the `docker-compose.yaml` and `docker-compose.prod.yaml` files explicit and minimal.
- Do not commit secrets; use `.env` files excluded from version control.
- Provide an `.env.example` with placeholders only.
- Document resource limits and dependencies for each service.

**Terraform is deferred.** Introduce Terraform only when a cloud deployment is actually pursued. At that point, manage service configuration, database instances, storage buckets, service accounts and IAM bindings, secret references, logging, and networking. When Terraform is introduced:

- Do not commit state files or secrets.
- Use remote state with locking for shared deployments.
- Review plans before applying.
- Separate environments where practical.
- Document resource naming and ownership.

Kubernetes, a microservice decomposition, and a service mesh remain deferred. The cloud-evolution section (section 18) describes how to adopt managed services without changing the local or self-hosted deployment.

## 8. Configuration and Secrets

### 8.1 Configuration

Keep non-secret, environment-specific settings in explicit configuration:

- Environment name (`APP_ENV`).
- Log level and format.
- API base URL (`NEXT_PUBLIC_API_BASE_URL`, `API_INTERNAL_BASE_URL`).
- CORS origins.
- Resource limits (upload size, recording duration, channel count, per-run CPU/memory/disk/wall-clock, concurrency).
- Redis and Celery settings.
- Object-storage endpoint, bucket, and region.
- Authentication mode and OIDC issuer.
- The pinned scientific worker image digest (`MNE_WORKER_IMAGE`).

Validate required configuration at start-up and fail clearly when mandatory values are missing.

### 8.2 Secrets

Keep the following only in environment files or a secret store, never in source or images:

- Database credentials (`DATABASE_URL`).
- Redis authentication (if enabled).
- Object-storage access and secret keys.
- `SESSION_SECRET` and `JWT_SECRET` (or asymmetric signing keys).
- OIDC client secret (`AUTH_PROVIDER_CLIENT_SECRET`).
- Any third-party credentials.

### 8.3 Rules

- Never commit secrets; `.env` and `.env.*` are ignored, and `!.env.example` is the only exception.
- Never log secret values, full connection strings, or signed URLs.
- Never expose server secrets through `NEXT_PUBLIC_*` variables; these are embedded in the client bundle.
- Rotate credentials according to a documented policy.
- Use separate credentials for local, CI, and production.
- Grant each service access only to the secrets it requires.
- Validate at start-up that production is not running with development defaults.
- Never put placeholder values in a production deployment. Every `replace-me` or `insecure-...` value in `.env.example` must be replaced with a real, environment-specific secret before production use, and the API must refuse to start if such placeholders remain.

## 9. Database Migrations

Migrations live under `packages/backend/app/db/migrations/` as ordered SQL files with a Psycopg runner. Apply pending migrations with:

```bash
uv run python -m app.db.migrations upgrade
```

CI runs this command before tests against a pinned PostgreSQL service.

### 9.1 Deployment order

A typical release should:

1. Build and test the application images and the scientific image.
2. Review the migration plan.
3. Apply a backward-compatible migration as a one-shot step (the Compose `migrate` service).
4. Start the API, worker, and dispatcher only after migrations complete successfully.
5. Run smoke tests.
6. Verify health and error metrics.
7. Retain a documented recovery option.

Compose enforces ordering with `migrate` using `condition: service_completed_successfully` as a dependency of `api`, `worker`, and `dispatcher`.

### 9.2 Expand-and-contract

For changes requiring multiple releases, use expand-and-contract migrations:

1. Add the new schema while retaining compatibility.
2. Deploy code that supports the transition.
3. Migrate data if required.
4. Switch reads and writes.
5. Remove obsolete schema in a later release.

### 9.3 Rules

- The runner tracks applied versions and checksums and rejects modified, already-applied migrations.
- Apply each migration transactionally.
- Do not assume that rolling back an application image reverses a database migration safely.
- Avoid destructive automatic schema changes during application start-up.
- Migrations must be repeatable in a clean environment and reviewed before production.

## 10. CI/CD with GitHub Actions

CI is the authoritative quality gate and the first-class deployment concern. The workflow is defined in `.github/workflows/ci.yml` and triggers on pull requests and pushes to `master`, with concurrency cancellation (`cancel-in-progress: true`). Global environment pins are `UV_PYTHON: '3.14'` and `NODE_VERSION_FILE: packages/frontend/.nvmrc`.

```mermaid
flowchart LR
    PR["Pull request / push"] --> FE["Frontend: lint, typecheck, tests, build"]
    PR --> BE["Backend: lint, typecheck, migrations, tests"]
    PR --> IMG["Scientific image build + digest pinning"]
    FE --> E2E["End-to-end smoke"]
    BE --> E2E
    IMG --> SCAN["Security scan (Trivy, audits)"]
    FE --> SCAN
    BE --> SCAN
    E2E --> PUB["Publish on tag"]
    SCAN --> PUB
```

### 10.1 Jobs and gates

| Job                | Name                     | Runs on        | Depends on                         | Purpose                                                                 |
| ------------------ | ------------------------ | -------------- | ---------------------------------- | ----------------------------------------------------------------------- |
| `backend`          | `CI - Backend`           | `ubuntu-latest`| —                                  | Ruff format/lint, mypy, migrations, pytest with coverage, `pip-audit`   |
| `frontend`         | `CI - Frontend`          | `ubuntu-latest`| —                                  | pnpm install, lint, format check, typecheck, unit tests, build, audit  |
| `scientific-image` | `CI - Scientific Image`  | `ubuntu-latest`| —                                  | Build the MNE image, record and pin its digest, run numerical regression |
| `e2e`              | `End-to-End`             | `ubuntu-latest`| `frontend`, `backend`              | Playwright Chromium smoke tests of the critical workflow                |
| `security`         | `Security`               | `ubuntu-latest`| —                                  | Trivy filesystem scan (CRITICAL/HIGH/MEDIUM) uploaded to GitHub Security|
| `publish`          | `Publish Images`         | `ubuntu-latest`| `backend`, `frontend`, `scientific-image`, `e2e`, `security` | Push immutable images on version tags                 |

Backend job detail:

1. Checkout.
2. Setup `uv` with Python 3.14, caching against `packages/backend/uv.lock`.
3. `uv sync --all-groups`.
4. `uv run ruff format --check .`.
5. `uv run ruff check .`.
6. `uv run python -m mypy .`.
7. `uv run python -m app.db.migrations upgrade` against the pinned PostgreSQL service.
8. `uv run pytest -q --cov=app --cov-report=term-missing`.
9. `uv run pip-audit --desc --format=json --output=pip-audit.json`.
10. Upload `pip-audit.json` as an artifact (30-day retention).

Frontend job detail:

1. Checkout.
2. Enable pnpm and set up Node from `.nvmrc`; cache the pnpm store.
3. `pnpm install --frozen-lockfile`.
4. `pnpm lint && pnpm format:check`.
5. `pnpm typecheck`.
6. `pnpm test`.
7. `pnpm build`.
8. `pnpm audit --json --output=npm-audit.json`.
9. Upload `npm-audit.json` as an artifact (30-day retention).

Scientific-image job detail:

1. Checkout.
2. Build the MNE image from `packages/backend/Dockerfile.mne`.
3. Record the image digest and confirm the pinned MNE-Python, NumPy, SciPy, and Matplotlib versions.
4. Run numerical regression tests inside the image (filtering, epoching, PSD) against reference expectations.
5. Emit the digest as a job output so downstream jobs and deployments reference the exact image.

### 10.2 Pull request pipeline

Every pull request must pass backend, frontend, scientific-image, end-to-end, and security jobs. PR validation never receives production secrets, and forked pull requests do not run deployment steps.

### 10.3 Deployment pipeline

The current workflow produces validated code but does not itself deploy the Compose stack. Self-hosted release is a controlled, manual promotion from a green `master` commit:

1. Trigger only from `master` after all required checks pass.
2. Build immutable frontend, API, worker, dispatcher, and scientific images from the reviewed commit.
3. Tag images by commit SHA (and record the digest); do not rely only on a mutable `latest` tag.
4. Publish images to the self-hosted registry or transfer the saved image archive to the host.
5. Apply migrations with the one-shot `migrate` service.
6. Roll the API, worker, and dispatcher, then the frontend.
7. Execute smoke tests against the deployed origin.
8. Report deployment status.

An optional future evolution is a `deploy` job that pushes images to a registry (for example GHCR) and triggers the host over SSH. Until that job exists, document the manual promotion steps in the README.

### 10.4 Immutable artefacts

- Prefer image tags based on commit SHA or image digest.
- Keep previous immutable images available for rollback.
- Do not deploy changes directly from an unreviewed local working tree.
- Keep deployment permissions minimal and separated from PR validation.
- Never update the scientific image in place; a change to the MNE runtime is a new digest and a new pipeline-version association.

### 10.5 Husky and lint-staged

Local commits use Husky and lint-staged for fast staged-file checks: Ruff on staged backend Python and ESLint/Prettier on staged frontend source. These checks improve the feedback loop but are not the quality gate; CI is authoritative and must reject anything the local hooks miss or that a developer bypasses.

### 10.6 Deployment pipeline principles

1. Build immutable artefacts.
2. Run the automated checks above.
3. Apply migrations in a controlled, one-shot step.
4. Run smoke tests.
5. Promote only when checks succeed.

## 11. Health Checks and Readiness

Implement separate health endpoints in the API.

### 11.1 Liveness

`GET /health`

Indicates that the API process is alive and able to respond. This endpoint should not fail solely because an external dependency is temporarily unavailable.

### 11.2 Readiness

`GET /ready`

Indicates whether the API can accept work under its defined readiness policy. It performs cheap checks against PostgreSQL, Redis, and object storage and returns a structured body indicating which dependency is unavailable. Compose uses this endpoint for the `api` container health check and gates the `web` start on it.

Do not expose credentials, internal network details, or detailed dependency errors through public health responses.

### 11.3 Worker and dispatcher health

A healthy HTTP endpoint does not prove that the asynchronous pipeline is healthy. Track:

- Worker process availability.
- Outbox dispatch lag (oldest unpublished event age).
- Last successful task.
- Broker/queue depth where available.
- Run age and stale `running` runs.
- Failed and retried run counts.
- Scientific-image availability and the digest actually used.

The dispatcher loop retries every few seconds, so a crash or Redis outage delays dispatch but does not lose committed outbox events.

## 12. Logging, Metrics, and Alerts

### 12.1 Logging

Use structured (JSON) logs with fields such as:

- Timestamp.
- Severity.
- Service (`api`, `worker`, `dispatcher`, `web`).
- Environment.
- Request or correlation ID.
- Run ID.
- Route template.
- Resource ID.
- Duration.
- Safe error code.

Do not log raw MEG signal data, signed URLs, access tokens, full connection strings, or participant information. Container logs are collected through the Docker logging driver; configure rotation (`max-size`, `max-file`) so a noisy service cannot fill the disk.

### 12.2 Metrics

Track at least:

- API request count and latency.
- API error rate.
- Database connection utilisation.
- Upload completion and validation-failure counts.
- Outbox queue depth and dispatch lag.
- Run execution duration.
- Run success, failure, and retry counts.
- Stale run count.
- Object-storage usage and growth.
- Host CPU, memory, and disk utilisation.

A `/metrics` endpoint compatible with Prometheus and an optional Prometheus/Grafana sidecar are future additions; the self-hosted MVP may rely on structured logs, `docker stats`, and the MinIO and PostgreSQL metrics that are available.

### 12.3 Run-status observability

Runs are first-class observable objects. Surface, for authorised users and operators:

- Current state and the time in each state.
- Progress where a pipeline reports it (for example processed channel count).
- Structured, access-controlled logs.
- Terminal failure reasons that distinguish invalid parameters, resource limits, and internal errors.
- The scientific image digest and pipeline version that executed the run.

### 12.4 Alerts

Start with a small number of actionable alerts:

- Sustained API failures.
- Repeated database connection failures.
- A growing backlog of old runs or undispatched outbox events.
- Repeated worker crashes.
- Runs failing consistently with resource-limit reasons.
- Disk usage approaching capacity (database or MinIO volume).
- Backup failures.

Avoid alerts that trigger on harmless short-lived fluctuations.

## 13. Backups and Recovery

Define a recovery policy for every durable data store. Both durable stores live in named volumes and must be backed up independently.

### 13.1 PostgreSQL

Document:

- Backup frequency (`pg_dump` on a schedule, for example nightly).
- Retention (for example 7 daily plus 4 weekly copies).
- Recovery procedure.
- Who can restore.
- Recovery point objective (RPO).
- Recovery time objective (RTO).

Example logical backup:

```bash
docker compose exec -T postgres \
  pg_dump -U meg-lab -d meg-lab -Fc > backups/meg-lab-$(date +%F).dump
```

A database dump is not a substitute for object-storage backups.

### 13.2 Object storage

Document:

- Raw-recording and artifact retention.
- Bucket versioning or object-lock behaviour where enabled.
- Deletion policy and the relationship to `file_assets`, `dataset_versions`, and `artifacts` rows.
- Recovery options.
- How database metadata maps to stored object keys.

For the self-hosted demo, back up the `meg-lab-minio` volume or mirror the bucket with `mc mirror` to a second location. Keep database dumps and object mirrors consistent so a restore does not reference missing recordings.

### 13.3 Retention and deletion semantics

Deletion must have explicit, documented semantics across:

- Source recordings (`file_assets` and their object keys).
- Dataset versions and derived signals.
- Run artifacts, plots, and manifests.
- Cached and derived viewer summaries.
- Backups.

Deletion of a project or dataset is recorded in the audit trail and must not silently leave orphaned objects or dangling database rows. A reconciliation job removes unreferenced objects and repairs references after a partial failure, and abandoned upload sessions are cleaned up on a schedule.

### 13.4 Recovery testing

A backup is not proven useful until restoration has been tested.

- Document the restore procedure.
- Perform a test restore in a disposable environment.
- Verify that representative metadata and synthetic recording references remain consistent.
- Record any limitations.

## 14. Cost Management

A self-hosted portfolio project should not incur unnecessary ongoing costs.

- Run the whole stack on a single modest host; prefer the smallest instance that meets memory and disk needs.
- Budget for disk first: raw recordings and derived artifacts dominate cost, not compute.
- Apply object-storage retention and cleanup for abandoned upload sessions and superseded artifacts.
- Enforce upload-size, recording-duration, and run-time limits so a single job cannot exhaust the host.
- Limit worker concurrency and set Celery time limits.
- Configure Docker log rotation to prevent unbounded log growth.
- Monitor storage growth and provision headroom for backups.
- Avoid keeping unused environments running.
- Document which resources continue to incur charges while idle.

Review provider or host pricing before provisioning. Do not assume a workload remains cheap simply because the demonstration is small.

## 15. Production Readiness Checklist

### Application

- [ ] Production build succeeds for frontend, API, worker, and dispatcher.
- [ ] Images are immutable and tagged by commit SHA or digest.
- [ ] Authentication is enabled and `AUTH_MODE` is not `development`.
- [ ] No `.env.example` placeholder value (`replace-me`, `insecure-...`) remains in production.
- [ ] Project isolation tests pass.
- [ ] Upload and processing limits are configured.
- [ ] Worker retries, time limits, and run leases are configured.
- [ ] Secrets are managed securely and not baked into images.
- [ ] Health and readiness endpoints work.

### Database and storage

- [ ] Migrations are reviewed and applied through the one-shot `migrate` service.
- [ ] Database access is restricted to the internal network.
- [ ] Backups are enabled as required and a restore has been tested.
- [ ] Object storage is private (anonymous access disabled).
- [ ] Storage credentials are distinct from the development defaults.
- [ ] Retention and cleanup policies are defined.

### Scientific runtime

- [ ] The MNE worker image is pinned by digest and referenced through `MNE_WORKER_IMAGE`.
- [ ] The pinned MNE-Python and library versions are recorded.
- [ ] Pipeline versions store the digest they executed.
- [ ] Numerical regression tests pass inside the pinned image.

### Operations

- [ ] Structured logs are available with rotation configured.
- [ ] Critical metrics are monitored.
- [ ] Alerts are actionable.
- [ ] Deployment smoke tests pass.
- [ ] Cost controls and disk alerts are configured.
- [ ] Rollback and recovery limitations are documented.
- [ ] TLS terminates in front of the frontend and API.

### Portfolio demonstration

- [ ] Only synthetic or appropriately licensed public data is used.
- [ ] Demo credentials are not privileged production credentials.
- [ ] The README explains limitations.
- [ ] The primary workflow works in the deployed environment.
- [ ] A reviewer can understand the architecture and run the project locally.

## 16. Rollback Strategy

Application rollback and data rollback are separate operations.

### 16.1 Application rollback

Keep previous immutable application images available. If a deployment fails, restore the previous compatible image tag in `docker-compose.prod.yaml` and run smoke tests. Because migrations run as a separate one-shot step, a rollback does not silently re-run schema changes.

### 16.2 Database rollback

Do not automatically reverse a migration without checking its effects. Prefer backward-compatible migrations that allow the application to be rolled back without losing data. For destructive changes, define a specific recovery plan before deployment.

### 16.3 Worker compatibility

During a rollout, old and new workers may temporarily coexist. Ensure that:

- Task payloads remain compatible during the transition.
- Algorithm and pipeline versions are explicit, and `image_digest` is recorded.
- Result and manifest schemas are versioned.
- Workers cannot overwrite results from incompatible executions.
- Queued jobs remain processable after deployment.

### 16.4 Scientific image rollback

Rolling back the scientific image means selecting a previously recorded digest. Because pipeline versions reference the digest they executed, rolling back the worker image does not change the provenance of already-completed runs. Never mutate or re-tag a scientific image in place; always record a new digest.

## 17. Teardown and Resource Cleanup

Provide a documented teardown process for disposable environments.

Before deleting resources:

1. Identify the environment.
2. Confirm that it contains no data that must be retained.
3. Check for object-storage contents, database backups, and image archives.
4. Review the destruction plan.
5. Confirm that shared resources will not be removed.
6. Apply the approved teardown.
7. Verify that the intended resources were removed.
8. Check for remaining billable resources.

Typical commands:

```bash
# Stop the stack, preserving volumes
docker compose down

# Stop the stack and delete database, MinIO, and upload volumes
docker compose down --volumes

# Remove locally built images for the project
docker compose down --rmi local
```

Use `--volumes` only when the data is disposable. Do not delete backups as part of an ordinary deployment failure handler.

## 18. Optional Cloud Evolution

Cloud deployment is optional and must never be required to build, test, or run MEG Lab. The local and self-hosted Compose stack is the source of truth. If demand justifies managed infrastructure, adopt it in the following order, preserving the isolation properties established locally.

- **Managed PostgreSQL:** replace the `postgres` service with a managed instance reachable over private networking. Keep migrations as a one-shot step and never expose the database publicly.
- **Managed Redis:** replace the `redis` service with a managed Redis-compatible endpoint for the Celery broker.
- **Managed S3-compatible storage:** replace MinIO with a managed object store. Keep the bucket private by default, use least-privilege credentials, and continue issuing short-lived signed URLs only after an authorisation check.
- **Container worker pool:** run the API, worker, dispatcher, and scientific image as a container pool. Start with a simple container service and defer Kubernetes.

Isolation properties to preserve in any cloud evolution:

- Private by default; no public bucket access.
- Signed, short-lived URLs for all object access.
- Restricted worker egress, blocking internal services and cloud metadata endpoints.
- No cross-project access through the API, storage, or worker mounts.
- Per-run CPU, memory, disk, and wall-clock limits enforced by the platform.
- Immutable scientific image digests recorded per pipeline version.

When cloud infrastructure is introduced, manage it with Terraform, keep state remote and locked, review plans before applying, and document costs and teardown. Kubernetes and a microservice decomposition remain deferred.

## 19. Troubleshooting Guide

### 19.1 API cannot connect to PostgreSQL

Check:

- PostgreSQL container status and the readiness health check.
- `DATABASE_URL` format and hostname (`postgres` inside Compose, `localhost` on the host).
- Network configuration and service name resolution.
- Authentication and permissions.
- Connection-pool limits and database connection exhaustion.
- That `migrate` completed before the API started.

Do not print passwords or full connection strings into logs.

### 19.2 Worker does not process runs

Check:

- Redis availability and `CELERY_BROKER_URL`.
- Worker container status and task registration.
- Outbox dispatch status and lag (undispatched events remain in PostgreSQL).
- Queue depth and worker concurrency.
- Run state and lease information.
- Resource and time limits.
- That `MNE_WORKER_IMAGE` resolves to a digest-qualified image that can be pulled.

Inspect run and outbox records before manually resubmitting work.

### 19.3 Recording upload remains pending

Check:

- Upload-session state and expiry.
- Signed-URL expiry and expiry clock skew.
- Object existence in the MinIO bucket.
- Object size and SHA-256 checksum for every file in the set.
- Storage credentials and bucket policy (anonymous access must be disabled).
- That directory-based and companion-file sets were fully uploaded.
- Validation worker health and validation error records.

Do not manually mark a recording ready without verifying the file set.

### 19.4 Run remains queued

Check:

- Outbox dispatch status.
- Redis connectivity.
- Worker availability.
- Retry policy and attempt counts.
- Resource limits and host pressure.
- Scientific-image pull failures.

Use the documented recovery procedure rather than modifying production rows without an approved process.

### 19.5 Scientific job fails with a resource-limit reason

Check:

- `RUN_CPU_LIMIT`, `RUN_MEMORY_LIMIT_MB`, `RUN_DISK_LIMIT_MB`, and `RUN_TIMEOUT_SECONDS`.
- The size and channel count of the input recording against the configured limits.
- Host pressure and worker concurrency.

Adjust limits deliberately and document the change; do not raise them unboundedly.

### 19.6 Frontend cannot reach the API

Check:

- `NEXT_PUBLIC_API_BASE_URL` (browser) and `API_INTERNAL_BASE_URL` (server-side).
- That the frontend build-time API URL matches the deployment origin.
- `API_CORS_ORIGINS`.
- The API health check and container status.

Remember that `NEXT_PUBLIC_*` values are embedded at build time and require a rebuild to change.

### 19.7 Migration service fails

Check:

- Database reachability and credentials.
- For a rejected modified migration, that the checksum in the migrations table matches the file.
- Migration SQL for syntax errors against the target PostgreSQL version.
- That the migration is transactional and repeatable in a clean environment.

### 19.8 Deployment succeeds but the application fails

Check:

- Environment variables and `APP_ENV`-dependent validation.
- Whether any placeholder secret remains, which should block production start-up.
- Health-check configuration.
- API base URLs.
- Migration status.
- Storage bucket and credentials.
- Worker, broker, and scientific-image connectivity.
- Frontend/API contract compatibility.

## 20. Definition of Done

Deployment is complete when:

1. The application can be run locally using documented instructions and `docker compose up`.
2. CI validates the codebase (backend, frontend, scientific-image, end-to-end, and security jobs).
3. The environment is defined reproducibly in `docker-compose.yaml` and `.env.example`.
4. Production secrets are not stored in source control, images, or logs, and no placeholder values remain.
5. Frontend, API, worker, and dispatcher run as separate services with correct dependencies.
6. The versioned MNE-Python scientific image is built, pinned by digest, and referenced through `MNE_WORKER_IMAGE`.
7. Database and object-storage access are restricted to the internal network.
8. Migrations run as a controlled, one-shot step before the API and worker start.
9. Liveness and readiness endpoints work, and the asynchronous pipeline is observable.
10. Logs and basic operational metrics are available, with rotation configured.
11. Backups, retention, and deletion semantics are documented and restoration has been tested.
12. Self-hosting costs and teardown procedures are documented.
13. A deployed synthetic-data workflow passes smoke tests.
14. Rollback of application and scientific images is documented and backward-compatible migrations are preferred.
15. Cloud providers, Terraform, and Kubernetes remain optional future evolutions, not requirements.
16. Known operational and scientific limitations are clearly documented.
