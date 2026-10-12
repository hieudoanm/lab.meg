# Continuous Integration and Engineering Quality Gates

## 13. Continuous Integration and Engineering Quality Gates

Every pull request runs the checks relevant to the changed code. CI remains the authoritative quality gate; Husky and lint-staged only pre-check staged files locally.

### 13.1 Frontend

- Formatting (`pnpm format:check`).
- Linting (`pnpm lint`).
- Type checking (`pnpm typecheck`).
- Unit tests (`pnpm test`).
- Production build (`pnpm build`).
- Selected browser tests.

### 13.2 Backend

- Formatting (`ruff format --check`).
- Linting (`ruff check`).
- Type checking (`mypy`).
- Unit tests and API tests.
- PostgreSQL integration tests against a pinned PostgreSQL service.
- Migration checks applied to a fresh database.
- Dependency audit (`pip-audit`).

### 13.3 Worker

- Formatting and linting.
- Unit tests.
- Scientific-correctness tests against reference recordings and expected outputs.
- Job lifecycle, retry, duplicate-delivery, and cancellation tests.

### 13.4 Scientific container

- Build the MNE-Python scientific image and record its digest.
- Verify the pinned digests of MNE-Python, NumPy, SciPy, and Matplotlib.
- Run numerical regression tests inside the image for filtering, epoching, and PSD.

### 13.5 End-to-end and security

- Playwright Chromium smoke test of the critical workflow.
- Trivy filesystem scan with SARIF upload to GitHub Security.
- Negative cross-project access tests.

Build and test containers using pinned or otherwise controlled dependency versions.

