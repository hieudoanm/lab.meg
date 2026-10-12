# Local Development

## 4. Local Development

### 4.1 Prerequisites

Install supported versions of:

- Node.js (see `packages/frontend/.nvmrc`).
- pnpm (pinned through `packageManager` in `package.json`).
- Python 3.15.0 managed through `uv`.
- Docker and Docker Compose.
- Git.

Run `pnpm install` from the repository root to install JavaScript dependencies and set up Husky Git hooks. Before each commit, lint-staged runs Ruff on staged backend Python files and ESLint/Prettier on staged frontend source files; these local checks do not replace CI.

Pin or document supported versions. Do not assume that the newest release of every tool is compatible with the repository. The scientific runtime is pinned deliberately to Python 3.15.0 so that
behaviour matches the versioned worker image.

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

