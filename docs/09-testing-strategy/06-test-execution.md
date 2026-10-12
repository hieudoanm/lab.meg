# Test Execution

## 19. Continuous Integration Gates

Authoritative: `.github/workflows/ci.yml`.

### Backend (packages/backend, Python 3.15.0 via uv, Postgres 18)
| Step | Command |
|---|---|
| Install | `uv sync --all-groups` |
| Format | `ruff format --check .` |
| Lint | `ruff check .` |
| Typecheck | `python -m mypy .` |
| Migrations | `python -m app.db.migrations upgrade` |
| Tests | `pytest -q --cov=app --cov-report=term-missing` |
| Dependency audit | `pip-audit --desc --format=json --output=pip-audit.json` (non-blocking artifact) |

### Frontend (packages/frontend, pnpm 12, Node .nvmrc)
| Step | Command |
|---|---|
| Install | `pnpm install --frozen-lockfile` |
| Lint+format | `pnpm lint && pnpm format:check` |
| Typecheck | `pnpm typecheck` |
| Unit tests | `pnpm test` |
| Build | `pnpm build` |
| Dependency audit | `pnpm audit --json --output=npm-audit.json` (non-blocking artifact) |

### E2E (after frontend)
- Install, `pnpm exec playwright install --with-deps chromium`, `pnpm test:e2e`

### Security
- Trivy fs scan (CRITICAL,HIGH,MEDIUM, ignore-unfixed), SARIF to GitHub Security.

### Release
- Tauri desktop build on `master` only after all gates pass (not required per PR).

Local: Husky + lint-staged (Ruff, ESLint/Prettier) for fast feedback.

