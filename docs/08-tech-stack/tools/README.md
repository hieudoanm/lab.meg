# Tooling and Code Quality

## 11. Tooling & Code Quality

- Python: Ruff (format+lint), mypy (strict where practical). uv for dependency management; `uv.lock` pinned.
- TypeScript: ESLint, Prettier, `tsc --noEmit`. pnpm with lockfile; `pnpm-lock.yaml` pinned.
- Git hooks: Husky + lint-staged (Ruff/ESLint+Prettier on staged files).
- Tests: Vitest + React Testing Library + Playwright (frontend); pytest + HTTPX (backend).
- Dependency policy: pinned versions in lockfiles; production deps reviewed; container digests pinned; avoid multiple libs for same responsibility.

