# MEG Lab — API Specification

## 1. Purpose

This document defines the REST API for MEG Lab, a cloud-based computational electrophysiology workbench for managing magnetoencephalography (MEG) recordings, running reproducible neural signal analyses, and publishing traceable experiment results.

The API must support:
- Project-scoped access control and organisation of scientific work.
- Dataset ingestion with resumable uploads and validation of supported MEG recording formats (FIF, CTF `.ds`, KIT (`.sqd`/`.con`), UCL FIL OPM `.bin`, and BIDS-organised datasets).
- Immutable dataset versions and file assets with checksums and acquisition/sensor metadata.
- Versioned pipelines and asynchronous experiment runs with reproducible environments.
- Artifact storage with short-lived download URLs.
- Event sets, channel metadata, sensor geometry, and bounded signal retrieval for interactive visualisation.
- Consistent errors, pagination, and idempotency.
- Reproducibility through explicit manifests and pinned container digests.

## 2. API Conventions

### Base URL
- Local development: `http://localhost:8000/api/v1`
- Production: `https://<configured-api-host>/api/v1`

### HTTP Methods
| Method | Purpose |
|---|---|
| `GET` | Retrieve a resource or collection |
| `POST` | Create a resource or initiate an operation |
| `PATCH` | Partially update a resource |
| `DELETE` | Delete a resource when explicitly supported |

Use `202 Accepted` for asynchronous operations.

### Content Types
- `application/json` for JSON requests and responses.
- Binary uploads use the selected upload protocol (backend-mediated or short-lived object-storage upload URL).

### Identifiers
All resources use UUIDv4/v7-style UUIDs (non-guessable).

### Timestamps
All timestamps are returned in ISO 8601 format with UTC offset `Z`, e.g. `2026-10-12T16:30:00Z`.

### Naming
- `snake_case` for JSON field names.
- Plural nouns for collection endpoints.
- Stable, machine-readable error codes.
- No database table names or internal implementation details exposed.

## 3. Authentication and Authorisation

### Authentication
Protected endpoints require authentication. Clients may present:
- `Authorization: Bearer <token>` for API/machine clients.
- HttpOnly session cookie (default `meg-lab_session`) for browser clients.

On missing/invalid credentials, return `401 Unauthorized` with `WWW-Authenticate: Bearer` and an appropriate error code.

### Project-Scoped Authorisation
Every protected resource is scoped to a project. For each request the backend must:
1. Authenticate the caller.
2. Resolve the target project.
3. Verify caller has active membership with appropriate role.
4. Verify all referenced resources belong to that project.
5. Enforce the required permission.

### Roles
| Role | Capabilities |
|---|---|
| `owner` | Full control: projects, members, datasets, pipelines, runs, artifacts, sharing links, deletion. |
| `editor` | Create/update datasets, pipelines, runs; read everything. |
| `viewer` | Read-only access to project resources and artifacts. |

### Security Rules
- Project membership checks on every protected resource.
- Object-storage key possession is not authorisation.
- Signed upload/download URLs are short-lived and single-object scoped.
- Return `404 Not Found` for inaccessible resources to avoid information leakage.
- Cross-project access is denied by default.
- Auth failures (401/403), inaccessible resources (404), and state conflicts (409) are handled per Section 5.

## 4. Common Response Formats

### Error Envelope
```json
{
  "error": {
    "code": "validation_error",
    "message": "The request contains invalid fields.",
    "details": [
      {"field": "tmin", "code": "must_be_less_than_tmax", "message": "tmin must be less than tmax."}
    ],
    "request_id": "req_..."
  }
}
```

### Pagination
```json
{
  "items": [],
  "next_cursor": null,
  "has_more": false
}
```
Cursor pagination with deterministic ordering; max page size configurable (default 100).

### Generic Page Schema
`Page<T>` is used where cursor pagination applies.

## 5. HTTP Status Codes
| Status | Meaning |
|---|---|
| `200 OK` | Successful read/update |
| `201 Created` | Resource created |
| `202 Accepted` | Asynchronous operation accepted |
| `204 No Content` | Success with no response body |
| `400 Bad Request` | Malformed/invalid request |
| `401 Unauthorized` | Missing/invalid authentication |
| `403 Forbidden` | Lacks permission |
| `404 Not Found` | Resource missing/inaccessible |
| `409 Conflict` | State conflict or idempotency mismatch |
| `413 Content Too Large` | Upload exceeds limit |
| `415 Unsupported Media Type` | Unsupported format |
| `422 Unprocessable Entity` | Schema/semantic validation failure |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected failure |
| `503 Service Unavailable` | Dependency unavailable |

## 6. Endpoint Overview

All API paths are under `/api/v1`. The endpoint set below is authoritative and identical to the OpenAPI 3.1 contract being written in parallel.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/projects` | Create a project |
| `GET` | `/api/v1/projects` | List accessible projects |
| `POST` | `/api/v1/projects/{id}/datasets` | Create dataset and upload session |
| `POST` | `/api/v1/datasets/{id}/complete` | Finalise upload and begin validation |
| `GET` | `/api/v1/datasets/{id}` | Get dataset metadata |
| `GET` | `/api/v1/recordings/{id}` | Get recording and acquisition metadata |
| `GET` | `/api/v1/recordings/{id}/channels` | List channel metadata |
| `GET` | `/api/v1/recordings/{id}/events` | List event sets |
| `GET` | `/api/v1/recordings/{id}/signals` | Retrieve a bounded signal window or multiresolution summary |
| `GET` | `/api/v1/recordings/{id}/sensors` | Retrieve sensor geometry where available |
| `POST` | `/api/v1/pipelines` | Create a pipeline |
| `POST` | `/api/v1/pipelines/{id}/versions` | Create a versioned pipeline definition |
| `POST` | `/api/v1/runs` | Submit an experiment |
| `GET` | `/api/v1/runs/{id}` | Retrieve job status |
| `GET` | `/api/v1/runs/{id}/logs` | Retrieve authorised logs |
| `GET` | `/api/v1/runs/{id}/artifacts` | List outputs |
| `POST` | `/api/v1/projects/{id}/shares` | Create a scoped sharing link |

## 7. Projects

### POST `/api/v1/projects`
Create a project.

Request:
```json
{
  "name": "Auditory Evoked Fields",
  "description": "Auditory evoked MEG study (SQUID-MEG)",
  "visibility": "private"
}
```

Constraints: `name` required (non-blank). `visibility` in `["private","public"]` (default `private`).

Response `201 Created`:
```json
{
  "id": "proj_001",
  "name": "Auditory Evoked Fields",
  "description": "Auditory evoked MEG study (SQUID-MEG)",
  "visibility": "private",
  "owner_id": "usr_9a7f",
  "created_at": "2026-10-12T16:00:00Z",
  "updated_at": "2026-10-12T16:00:00Z",
  "archived_at": null
}
```

Errors: `400` malformed, `401` unauthenticated, `422` validation.

### GET `/api/v1/projects`
List accessible projects. Supports cursor pagination via `cursor` and `limit` query params (default `limit=100`).

Response `200 OK` (Page<Project>):
```json
{
  "items": [
    {
      "id": "proj_001",
      "name": "Auditory Evoked Fields",
      "visibility": "private",
      "owner_id": "usr_9a7f",
      "created_at": "2026-10-12T16:00:00Z"
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

## 8. Datasets

### POST `/api/v1/projects/{id}/datasets`
Create a dataset and upload session.

Request:
```json
{
  "name": "AEF-001 v3",
  "source_type": "upload",
  "description": "Auditory evoked fields session"
}
```
Constraints: `name` required. `source_type` in `["upload","import"]`.

Response `201 Created`:
```json
{
  "dataset_id": "ds_7e42",
  "name": "AEF-001 v3",
  "project_id": "proj_001",
  "status": "uploading",
  "created_at": "2026-10-12T16:05:00Z",
  "upload_session_id": "us_aa90",
  "upload_method": "backend",
  "upload_url": "/api/v1/uploads/us_aa90/content",
  "expires_at": "2026-10-12T16:35:00Z"
}
```

Errors: `401`, `403`, `404` (project not found/inaccessible), `422`.

### POST `/api/v1/datasets/{id}/complete`
Finalise upload and begin validation.

Request (optional checksum confirmation):
```json
{
  "checksum_sha256": "sha256:9f...3c"
}
```

Response `202 Accepted`:
```json
{
  "dataset_id": "ds_7e42",
  "status": "validating",
  "validation_job_id": "vj_401f",
  "message": "Upload finalised; validation started."
}
```

Behaviour:
- Idempotent: completing an already-completed session returns existing result.
- Validation includes size/checksum match, format detection (FIF/CTF `.ds`/KIT/OPM `.bin`/BIDS), bounded decompression checks, and required companion files where applicable. On success creates a `dataset_version` in `ready`. On failure returns `422` with `invalid_recording` details and marks version `failed`.
- Errors: `401`, `403`, `404`, `409` (session/state conflict), `422` (validation failure).

### GET `/api/v1/datasets/{id}`
Get dataset metadata.

Response `200 OK`:
```json
{
  "id": "ds_7e42",
  "project_id": "proj_001",
  "name": "AEF-001 v3",
  "status": "ready",
  "created_at": "2026-10-12T16:05:00Z",
  "updated_at": "2026-10-12T16:20:00Z",
  "current_dataset_version_id": "dv_bf82"
}
```

Errors: `401`, `403`, `404`.

## 9. Recordings

### GET `/api/v1/recordings/{id}`
Get recording and acquisition metadata.

Response `200 OK`:
```json
{
  "id": "rec_3d88",
  "dataset_version_id": "dv_bf82",
  "dataset_id": "ds_7e42",
  "project_id": "proj_001",
  "format": "fif",
  "file_name": "AEF-001_meg.fif",
  "duration_s": 300.0,
  "sampling_frequency_hz": 1000,
  "n_channels_total": 306,
  "n_meg_channels": 306,
  "channel_types_summary": ["mag", "grad", "stim", "eeg_aux"],
  "sensor_type": "neuromag_vectorview",
  "coordinate_frame": "head",
  "has_sensor_geometry": true,
  "has_events": true,
  "created_at": "2026-10-12T16:18:00Z"
}
```

Notes: formats reflect MEG canon (FIF, CTF `.ds`, KIT `.sqd`/`.con`, UCL FIL OPM `.bin`, BIDS). `sensor_type` examples: `neuromag_vectorview`, `opm_ucl_fil`, `ctf`, `kit`. Errors: `401`, `403`, `404`.

### GET `/api/v1/recordings/{id}/channels`
List channel metadata.

Response `200 OK` (Page<Channel> or array):
```json
{
  "items": [
    {"name": "MEG0111", "type": "mag", "unit": "T", "status": "good"},
    {"name": "MEG0112", "type": "grad", "unit": "T/m", "status": "good"},
    {"name": "STI101", "type": "stim", "unit": "none", "status": "good"}
  ],
  "next_cursor": null,
  "has_more": false
}
```

Constraints: channel types and units are explicit (never assumed homogeneous). Errors: `401`, `403`, `404`.

### GET `/api/v1/recordings/{id}/events`
List event sets.

Response `200 OK`:
```json
{
  "event_sets": [
    {
      "id": "es_6201",
      "name": "stimulus_events",
      "source": "stim_channel",
      "events": [
        {"id": 1, "time_s": 0.50, "sample": 500, "duration_s": 0.0},
        {"id": 2, "time_s": 1.50, "sample": 1500, "duration_s": 0.0}
      ],
      "metadata": {"event_id_mapping": {"1": "tone", "2": "click"}}
    }
  ]
}
```

Event times reference the recording time base. Errors: `401`, `403`, `404`.

### GET `/api/v1/recordings/{id}/signals`
Retrieve a bounded signal window or multiresolution summary.

Purpose: interactive signal navigation. The server validates requests and returns bounded windows, never the whole recording.

#### Query Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `channels` | string | no | Channel selection. Comma-separated channel names or groups (e.g. `MEG*,grad,STI*`). Supports inclusion/exclusion patterns. |
| `grouping` | string | no | Grouping strategy: `type` (by channel type), `sensor_group`, or `custom`. |
| `tmin` | number | yes | Start time in seconds (recording time base). Must be < `tmax`. |
| `tmax` | number | yes | End time in seconds. Window duration bounded by server limits. |
| `resolution` | number | no | Requested temporal resolution in samples per point (downsampling target). Higher values = coarser. |
| `downsample_factor` | integer | no | Explicit decimation factor `k>=1` (integer). Applied to the selected window. |
| `decimation_ack` | boolean | no | Acknowledge that decimated data is a summary (diagnostic/visual). Default `false`. |
| `units` | string | no | Preferred units for returned values (`si`, `native`, `display`). Server may normalise per channel type. |

Constraints & behaviour:
- `tmin < tmax` required; window is bounded (server enforces max window size and max points). 
- Exactly one of `resolution` or `downsample_factor` may be specified in typical requests; if neither, server returns a multiresolution-appropriate bounded representation.
- Server returns a bounded window (never entire recording). Responses may be multiresolution summaries for rapid panning.
- Channel selection is validated against recording channels.

Request example:
```http
GET /api/v1/recordings/rec_3d88/signals?tmin=0.0&tmax=10.0&channels=MEG0111,MEG0112,STI101&downsample_factor=4&decimation_ack=true&units=native
```

Response `200 OK`:
```json
{
  "recording_id": "rec_3d88",
  "tmin_s": 0.0,
  "tmax_s": 10.0,
  "sampling_frequency_hz": 1000,
  "effective_sampling_frequency_hz": 250,
  "downsample_factor": 4,
  "decimated": true,
  "n_times": 2500,
  "channels": [
    {"name": "MEG0111", "type": "mag", "unit": "T", "data": [ ... ]},
    {"name": "MEG0112", "type": "grad", "unit": "T/m", "data": [ ... ]},
    {"name": "STI101", "type": "stim", "unit": "none", "data": [ ... ]}
  ],
  "times": [0.0, 0.004, ..., 9.996],
  "summary": "bounded_window",
  "boundary_checked": true
}
```

Notes: large windows are bounded and may be returned as multiresolution summaries; `data` arrays are numeric sequences for the requested window. Errors: `400` (invalid params), `401`, `403`, `404`, `422` (window out of range or exceeds limits).

### GET `/api/v1/recordings/{id}/sensors`
Retrieve sensor geometry where available.

Response `200 OK`:
```json
{
  "recording_id": "rec_3d88",
  "sensor_type": "neuromag_vectorview",
  "coordinate_frame": "head",
  "units": "m",
  "sensors": [
    {
      "name": "MEG0111",
      "type": "mag",
      "coil_type": "magnetometer",
      "position": [0.056, 0.012, 0.078],
      "orientation": [0.707, 0.0, 0.707],
      "normal": [0.707, 0.0, 0.707]
    },
    {
      "name": "MEG0112",
      "type": "grad",
      "coil_type": "planar_gradiometer",
      "position": [0.056, 0.012, 0.078],
      "orientation": [1.0, 0.0, 0.0]
    }
  ],
  "helmet_model": "neuromag_vectorview",
  "opm_metadata": null
}
```

OPM example (when present):
```json
{
  "recording_id": "rec_opm_9a44",
  "sensor_type": "opm_ucl_fil",
  "coordinate_frame": "head",
  "units": "m",
  "sensors": [
    {"name": "OPM001", "type": "opm", "position": [0.040, -0.020, 0.085], "orientation": [0.0, 0.0, 1.0]}
  ],
  "helmet_model": "opm_array",
  "opm_metadata": {
    "array_type": "ucl_fil_opm",
    "n_channels": 64,
    "movement_tracking": true
  }
}
```

Geometry may be absent for some recordings; returns `has_sensor_geometry: false` in recording metadata. Errors: `401`, `403`, `404`.

## 10. Pipelines

### POST `/api/v1/pipelines`
Create a logical pipeline in project.

Request:
```json
{
  "name": "event-related-analysis",
  "description": "Epoching + evoked response pipeline",
  "project_id": "proj_001"
}
```

Response `201 Created`:
```json
{
  "id": "pl_8ab3",
  "project_id": "proj_001",
  "name": "event-related-analysis",
  "description": "Epoching + evoked response pipeline",
  "created_at": "2026-10-12T16:25:00Z",
  "updated_at": "2026-10-12T16:25:00Z"
}
```

Errors: `401`, `403`, `404`, `422`.

### POST `/api/v1/pipelines/{id}/versions`
Create a versioned pipeline definition.

Request:
```json
{
  "version": "1.2.0",
  "definition": {
    "steps": [
      {"name": "filter", "type": "bandpass", "params": {"l_freq_hz": 1.0, "h_freq_hz": 40.0}},
      {"name": "epoch", "type": "epochs", "params": {"tmin_s": -0.2, "tmax_s": 0.8, "baseline_s": [-0.2, 0.0]}}
    ],
    "parameters_schema": {
      "type": "object",
      "required": ["filter", "epoch"],
      "additionalProperties": false
    }
  },
  "image_digest": "sha256:ab...cd"
}
```

Constraints: unique (pipeline_id, version). `image_digest` is immutable digest (not tag). Definition validated against schema.

Response `201 Created`:
```json
{
  "id": "pv_4f92",
  "pipeline_id": "pl_8ab3",
  "version": "1.2.0",
  "definition": { ... },
  "image_digest": "sha256:ab...cd",
  "created_at": "2026-10-12T16:26:00Z"
}
```

Errors: `401`, `403`, `404`, `409` (version conflict), `422`.

## 11. Runs (Experiments)

### POST `/api/v1/runs`
Submit an experiment. **Requires `Idempotency-Key` header**.

Request:
```json
{
  "pipeline_version_id": "pv_4f92",
  "dataset_version_id": "dv_bf82",
  "parameters": {
    "filter": {"l_freq_hz": 1.0, "h_freq_hz": 40.0},
    "epoch": {"tmin_s": -0.2, "tmax_s": 0.8, "baseline_s": [-0.2, 0.0]}
  }
}
```

Validation: parameters match pipeline schema; inputs belong to consistent project; dataset version is `ready`.

Response `202 Accepted`:
```json
{
  "id": "run_9f3c1b7a",
  "status": "queued",
  "requested_at": "2026-10-12T16:30:00Z",
  "pipeline_version_id": "pv_4f92",
  "dataset_version_id": "dv_bf82"
}
```

Idempotency: identical request + same key returns original run; different request hash returns `409 Conflict`. Transactional outbox ensures dispatch.

Errors: `400`, `401`, `403`, `404`, `409`, `422`.

### GET `/api/v1/runs/{id}`
Retrieve job status.

Response `200 OK`:
```json
{
  "id": "run_9f3c1b7a",
  "status": "succeeded",
  "requested_at": "2026-10-12T16:30:00Z",
  "started_at": "2026-10-12T16:31:00Z",
  "finished_at": "2026-10-12T16:34:15Z",
  "duration_s": 195,
  "parameters": { ... },
  "pipeline_version_id": "pv_4f92",
  "dataset_version_id": "dv_bf82",
  "error": null,
  "artifacts_count": 2
}
```

Statuses: `queued`, `running`, `succeeded`, `failed`, `cancelled`. Errors: `401`, `403`, `404`.

### GET `/api/v1/runs/{id}/logs`
Retrieve authorised logs.

Response `200 OK`:
```json
{
  "run_id": "run_9f3c1b7a",
  "logs": [
    "2026-10-12T16:31:00Z INFO Worker started",
    "2026-10-12T16:31:05Z INFO Loading recording AEF-001_meg.fif",
    "2026-10-12T16:34:10Z INFO Epochs created: n=120"
  ],
  "next_cursor": null,
  "has_more": false
}
```

Notes: no secrets, tokens, signed URLs, or raw signal arrays in logs. May be paginated/streamed. Errors: `401`, `403`, `404`.

### GET `/api/v1/runs/{id}/artifacts`
List outputs.

Response `200 OK`:
```json
{
  "run_id": "run_9f3c1b7a",
  "artifacts": [
    {
      "id": "art_e7a0",
      "name": "evoked_response.png",
      "media_type": "image/png",
      "size_bytes": 245760,
      "checksum_sha256": "sha256:5e...a2",
      "created_at": "2026-10-12T16:34:12Z"
    },
    {
      "id": "art_f3b2",
      "name": "evoked_data.json",
      "media_type": "application/json",
      "size_bytes": 4096,
      "checksum_sha256": "sha256:7b...44",
      "created_at": "2026-10-12T16:34:14Z"
    }
  ]
}
```

Errors: `401`, `403`, `404`.

## 12. Sharing

### POST `/api/v1/projects/{id}/shares`
Create a scoped sharing link.

Request:
```json
{
  "scope": "read_only",
  "expires_at": "2026-10-19T16:30:00Z",
  "grants": ["datasets:read", "runs:read", "artifacts:read"]
}
```

Constraints: `scope` in `["read_only","custom"]`. Expiry required or server default; short-lived.

Response `201 Created`:
```json
{
  "share_id": "sh_c902",
  "project_id": "proj_001",
  "share_url": "https://<app-host>/share/sh_c902",
  "scope": "read_only",
  "expires_at": "2026-10-19T16:30:00Z",
  "revoked_at": null,
  "created_at": "2026-10-12T16:35:00Z"
}
```

Errors: `401`, `403`, `404`, `422`.

## 13. MEG Product Canon (Reference)

The API uses the following canonical MEG values consistently in examples and validation:
- Promise: "Go from a raw MEG recording to an interpretable, reproducible neural signal analysis in the cloud." (SQUID-MEG + OPM-MEG; MNE-Python backbone; formats FIF, CTF `.ds`, KIT (`.sqd`/`.con`), UCL FIL OPM `.bin`, BIDS.)
- Neuromag Vectorview (example): 306 MEG (102 mag + 204 grad) + 9 auxiliary channels, 1000 Hz, head coordinate frame.
- OPM example: UCL FIL OPM, 64 channels, variable geometry, movement tracking.
- Pipeline templates: event-related-analysis v1.2.0, spectral-analysis v0.9.3, opm-preprocess v0.4.0, bad-channel-detection v1.1.0, ssp-artifact-removal v0.3.0.
- NFRs (API-relevant): 99.5% availability; signal navigation <150 ms for cached bounded windows; API p95 <300 ms; run ID <2 s; resumable uploads; reproducibility manifests; no cross-project access.

## 14. Validation & Error Behaviour

- **401 Unauthorized**: missing/invalid Bearer token or session cookie. Include `WWW-Authenticate: Bearer`.
- **403 Forbidden**: authenticated but lacks required role/permission on project resource.
- **404 Not Found**: resource does not exist or is inaccessible to caller (project-scoped; avoid information leakage).
- **409 Conflict**: idempotency key mismatch, version/state conflict (e.g. duplicate pipeline version), or upload/session state conflict.
- **422 Unprocessable Entity**: semantic/schema validation failure (e.g. `tmin >= tmax`, window exceeds bounds, invalid recording format, parameter schema mismatch).
- All errors return the Error Envelope (Section 4). Request ID included in `X-Request-Id` header and envelope `request_id`. No secrets, tokens, or internal paths in error messages.

## 15. Definition of Done (API)

1. Endpoints match the 17 canonical endpoints above exactly.
2. All operations enforce project membership and role checks.
3. Error envelope and status codes are consistent across endpoints.
4. Cursor pagination is tenant-scoped and deterministic.
5. Upload finalisation validates supported MEG formats with checksum/size checks.
6. Signals endpoint validates query params, enforces bounded windows (never whole recording), and supports multiresolution summaries.
7. Run submission requires `Idempotency-Key` header and is transactional+outboxed.
8. Signed URLs are short-lived, single-object scoped, and access-controlled.
9. Manifests capture provenance (image_digest, pipeline/dataset versions, checksums).
10. Sensor geometry and event/channel metadata are explicit with coordinate frames/units.
11. OpenAPI 3.1 contract remains in sync with this specification.
12. Critical isolation/security cases tested.

(End of document)