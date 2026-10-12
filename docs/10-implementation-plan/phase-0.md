# Phase 0 — Project Foundation

## 4. Phase 0 — Project Foundation

### 4.1 Objective

Establish a reproducible development environment and repository structure before any scientific feature work begins.

### 4.2 Deliverables

- A pnpm workspace rooted at `@meg-lab/workspace` with `packages/frontend` (`@meg-lab/web`) and `packages/backend`.
- Tooling, conventions, and documentation scaffolding.
- Docker Compose definitions for PostgreSQL, Redis, and MinIO.
- An initial GitHub Actions workflow.

### 4.3 Tasks

- [x] Create the repository and initial README.
- [x] Add `AGENTS.md` with coding and repository conventions.
- [x] Add the core project documentation files under `docs/`.
- [x] Configure the `@meg-lab/workspace` root package and `pnpm-workspace.yaml` (`packages/*`).
- [x] Add the `@meg-lab/web` frontend package and the `packages/backend` Python package.
- [x] Configure `uv` and the pinned Python version (3.15.0, matching the MNE scientific runtime).
- [x] Configure pnpm and the pinned Node.js version (`.nvmrc`).
- [x] Add Ruff, ESLint, Prettier, and mypy configuration.
- [x] Configure Husky and lint-staged for staged-source checks before commit.
- [x] Add `.editorconfig`.
- [x] Add environment variable examples (`.env.example` with placeholders only).
- [x] Add a root-level `Makefile` task runner.
- [x] Define `docker-compose.yaml` services for PostgreSQL, Redis, and MinIO.
- [x] Configure GitHub Actions for the initial checks.
- [x] Add a `.gitignore` covering secrets, local data, build outputs, and generated scientific files (FIF, CTF `.ds`, KIT, OPM `.bin`, and BIDS derivatives).
- [ ] Write the initial Architecture Decision Records required by the architecture document.

### 4.4 Suggested repository structure

```text
meg-lab/
├── packages/
│   ├── frontend/            # @meg-lab/web (Next.js + signal/sensor viewer)
│   └── backend/             # FastAPI API, workers, migrations
├── infra/
│   └── terraform/           # deferred (cloud only)
├── scripts/                 # fixture generation, sample-data download
├── docs/
│   └── decisions/
├── .github/
│   └── workflows/
├── docker-compose.yaml
├── pnpm-workspace.yaml
├── Makefile
├── AGENTS.md
├── README.md
└── .gitignore
```

### 4.5 Dependencies

- None. This is the first phase.

### 4.6 Exit criteria

- A new developer can follow the setup guide and start the workspace.
- The frontend and backend start locally, and Compose brings up PostgreSQL, Redis, and MinIO.
- Formatting and linting commands run for both packages.
- Husky installs its pre-commit hook after dependency installation and checks staged files.
- CI executes the initial checks.
- No credentials or real participant data are committed.
- Small synthetic signal fixtures are generated reproducibly by a documented script.
- Project documentation reflects the actual chosen tools.

### 4.7 Risks

| Risk                                       | Mitigation                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| Tooling churn delays the first feature     | Pin versions early and treat tooling changes as deliberate pull requests  |
| Local environment drift between developers | Docker Compose for services and committed lockfiles                       |
| Documentation diverges from implementation | Update docs in the same pull request as the change                        |
| MNE wheel/platform friction on install     | Pin the scientific runtime to the versioned container and test locally    |

