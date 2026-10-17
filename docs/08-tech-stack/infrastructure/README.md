# Infrastructure, Local Topology and CI

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

