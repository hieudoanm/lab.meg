# Phase 2 — Milestone 1: Platform Foundation

## 6. Phase 2 — Milestone 1: Platform Foundation

### 6.1 Objective

Deliver secure identity, project tenancy, and upload infrastructure before exposing real recording workflows.

**Priority:** P0 — **Weeks:** 2–3

### 6.2 Milestone definition (product specification, section 12)

- Authentication and project management.
- Object storage, upload sessions, checksums, and metadata records.
- Dataset validation and access control.
- Initial resource limits and audit events.

Exit criterion: users can securely create projects and upload supported recordings.

### 6.3 Tasks

#### Authentication and identity (FR-001)

- [x] Choose and document the authentication approach, including a local development mechanism for CI.
- [x] Implement token or session validation and map authenticated identities to local `users` records.
- [x] Support sign up, sign in, sign out, and account recovery.
- [x] Ensure unauthenticated requests to protected endpoints receive a consistent error without internal detail.

#### Projects and membership (FR-002)

- [x] Implement project create, rename, archive, and delete.
- [x] Persist membership in `project_members` with the caller recorded as owner on creation.
- [x] Implement role-based permission checks (`owner`, `researcher`, `viewer`).
- [x] Enforce the last-owner invariant and prevent self-granted permissions.
- [x] Add project-scoped query helpers that never trust a client-supplied project ID.
- [x] Add pagination with deterministic ordering and search by name.

#### Upload and dataset records (FR-003, FR-004, FR-005)

- [x] Configure private S3-compatible object storage (MinIO locally).
- [x] Create an upload-session API returning short-lived, scoped upload instructions.
- [x] Implement resumable transfer with safe retries.
- [x] Implement idempotent upload finalisation.
- [x] Verify object existence and expected size on completion.
- [x] Calculate and record a SHA-256 checksum per file asset.
- [x] Model `datasets`, `dataset_versions`, `recordings`, `file_assets`, `channels`, and `sensor_configurations`.
- [x] Treat directory-based and companion-file recordings as a coherent validated set.

#### Access control, limits, and audit (FR-014, FR-015)

- [x] Enforce project membership on every project-scoped endpoint.
- [x] Add initial upload, storage, and concurrency limits.
- [x] Add `audit_events` for membership changes and sensitive operations, persisted in the same transaction.
- [x] Add failed-upload recovery and abandoned-session cleanup.
- [x] Test unauthenticated access, role restrictions, and cross-project access attempts.

#### Backend and frontend foundation

- [x] Create the FastAPI application and configuration management with validated settings.
- [x] Configure PostgreSQL connectivity using Psycopg 3 (async) with a bounded pool.
- [x] Configure versioned SQL migrations and a runner.
- [x] Add `/health` (liveness) and `/ready` (readiness) endpoints.
- [x] Create the Next.js application shell, design tokens, and routing.
- [x] Add project creation and recording upload forms with progress and validation feedback.

### 6.4 Required roles

| Capability                       | Owner | Researcher | Viewer |
| -------------------------------- | ----- | ---------- | ------ |
| View permitted projects          | Yes   | Yes        | Yes    |
| Create and edit projects         | Yes   | Yes        | No     |
| Archive or delete projects       | Yes   | No         | No     |
| Upload and manage recordings     | Yes   | Yes        | No     |
| View recordings and results      | Yes   | Yes        | Yes    |
| Submit experiment runs           | Yes   | Yes        | No     |
| Create and edit pipelines        | Yes   | Yes        | No     |
| Manage project members and roles | Yes   | No         | No     |
| Create scoped shares             | Yes   | Yes        | No     |

Project membership is the tenancy boundary. Do not introduce multi-organisation or institutional tenancy for the MVP.

The implemented API names the non-owner roles `editor` and `viewer`. Earlier
planning text used `researcher`; that name is not part of the shipped contract.

### 6.5 Upload and validation invariants

- The user must be authorised to upload into the target project.
- Storage is private; possession of an object key is not authorisation.
- The server validates the file set independently of browser checks.
- A recording is not `ready` before validation succeeds.
- Finalisation confirms every expected object exists, matches its declared size, and has the expected checksum.
- Never load an unbounded recording into API memory; serve viewer data through bounded ranges or derived summaries.
- Never load untrusted data with pickle enabled.
- A database failure after object upload must not create an indefinitely invisible object.

### 6.6 Dependencies

- Phases 0 and 1 (the ingestion interface is required to validate a file set).

### 6.7 Exit criteria

- An authorised user can create a project and upload a supported recording set, see `ready`, and view correct acquisition metadata.
- Invalid or incomplete recording sets are `rejected` with safe, actionable messages identifying the missing file set.
- No raw MEG signal arrays are stored in relational rows.
- Every accepted file asset has a recorded checksum.
- A dataset version is immutable once `ready`; further changes create a new version.
- A viewer cannot submit runs or modify datasets.
- A user cannot access another project's resources by changing a URL identifier.
- Abandoned uploads are cleaned up and do not leave stuck sessions.

### 6.8 Risks

| Risk                                          | Mitigation                                                           |
| --------------------------------------------- | -------------------------------------------------------------------- |
| Tenant isolation bug                          | Centralised permission checks, composite FKs, negative tests         |
| Object exists but database finalisation fails | Reconciliation task for abandoned sessions and unreferenced objects  |
| Interrupted large uploads                     | Resumable transfer and integrity checks                              |
| Local auth leaking into production            | Isolate development auth and fail fast outside `APP_ENV=development` |
| Directory/companion-set inconsistency         | Validate the whole set as a unit before accepting                    |

### 6.9 FR mapping

Milestone 1 completes FR-001, FR-002, FR-003, FR-004, FR-005, FR-014, and FR-015.

