# Comprehensive Architecture and Data-Flow Diagrams

This document collects the Mermaid diagrams that describe MEG Lab's
architecture end to end. Render them with any Markdown viewer that supports
Mermaid (GitHub, GitLab, VS Code with an extension, and similar).

The canonical rule throughout is that interactive web requests are separated
from scientific computation: MEG signal processing never runs inside a request
handler. A second rule specific to this product is that the API serves bounded
signal windows and precomputed multiresolution summaries rather than streaming
whole recordings through its own memory.

## 1. High-level system architecture

```mermaid
flowchart TB
    subgraph Client["Client layer"]
        Browser["Browser\nNext.js + React + TypeScript"]
        Viewer["Signal viewer\nPlotly.js / WebGL + canvas"]
        Sensors["Sensor Explorer\nThree.js / vtk.js"]
    end

    subgraph Frontend["Frontend server layer"]
        BFF["Next.js BFF\nsession cookie to REST"]
    end

    subgraph ApiLayer["API layer"]
        API["FastAPI REST API\n/api/v1"]
        Health["Health endpoints\n/live, /ready"]
        Auth["Authentication\nOIDC or managed sessions"]
    end

    subgraph Data["Data layer"]
        PG[("PostgreSQL\nprimary metadata")]
        Redis[("Redis\nCelery broker")]
    end

    subgraph Storage["Storage layer"]
        MinIO[("MinIO S3-compatible\nlocal object storage")]
        S3[("S3-compatible\nproduction object storage")]
    end

    subgraph Workers["Background processing"]
        Worker["Celery worker\nrun execution"]
        Dispatcher["Outbox dispatcher\nFOR UPDATE SKIP LOCKED"]
        Cleanup["Cleanup and reconciliation\nabandoned uploads, stale runs"]
        OCI["Versioned OCI container\nMNE-Python, image digest pinned"]
    end

    Browser -->|HTTP| BFF
    Browser --> Viewer
    Browser --> Sensors
    BFF -->|Authenticated REST| API
    API -->|Parameterised SQL| PG
    API -->|Issue signed URLs| MinIO
    API -->|Issue signed URLs| S3
    Browser -->|Bounded signal window, signed URL| MinIO
    Browser -->|Bounded signal window, signed URL| S3
    API -->|Create run and outbox event| PG
    Dispatcher -->|Claim pending events| Redis
    Dispatcher -->|Mark dispatched| PG
    Redis -->|Task with run ID| Worker
    Worker -->|Read and write runs, artifacts| PG
    Worker -->|Read recordings, write artifacts| MinIO
    Worker -->|Read recordings, write artifacts| S3
    Worker --> OCI
    Cleanup -->|Expire sessions, reconcile objects| PG
    Cleanup -->|Delete unreferenced objects| MinIO

    classDef client fill:#e3f2fd,stroke:#1976d2
    classDef frontend fill:#e1f5fe,stroke:#0277bd
    classDef api fill:#f3e5f5,stroke:#7b1fa2
    classDef data fill:#e8f5e9,stroke:#388e3c
    classDef storage fill:#fff3e0,stroke:#f57c00
    classDef worker fill:#fce4ec,stroke:#c2185b

    class Browser,Viewer,Sensors client
    class BFF frontend
    class API,Health,Auth api
    class PG,Redis data
    class MinIO,S3 storage
    class Worker,Dispatcher,Cleanup,OCI worker
```

## 2. Request lifecycle (experiment run submission)

The browser never calls FastAPI directly: it calls the Next.js BFF route
handlers, which forward authenticated REST requests. The API creates a durable
run and its outbox event in one transaction, then returns promptly. The run
references a dataset version such as AEF-001 v3 and a pipeline version such as
`event-related-analysis` v1.2.0.

```mermaid
sequenceDiagram
    participant User as Researcher
    participant Browser as Browser (React)
    participant BFF as Next.js BFF
    participant API as FastAPI
    participant PG as PostgreSQL
    participant Redis as Redis
    participant Worker as Celery worker
    participant Runtime as OCI container
    participant Storage as Object storage

    User->>Browser: Submit experiment run
    Browser->>BFF: POST run request with Idempotency-Key
    BFF->>API: POST /api/v1/runs\nIdempotency-Key: aef001-1.2.0-a1
    API->>PG: BEGIN TRANSACTION
    API->>PG: Verify project membership and dataset version ready
    API->>PG: INSERT idempotency_keys ON CONFLICT DO NOTHING
    API->>PG: INSERT experiment_runs (queued)
    API->>PG: INSERT outbox_events (run.requested)
    API->>PG: INSERT audit_events (run.submitted)
    API->>PG: COMMIT
    API-->>BFF: 202 Accepted {run_id, status: "queued"}
    BFF-->>Browser: {run_id, status: "queued"}
    Browser-->>User: Show "Run queued"

    par Dispatcher loop
        Dispatcher->>PG: SELECT ... FOR UPDATE SKIP LOCKED WHERE status=pending
        Dispatcher->>Redis: Publish task with run_id
        Dispatcher->>PG: UPDATE outbox_events SET status=dispatched
    end

    Worker->>Redis: Reserve task
    Worker->>PG: Claim run (status=running, conditional update)
    Worker->>Storage: Read authorised AEF-001 recording files
    Worker->>Runtime: Launch image by image_digest with parameters
    Runtime->>Runtime: Read-only inputs, MNE-Python compute, write outputs
    Runtime-->>Worker: Output artifacts and manifest
    Worker->>Storage: Write artifacts to controlled location
    Worker->>PG: BEGIN TRANSACTION
    Worker->>PG: INSERT artifacts (object_key, checksum, media_type)
    Worker->>PG: UPDATE experiment_runs SET status=succeeded, finished_at
    Worker->>PG: INSERT audit_events (run.succeeded)
    Worker->>PG: COMMIT
    Worker-->>Redis: Task complete

    User->>Browser: Poll run status
    Browser->>BFF: GET run and artifacts
    BFF->>API: GET /api/v1/runs/{id} and /artifacts
    API->>PG: SELECT experiment_runs / artifacts
    API-->>BFF: {status, artifacts, manifest}
    BFF-->>Browser: Render status and outputs
    Browser-->>User: Inspect and download artifacts
```

## 3. Signal viewer data path (bounded windows and summaries)

The viewer is the central workspace. It never downloads a whole recording.
Instead the API authorises the request and returns either a bounded signal
window or a precomputed multiresolution summary, delivered through a
short-lived, single-object signed URL with explicit byte ranges. Sensor
geometry is fetched separately for the Sensor Explorer.

```mermaid
sequenceDiagram
    participant User as Researcher
    participant Viewer as Signal viewer
    participant BFF as Next.js BFF
    participant API as FastAPI
    participant PG as PostgreSQL
    participant Storage as Object storage

    User->>Viewer: Open recording AEF-001 v3, select channels
    Viewer->>BFF: GET /recordings/{id}/signals?channels&tmin&tmax&resolution
    BFF->>API: Authorised signal-window request
    API->>PG: Verify membership; resolve channel and time parameters
    alt Cached multiresolution summary hits
        API->>PG: Read summary artifact reference (checksum + config)
        API-->>BFF: Summary metadata + short-lived signed URL
    else Bounded window not cached
        API->>Storage: Sign a single-object read URL with byte range
        API-->>BFF: Bounded window descriptor + signed URL
    end
    BFF-->>Viewer: Descriptor + signed URL
    Viewer->>Storage: Fetch bounded window / summary bytes
    Storage-->>Viewer: Peak-decimated (or full) signal bytes
    Viewer-->>User: Render traces, timeline, event markers

    User->>Viewer: Open Sensor Explorer
    Viewer->>BFF: GET /recordings/{id}/sensors
    BFF->>API: Authorised sensor-geometry request
    API->>PG: Read sensor_configuration (type, frame, units)
    API-->>BFF: Sensor positions, orientations, coordinate_frame
    BFF-->>Viewer: Geometry payload
    Viewer-->>User: Render 3D sensors in declared frame

    Note over Viewer,Storage: Display transforms (scale, offset) never\nbecome analytical inputs to a run
```

## 4. Project isolation model

Project isolation is a security boundary enforced in the API, in project-scoped
SQL, and through composite foreign keys. Object-key possession is never
authorisation, and possession of a signed URL never grants listing or overwrite
rights.

```mermaid
flowchart TD
    subgraph ProjectA["Project A: Auditory evoked fields"]
        UserA1["User: alice\nRole: owner"]
        UserA2["User: bob\nRole: editor"]
        DatasetA["Dataset: AEF-001 v3\ndataset_version ready\n186.4 MB FIF"]
        PipelineA["Pipeline: event-related-analysis v1.2.0"]
        RunA["Experiment run\nstatus: succeeded"]
        ArtifactA["Artifacts + manifest\nepochs, evoked, checksums recorded"]
    end

    subgraph ProjectB["Project B: OPM movement study"]
        UserB1["User: charlie\nRole: viewer"]
        DatasetB["Dataset: OPM-007 v1\nUCL FIL OPM .bin + metadata"]
    end

    UserA1 -->|owns| ProjectA
    UserA2 -->|member| ProjectA
    ProjectA -->|contains| DatasetA
    ProjectA -->|contains| PipelineA
    DatasetA -->|input to| RunA
    PipelineA -->|executes| RunA
    RunA -->|produces| ArtifactA

    UserB1 -->|member| ProjectB
    ProjectB -->|contains| DatasetB

    classDef projA fill:#e3f2fd,stroke:#1976d2
    classDef projB fill:#fff3e0,stroke:#f57c00
    classDef cross fill:#ffebee,stroke:#c62828,stroke-dasharray: 5 5

    class UserA1,UserA2,DatasetA,PipelineA,RunA,ArtifactA projA
    class UserB1,DatasetB projB

    NoteA["All queries filtered by project_id\nfrom verified membership"]:::cross
    NoteB["Cross-project access denied\n(404 not 403)"]:::cross
```

## 5. Transactional outbox (reliable dispatch)

The API never publishes a queue message in a way that can diverge from committed
database state. Run creation and its outbox event are committed together, so an
accepted run stays visible in PostgreSQL even when Redis is briefly unavailable.

```mermaid
stateDiagram-v2
    [*] --> Pending : INSERT outbox_events\n(status=pending)
    Pending --> Dispatched : Dispatcher claims with FOR UPDATE SKIP LOCKED\nRedis publish OK\nUPDATE status=dispatched
    Pending --> Failed : Redis publish error\nbounded retry
    Failed --> Dispatched : retry succeeds
    Failed --> Exhausted : retry budget spent\nstatus=failed, visible operationally
    Dispatched --> [*]
    Exhausted --> [*] : Manual intervention

    note right of Pending
        Atomic with run creation:
        - experiment_runs (queued)
        - outbox_events (pending)
        - idempotency_keys (reserved)
        - audit_events (run.submitted)
        All in ONE transaction.
    end note

    note right of Dispatched
        Duplicate publication is safe:
        consumers are idempotent and the
        worker verifies run state before
        committing results.
    end note
```

## 6. Experiment run state machine

```mermaid
stateDiagram-v2
    [*] --> Queued : API submit\n(202 Accepted)
    Queued --> Running : Worker claims run\n(state-checked transition)
    Queued --> Cancelled : API cancel\n(idempotent)
    Running --> Succeeded : Worker validates container output\nand commits artifacts + manifest
    Running --> Failed : Worker records\nsanitised failure
    Running --> Queued : Transient failure\nbounded retry with backoff
    Running --> Failed : Recovery finds stale run\npast retry limit
    Running --> Cancelled : Cooperative cancellation
    Succeeded --> [*]
    Failed --> [*]
    Cancelled --> [*]

    note right of Running
        Terminal runs must not be
        reopened by a duplicate
        worker message; retrying
        creates a new run record.
    end note

    note right of Queued
        Idempotency key scope:
        (user_id, operation="run.submit", key)
        Reuse with a different
        request_hash is rejected.
    end note
```

## 7. Data model relationships

The canonical schema is defined by versioned migrations under
`packages/backend/app/db/migrations/`. The full column-level definition lives in
[`../06-data-model.md`](../06-data-model.md). Channels, sensor geometry, and
event arrays may be normalised or compactly stored rather than held as large
JSON blobs.

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : owns
    USERS ||--o{ PROJECT_MEMBERS : participates
    PROJECTS ||--o{ PROJECT_MEMBERS : has
    PROJECTS ||--o{ DATASETS : contains
    DATASETS ||--o{ DATASET_VERSIONS : snapshots
    DATASET_VERSIONS ||--o{ FILE_ASSETS : contains
    DATASET_VERSIONS ||--o{ RECORDINGS : describes
    RECORDINGS ||--o{ CHANNELS : inventories
    RECORDINGS ||--o{ SENSOR_CONFIGURATIONS : positions
    RECORDINGS ||--o{ EVENT_SETS : defines
    DATASETS ||--o{ UPLOAD_SESSIONS : receives
    PROJECTS ||--o{ PIPELINES : contains
    PIPELINES ||--o{ PIPELINE_VERSIONS : versions
    PIPELINE_VERSIONS ||--o{ EXPERIMENT_RUNS : executes
    DATASET_VERSIONS ||--o{ EXPERIMENT_RUNS : inputs
    EXPERIMENT_RUNS ||--o{ ARTIFACTS : produces
    USERS ||--o{ USAGE_RECORDS : accrues
    EXPERIMENT_RUNS ||--o{ USAGE_RECORDS : consumes
    USERS ||--o{ AUDIT_EVENTS : performs
    USERS ||--o{ IDEMPOTENCY_KEYS : scopes

    EXPERIMENT_RUNS {
        uuid id PK
        uuid pipeline_version_id FK
        uuid dataset_version_id FK
        uuid sensor_configuration_id FK
        text status
        jsonb parameters
        text error
        timestamptz started_at
        timestamptz finished_at
    }

    RECORDINGS {
        uuid id PK
        uuid dataset_version_id FK
        text format
        text acquisition_system
        numeric duration_s
        numeric sampling_frequency_hz
        int channel_count
    }

    SENSOR_CONFIGURATIONS {
        uuid id PK
        uuid recording_id FK
        text sensor_type
        text coordinate_frame
        jsonb geometry
    }

    PIPELINE_VERSIONS {
        uuid id PK
        uuid pipeline_id FK
        text version
        jsonb definition
        text image_digest
    }

    DATASET_VERSIONS {
        uuid id PK
        uuid dataset_id FK
        text version
        jsonb manifest
        text status
    }

    FILE_ASSETS {
        uuid id PK
        uuid dataset_version_id FK
        text object_key
        text checksum
        bigint size_bytes
        text media_type
    }

    ARTIFACTS {
        uuid id PK
        uuid run_id FK
        text object_key
        text checksum
        text media_type
        jsonb metadata
    }

    OUTBOX_EVENTS {
        uuid id PK
        text event_type
        jsonb payload
        text status
        timestamptz dispatched_at
    }
```

## 8. Deployment architecture

Initial deployment is a single environment defined by `docker-compose.yaml`.
Cloud infrastructure (GCP or AWS, Terraform, Kubernetes) is explicitly deferred
and must not be required to build, test, or run the platform.

```mermaid
flowchart TB
    subgraph Internet["Internet"]
        Users["Users and browsers"]
    end

    subgraph Compose["Docker Compose environment"]
        subgraph Edge["Edge"]
            FEC["Next.js frontend container"]
        end

        subgraph AppServices["Application services"]
            APIC["FastAPI API container"]
            WC["Celery worker container"]
            DC["Outbox dispatcher container"]
            CC["Cleanup container"]
        end

        subgraph Managed["Managed local services"]
            PGC[("PostgreSQL")]
            REDISC[("Redis")]
            MINIOC[("MinIO S3-compatible")]
        end
    end

    subgraph Optional["Optional evolution (deferred)"]
        TF["Terraform"]
        K8S["Kubernetes"]
        CLOUD["Managed PostgreSQL, Redis,\nand object storage"]
    end

    Users -->|HTTPS| FEC
    FEC -->|REST| APIC
    APIC -->|SQL| PGC
    APIC -->|Tasks and objects| REDISC
    APIC -->|Objects| MINIOC
    DC -->|SQL| PGC
    DC -->|Publish| REDISC
    REDISC -->|Tasks| WC
    WC -->|SQL| PGC
    WC -->|Objects| MINIOC
    CC -->|SQL| PGC
    CC -->|Objects| MINIOC

    K8S -.-> CLOUD

    classDef edge fill:#e1f5fe,stroke:#0277bd
    classDef app fill:#f3e5f5,stroke:#7b1fa2
    classDef managed fill:#e8f5e9,stroke:#388e3c
    classDef deferred fill:#eceff1,stroke:#607d8b,stroke-dasharray: 5 5

    class Users,FEC edge
    class APIC,WC,DC,CC app
    class PGC,REDISC,MINIOC managed
    class TF,K8S,CLOUD deferred
```

---

_Diagrams rendered with Mermaid. For interactive viewing, open in GitHub,
GitLab, or VS Code with a Mermaid extension._

## Related documents

- [MEG Lab overview](../01-overview.md)
- [MEG Lab architecture](../05-architecture.md)
- [MEG Lab data model](../06-data-model.md)
- [MEG Lab API specification](../07-api-spec.md)
- [MEG Lab deployment](../12-deployment.md)
- [MEG Lab documentation index](../README.md)
