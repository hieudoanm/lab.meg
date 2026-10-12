# CI/CD Pipeline

This diagram describes the GitHub Actions quality gate for MEG Lab. The workflow
runs on pull requests and pushes to `main`; CI remains the authoritative full
validation while local Husky and lint-staged hooks apply fast formatting and
lint checks to staged files before commit. Successful builds produce container
images pinned by immutable digest, which are published on tag and used by the
optional Docker Compose prototype deployment.

```mermaid
flowchart LR
    Change[Pull request or push / main]
    Local[Local commit\nHusky + lint-staged\npre-commit staged-file checks]

    subgraph GH["GitHub Actions: .github/workflows/ci.yml"]
        Checkout[Checkout source]
        FE[Frontend checks\nESLint, Prettier,\ntypecheck, Vitest, build]
        BE[Backend checks\nRuff, mypy, migration validation,\npytest unit + integration]
        E2E[End-to-end tests\nPlaywright - upload, view, run, inspect]
        Security[Security scan\nTrivy filesystem + image scan,\nSARIF upload]
        Audit[Dependency audit\npnpm and pip audits,\nartifacts]
        Merge[CI result / merge gate]
    end

    subgraph Build["Container build"]
        DockerBuild[Build OCI images\nfrontend, API, worker, dispatcher]
        Digest[Tag with commit SHA\nand immutable image digest]
        Registry[(Container registry\nlocal / configured registry)]
    end

    subgraph Publish["Publish on tag"]
        TagRelease[Release workflow\non version tag]
        Push[Push images to registry\nby immutable digest]
    end

    subgraph Deploy["Optional prototype deployment"]
        Compose[Deploy services with docker compose\nNext.js, FastAPI, Celery worker,\ndispatcher, PostgreSQL, Redis, MinIO]
        Migrate[Run SQL migrations\nstartup gate]
        Smoke[Smoke test\nhealth endpoints, run end to end]
    end

    Local --> Change
    Change --> Checkout
    Checkout --> FE
    Checkout --> BE
    Checkout --> E2E
    Checkout --> Security
    FE --> Audit
    BE --> Audit
    Audit --> Merge
    FE --> Merge
    BE --> Merge
    E2E --> Merge
    Security --> Merge

    Security --> DockerBuild
    Audit --> DockerBuild
    DockerBuild --> Digest
    Digest --> Registry

    Checkout -.->|tagged release| TagRelease
    TagRelease --> Push
    Registry -.-> Push

    Push -.-> Compose
    Digest --> Compose
    Compose --> Migrate
    Migrate --> Smoke
    Smoke --> Merge
```

## Quality gate stages

| Stage               | Checks                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------- |
| Local (Husky)       | lint-staged formatting and lint on staged frontend and backend source files            |
| Frontend gate       | ESLint, Prettier, TypeScript typecheck, Vitest, production build                       |
| Backend gate        | Ruff, mypy, migration validation, pytest unit and integration tests                    |
| End-to-end          | Playwright: upload, validate, view, run, inspect, export                               |
| Security            | Trivy filesystem and image scan with SARIF upload                                      |
| Dependency audit    | pnpm and pip audits, result artifacts                                                  |
| Container build     | Build frontend, API, worker, and dispatcher images; pin immutable digest               |
| Publish on tag      | Release workflow pushes digested images to the registry on a version tag               |
| Prototype deploy    | Optional docker compose deploy with migrations as a startup gate and end-to-end smoke  |

## Separation of concerns

Husky and lint-staged provide fast, staged-file feedback locally, but they are a
convenience rather than a gate. The GitHub Actions workflow validates the change,
builds versioned images, and records their digests; it is the authoritative full
validation. Image publication is a separate, tag-triggered step so that release
artifacts are built from already-validated source. The optional prototype
deployment uses `docker compose` to start the whole stack from the freshly built
images, applies migrations as a startup gate, and runs a smoke test covering the
health endpoints and one end-to-end run. Cloud deployment remains deferred and is
not part of this pipeline.

## Related documents

- [MEG Lab overview](../01-overview.md)
- [MEG Lab architecture](../05-architecture.md)
- [MEG Lab data model](../06-data-model.md)
- [MEG Lab API specification](../07-api-spec.md)
- [MEG Lab deployment](../12-deployment.md)
- [MEG Lab documentation index](../README.md)
