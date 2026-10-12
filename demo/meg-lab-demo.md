# MEG Lab — Feature Demo Script

A guided, scene-by-scene script that exercises the user-visible features of
**MEG Lab**, a project-scoped computational-neuroimaging workbench for
magnetoencephalography: private-by-default identity, project workspaces,
membership and roles, project isolation, account settings, and operational health.

- **Audience:** reviewers, interviewers, or a recorded portfolio walkthrough.
- **Runtime:** ~8–10 minutes for the recorded (implemented) scenes.
- **Data:** synthetic or public data only — never identifiable clinical data.
- **Claim discipline:** the scenes marked **Implemented** are backed by code and
  tests. Section 6 distinguishes implemented workflows that are not recorded
  from partial and future UI work; no future work is presented as shipped.

> MEG Lab is research software. It does not diagnose conditions, recommend
> treatment, or claim clinical or regulatory validity.

---

## 1. What this demo proves

| #   | Scene                 | Feature / capability                                        | Story          | Status      |
| --- | --------------------- | ----------------------------------------------------------- | -------------- | ----------- |
| 0   | Operational health    | Liveness, readiness, Prometheus metrics                     | US-046         | Implemented |
| 1   | Landing page          | Public proposition, "private by default" positioning        | US-040         | Implemented |
| 2   | Sign in               | Development identity, HttpOnly session cookie, route guard  | US-001         | Implemented |
| 3   | Dashboard             | Project-scoped counts, recent runs, workspace usage         | US-003         | Implemented |
| 4   | Browse projects       | Project list, roles, status, empty states                   | US-006         | Implemented |
| 5   | Create project        | Project lifecycle (create) and inline validation            | US-005         | Implemented |
| 6   | Project detail        | Details grid, dataset/run sections, role-appropriate owners | US-005, US-007 | Implemented |
| 7   | Members and roles     | Add member, change role, last-owner invariant               | US-004, US-008 | Implemented |
| 8   | Dataset registration  | Synthetic dataset registration and validation dispatch    | US-012         | Implemented |
| 9   | Pipeline authoring    | Published, versioned pipeline definition                 | US-014         | Implemented |
| 10  | Settings and sign out | Account, workspace usage, session teardown                  | US-002, US-043 | Implemented |
| 11  | Project isolation     | Cross-project access returns `404`, never `403`             | US-002, US-011 | Implemented |

Signed upload of external scientific files remains implemented but is not
driven by the automated recording because the demo intentionally avoids
checking in a binary recording fixture. The recording uses the deterministic
synthetic dataset path to exercise registration and validation dispatch.
Signal viewing, run execution, logs, and artifact/provenance presentation are
implemented but remain outside this recording; richer pipeline editing remains
future work. The current implementation boundary is documented in
`docs/README.md` and `docs/04-features.md`.

---

## 2. Prerequisites

- Docker and Docker Compose
- `pnpm` / Node.js (for the automated recording option)
- `ffmpeg` and `ffprobe` (for the automated recording option)
- `curl` and `python3` (for the optional API tour)
- ~4 GB free disk for images and volumes

The automated recording drives the implemented scenes and creates a synthetic
dataset at runtime, so it needs no checked-in scientific data or upload fixture.

---

## 3. Option A — Automated recording (one command)

This starts the full stack, drives a headless Chromium through the implemented
workflow, and renders `demo/meg-lab-demo.mp4`. It requires `docker`, `pnpm`,
`ffmpeg`, and `ffprobe`.

```bash
./scripts/create_demo.sh
```

The Compose services **stay running** afterwards. Stop them with:

```bash
docker compose -p meg-lab down
```

For a narrated walkthrough, continue with Option B.

---

## 4. Option B — Guided walkthrough

### 4.1 Start the stack

```bash
# 1. Start PostgreSQL, Redis, API, worker, dispatcher and the frontend
docker compose up --build -d

# 2. Wait until the API reports ready
curl --fail http://localhost:8000/health/ready
```

Expected: a JSON body with `"status": "ready"` and a healthy database.

| Service            | URL                           |
| ------------------ | ----------------------------- |
| Frontend           | http://localhost:3000         |
| API                | http://localhost:8000/api/v1  |
| API docs (OpenAPI) | http://localhost:8000/docs    |
| Metrics            | http://localhost:8000/metrics |

### 4.2 Cast

- **Demo researcher** — the development identity (`demo@meg-lab.local` by
  default). No password is required while `AUTH_MODE=development`.
- **Active project** — selected in the top bar; all datasets, pipelines and runs
  are scoped to it.

### Scene index

| Scene | Title                               | Status      |
| ----- | ----------------------------------- | ----------- |
| 0     | Operational health                  | Implemented |
| 1     | Landing page and private-by-default | Implemented |
| 2     | Sign in and session cookie          | Implemented |
| 3     | Dashboard and workspace usage       | Implemented |
| 4     | Browse projects                     | Implemented |
| 5     | Create a project                    | Implemented |
| 6     | Project detail                      | Implemented |
| 7     | Members and roles                   | Implemented |
| 8     | Dataset registration                | Implemented |
| 9     | Pipeline authoring                  | Implemented |
| 10    | Settings and sign out               | Implemented |
| 11    | Project isolation                   | Implemented |

---

### Scene 0 — Operational health

**Narration:** "MEG Lab is a durable, project-scoped service. Before anything
else, I confirm the API process is alive and its dependencies are ready."

**Do**

```bash
curl -s http://localhost:8000/health/live    # process liveness
curl -s http://localhost:8000/health/ready   # database dependency
curl -s http://localhost:8000/metrics | head # Prometheus counters/histograms
```

**Expected:** `health/live` returns service, version and environment;
`health/ready` returns `status: ready` with a healthy database; `/metrics`
exposes HTTP, database, storage, outbox and worker metrics.

**Talking point:** health endpoints never reveal secrets or connection strings;
`/healthz` and `/readyz` are undocumented aliases. `/metrics` is unauthenticated
by design and is expected to be restricted by network policy in deployment.

---

### Scene 1 — Landing page and private-by-default

**Narration:** "The public surface states the product's posture before anyone
signs in: data is private by default."

**Do**

1. Open http://localhost:3000.
2. Read the headline — **"Explore real MEG data and run computational
   neuroscience experiments."**
3. Note the **"Private by default"** badge and the three capability cards:
   **View**, **Compute**, **Share**.

**Expected:** the page renders without a session; the header offers **Explore**
and **Sign in**. The footer states the research-use disclaimer.

**Talking point:** the marketing surface never exposes project data, and the
viewer preview is clearly a preview, not a live tenant resource.

---

### Scene 2 — Sign in and session cookie

**Narration:** "Access is deny-by-default. Everything under `/app` requires a
session, and the browser authenticates through the Next.js BFF, which keeps the
bearer token in an HttpOnly session cookie so it is never exposed to
JavaScript."

**Do**

1. Open a protected route directly: http://localhost:3000/app/dashboard.
2. Observe the redirect to `/login?next=/app/dashboard`.
3. Sign in. With `AUTH_MODE=development`, mint a development identity with:

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@meg-lab.local","display_name":"Demo Researcher"}'
```

**Expected:** the route guard (`src/proxy.ts`) redirects unauthenticated
`/app/*` requests to `/login`; after sign-in a session cookie
(`meg-lab_session`, HttpOnly, `SameSite=Lax`) is set and you land on
`/app/dashboard`.

**Talking point:** `POST /auth/token` is development-only; it returns `404`
unless `AUTH_MODE=development`, and production rejects `AUTH_MODE=development`
at startup. Frontend route gating is usability only — the server re-verifies
membership and role on every request.

---

### Scene 3 — Dashboard and workspace usage

**Narration:** "The dashboard summarises the workbench: your projects, recent
runs, and the quotas applied to your account."

**Do**

1. Observe the **Home** heading and the stat tiles:
   **Projects**, **Recent runs**, and **Storage used**.
2. Read the **Recent runs** card (or its "No runs yet" empty state) and the
   **Projects** card.
3. Read the **Workspace usage** card: each quota row shows a status badge —
   **Within quota**, **Approaching limit**, or **Limit reached** — and a
   progress bar.

**Expected:** counts and tables reflect only projects you can access; empty
states explain the next action (for example, **Browse pipelines**).

**Talking point:** the dashboard is composed from `GET /me`, `GET /projects`,
`GET /runs` and `GET /usage`; when data is absent it shows an actionable empty
state rather than a blank page.

---

### Scene 4 — Browse projects

**Narration:** "A project is the primary container for datasets, pipelines, and
runs. Membership is project-scoped."

**Do**

1. In the left navigation (**Primary**), click **Projects**.
2. Review the table: **Project | Role | Status | Datasets | Runs | Updated**.
3. Note the **Role** column (Owner / Editor / Viewer) and the **Status** badge
   (Active / Archived).

**Expected:** the list shows every project you own or belong to, with cursor
pagination. A new account shows the **"No projects yet"** empty state with a
**Create project** action.

**Talking point:** the project id in a URL is a _selector_, not proof of
permission — the server re-verifies membership and role on every request.

---

### Scene 5 — Create a project

**Narration:** "Creating a project is the first write; it is idempotent from the
user's perspective and validated inline."

**Do**

1. On **Projects**, click **New project**.
2. In the dialog, set **Name** = `MEG Lab Demo Project` and
   **Description** = `Synthetic project used to demonstrate the MEG Lab workflow.`
3. Click **Create project**.

**Expected:** the dialog validates that a project name is required; on success
the project appears in the list and you become its **Owner**.

**Talking point:** the client cannot choose an owner or a storage identity; the
backend assigns ownership and returns the role. Duplicate submissions are
guarded against.

---

### Scene 6 — Project detail

**Narration:** "The project page is the hub for its datasets, pipelines and
runs."

**Do**

1. Click the **MEG Lab Demo Project** row.
2. Observe the **Details** grid: **Role | Visibility | Datasets | Runs | Created
   | Updated**.
3. Note the **Datasets** card and **Recent runs** card, each with an actionable
   empty state while the project is new.
4. If the project is archived, note that write controls are hidden and the
   status badge reads **Archived**.

**Expected:** breadcrumbs read **Projects › \<name\>**; the page shows only
resources belonging to this project.

**Talking point:** archiving is a status change, not a delete — it must never
silently destroy datasets, runs, artifacts, or audit history.

---

### Scene 7 — Members and roles

**Narration:** "Only owners manage membership, and the last owner can never be
removed."

**Do** (UI + API)

```bash
API=http://localhost:8000/api/v1
TOKEN=$(curl -s -X POST $API/auth/token -H 'Content-Type: application/json' \
  -d '{"email":"demo@meg-lab.local","display_name":"Demo Researcher"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
AUTH="Authorization: Bearer $TOKEN"

PROJECT=$(curl -s $API/projects -H "$AUTH" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["items"][0]["id"])')

# List members and roles
curl -s $API/projects/$PROJECT/members -H "$AUTH"

# Create a viewer invitation
curl -s -X POST $API/projects/$PROJECT/invitations -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{"email":"viewer@meg-lab.local","role":"viewer"}'
```

**Expected:** a viewer cannot modify the project (a write attempt returns
`403`), and attempting to demote the last owner returns `409` with the error
code `last_owner`.

**Talking point:** role enforcement is server-side; the UI hiding an action is a
convenience, not the security boundary.

---

### Scene 8 — Dataset registration

**Narration:** "A synthetic MEG sample lets me show the validated data path
without distributing a binary recording fixture."

**Do**

1. Open the dataset detail page created for the active project.
2. Confirm the dataset reaches **Ready** and shows its recording metadata.
3. Confirm the dataset appears in the project dataset list.

**Expected:** the automated recording creates a synthetic dataset and waits for
the worker validation dispatch to be visible. External signed uploads use the
same dataset lifecycle but are covered separately by application and backend
tests. The signal viewer is implemented but not part of this recording because
the current public dataset detail API does not expose the generated version
and recording identifiers needed to navigate it.

### Scene 9 — Pipeline authoring

**Narration:** "A project can publish a versioned pipeline definition ready for
worker submission."

**Do**

1. Create a pipeline with a published initial version.
2. Open the pipeline detail page and confirm the published version.
3. Confirm the published pipeline appears in the pipeline list.

**Expected:** the automated recording verifies pipeline and version creation
through the API and confirms the browser list renders the pipeline. Run
submission and worker execution are implemented but not part of this recording.

### Scene 10 — Settings and sign out

**Narration:** "Account settings cover identity, usage, and appearance."

**Do**

1. Click **Settings** in the navigation.
2. Show the **Account** card: **Display name**, **Email**, and the **Sign out**
   control.
3. Show **Workspace usage** and the **Appearance** note (dark, low-glare theme
   that honours the system colour scheme).
4. Click **Sign out**.

**Expected:** sign-out clears both the session cookie and the display hint, and
returns you to `/login`.

**Talking point:** the display-name cookie (`meg-lab_user`) contains no token
and is only a rendering hint; the real credential lives in the HttpOnly cookie.

---

### Scene 11 — Project isolation (security)

**Narration:** "Identifiers in a URL never grant access."

**Do** (API)

```bash
API=http://localhost:8000/api/v1
TOKEN_A=$(curl -s -X POST $API/auth/token -H 'Content-Type: application/json' \
  -d '{"email":"owner@meg-lab.local"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
TOKEN_B=$(curl -s -X POST $API/auth/token -H 'Content-Type: application/json' \
  -d '{"email":"intruder@meg-lab.local"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

PROJECT_A=$(curl -s $API/projects -H "Authorization: Bearer $TOKEN_A" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["items"][0]["id"])')

# Identity B tries to read A's project
curl -s -o /dev/null -w '%{http_code}\n' \
  $API/projects/$PROJECT_A -H "Authorization: Bearer $TOKEN_B"
```

**Expected:** `404` (not `403`) — the API prefers not to disclose that the
resource exists. Unauthenticated requests return `401`.

**Talking point:** possession of an identifier or a storage key is never
authorisation; every read, write, download and job submission re-checks the
caller's project permissions.

---

## 5. Optional — API-only quick tour

Mint a token, then walk the implemented workflow over REST. The BFF and the UI
call exactly these endpoints.

```bash
API=http://localhost:8000/api/v1
TOKEN=$(curl -s -X POST $API/auth/token -H 'Content-Type: application/json' \
  -d '{"email":"demo-api@meg-lab.local","display_name":"API Demo"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
AUTH="Authorization: Bearer $TOKEN"

# Current user and project memberships
curl -s $API/me -H "$AUTH"

# List accessible projects
curl -s $API/projects -H "$AUTH"

# Create a project
PROJECT=$(curl -s -X POST $API/projects -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{"name":"API Demo Project","description":"Created via REST"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')

# Update it
curl -s -X PATCH $API/projects/$PROJECT -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{"description":"Updated via REST"}'

# Create an editor invitation
curl -s -X POST $API/projects/$PROJECT/invitations -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{"email":"editor@meg-lab.local","role":"editor"}'

# Archive, then restore
curl -s -X POST $API/projects/$PROJECT/archive -H "$AUTH"
curl -s -X POST $API/projects/$PROJECT/restore -H "$AUTH"
```

Every non-2xx response uses the same envelope:

```json
{
  "error": {
    "code": "not_found",
    "message": "The requested resource does not exist.",
    "details": [],
    "request_id": "req_..."
  }
}
```

The `request_id` matches the `X-Request-Id` response header, so a screenshot of
a failure can be traced to a structured log line.

---

## 6. Implemented workflows not yet in the recording and remaining work

The workflows below describe the current application boundary. They are not
part of the automated recording unless explicitly marked otherwise.

### Implemented A — MEG Recording Upload and Validation

The upload page at `/app/datasets/new` registers a dataset with
`POST /projects/{id}/datasets`, computes a SHA-256 digest in the browser, uploads
the selected recording to the returned signed target, and finalises it with
`POST /datasets/{id}/complete`. The server verifies the object size and checksum,
creates a validating dataset version, and enqueues scientific validation before
the dataset becomes `ready`.

### Implemented B — MEG Signal Viewer

Open a `ready` dataset version at `/app/datasets/{id}/viewer` to inspect
bounded multichannel time-series traces, select/search channels, navigate time,
overlay event markers, and inspect sensor-geometry availability. Rendering is a
display transformation and never modifies the source recording. Linked
anatomical planes and crosshair navigation are not implemented.

### Implemented C — Pipelines and Versions

Create a pipeline at `/app/pipelines/new` and publish an initial immutable
version carrying a worker image digest and executable node definition. Published
versions appear in the pipeline detail view and can be selected for a run.

### Implemented D — Runs, Monitoring, and Cancellation

Submitting a run creates a queued experiment record and dispatches `run.dispatch`
through the transactional outbox to the Celery worker. The worker atomically
claims the run, executes the versioned definition, persists logs and checksummed
artifacts, and writes a reproducibility manifest.

### Partial E — Artifacts and Provenance

The worker persists logs, checksummed artifacts, and a machine-readable
experiment manifest containing the pipeline version, image digest, input
dataset versions and checksums, parameters, environment, and outputs. A
complete browser UI for listing/downloading artifacts and inspecting provenance
is not yet implemented.

---

## 7. Feature coverage checklist

Tick each item as it is shown on screen or in the terminal.

- [ ] Landing page and "private by default" positioning
- [ ] Liveness and readiness (`/health/live`, `/health/ready`)
- [ ] Prometheus metrics (`/metrics`)
- [ ] Route guard redirects unauthenticated `/app/*` to `/login`
- [ ] Development sign-in and HttpOnly session cookie (`meg-lab_session`)
- [ ] Dashboard stat tiles, recent runs, and workspace usage
- [ ] Project list with role and status columns
- [ ] Project create with inline validation
- [ ] Project detail: details grid, datasets and runs sections
- [ ] Membership: add member and role enforcement
- [ ] Last-owner invariant (`409 last_owner`)
- [ ] Settings: account, usage, appearance
- [ ] Sign out clears the session and returns to `/login`
- [ ] Project isolation returns `404` for cross-project access
- [ ] Consistent error envelope with `request_id`
- [ ] Accessibility: labelled forms, `aria-live` states, status text beyond colour

---

## 8. Teardown

```bash
# Stop the stack but keep data volumes
docker compose down

# Also remove the database and stored objects
docker compose down -v
```

If you used Option A, run `docker compose -p meg-lab down` instead.

---

## 9. Troubleshooting

| Symptom                          | Likely cause                       | Fix                                                 |
| -------------------------------- | ---------------------------------- | --------------------------------------------------- |
| `/health/ready` not ready        | Postgres/Redis still starting      | Wait and retry; check `docker compose ps`           |
| `/app/*` keeps redirecting       | No `meg-lab_session` cookie        | Sign in again; confirm `AUTH_MODE=development`      |
| Sign-in shows "not available"    | API not in `AUTH_MODE=development` | Use the Compose stack (dev mode)                    |
| Dashboard shows empty states     | New account with no data yet       | Continue the script to create a project             |
| Cross-project read returns `200` | Membership injection               | Re-check that project B's user is not a member of A |

---

## 10. Related material

- `demo/meg-lab-demo.mp4` — recorded walkthrough (implemented scenes).
- `scripts/create_demo.sh` — automation that produced the MP4.
- `packages/frontend/e2e/create-demo.ts` — the Playwright recorder.
- `packages/frontend/e2e/smoke.spec.ts` — frontend smoke tests.
- `docs/03-user-stories.md`, `docs/04-features.md` — normative behaviour.
- `docs/07-api-spec.md`, `docs/api-specs/api-spec.yaml` — API contract.