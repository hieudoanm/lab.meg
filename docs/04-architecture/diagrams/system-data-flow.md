# System Data Flow

This Level 0/1 data-flow view separates **metadata flow** from **data flow** and
identifies the main actors, processes, data stores, and external transports.
Project membership and resource access are verified by the API; the browser is
not an authority for access. The browser talks to the Python API only through
the Next.js BFF, which forwards authenticated REST requests.

- **Metadata flow** covers users, projects, membership, datasets, dataset
  versions, recordings, channels, sensor configurations, event sets, pipelines,
  run state, artifacts, and audit events. It flows through the API into
  PostgreSQL.
- **Data flow** covers raw MEG recordings (FIF, CTF `.ds`, KIT, UCL FIL OPM
  `.bin`, BIDS) and derived artifacts (epochs, evoked responses, spectra,
  topographies, plots, manifests). It flows directly between the browser and
  private object storage through short-lived signed URLs, and between the worker
  and object storage during runs.

```mermaid
flowchart LR
    User[Researcher / developer / viewer / owner]

    subgraph Client["Client boundary"]
        Browser[Browser]
        Web[Next.js web application\nBFF route handlers]
        Viewer[Signal viewer\nbounded windows + summaries]
        Sensors[Sensor Explorer\nsensor geometry]
    end

    subgraph App["Application trust boundary"]
        API[FastAPI API]
        Identity[Authenticate and verify project membership]
        Services[Application services]
        Ingest[Ingestion and MEG validation\nMNE format adapters]
        Dispatcher[Outbox dispatcher]
        Worker[Celery run worker]
        Runtime[Versioned OCI container\nMNE-Python]
    end

    subgraph Stores["Persistence and transport"]
        DB[(PostgreSQL\nusers, projects, members,\ndatasets, versions, recordings,\nchannels, sensors, events,\npipelines, runs, artifacts,\noutbox, audit)]
        Objects[(Private S3-compatible storage\nFIF, CTF .ds, KIT, OPM .bin,\nsummaries, and artifacts)]
        Redis[(Redis\nTask transport only)]
    end

    User -->|Credentials, metadata, upload,\nrun requests, view inputs| Browser
    Browser -->|UI and session requests| Web
    Web -->|Authenticated HTTPS API requests| API
    API --> Identity
    Identity -->|Verified user and project context| Services

    Services -->|Metadata: scoped SQL reads and writes| DB
    Services -->|Metadata: register file set, artifacts,\nissue signed URLs| Objects

    Services -->|Data: persist run and outbox event in one transaction| DB
    API -->|Data access: authorise and issue short-lived signed URL| Objects
    Objects -->|Data: bounded signal-window bytes,\nmultiresolution summaries| Viewer
    Objects -->|Data: sensor geometry bytes| Sensors

    Dispatcher -->|Metadata: claim pending events| DB
    Dispatcher -->|Metadata: publish run identifier| Redis
    Redis -->|Metadata: run task identifier| Worker
    Worker -->|Metadata: claim run, persist status\nand artifacts| DB
    Worker -->|Data: read source recordings,\nwrite artifacts| Objects
    Worker --> Runtime
    Runtime -->|Data: computed outputs, manifest| Worker

    Worker --> Ingest
    Ingest -->|Metadata: validated channels, events,\nsensor configuration| Worker

    DB -->|Metadata: run status and persisted artifacts| API
    API -->|Authorised response| Web
    Web -->|Status, metadata, and artifact links| Browser
```

## Component legend

| Component            | Boundary          | Carries                                                             |
| -------------------- | ----------------- | ------------------------------------------------------------------- |
| Browser + Next.js BFF | Client            | Session requests; never authoritative for access                    |
| Signal viewer        | Client            | Bounded windows and summaries fetched via signed URL                |
| Sensor Explorer      | Client            | Sensor positions, orientations, and declared coordinate frame       |
| FastAPI API          | Application       | Authenticated metadata operations; bounded signal reads            |
| Ingestion and validation | Application   | MNE format adapters that extract channels, events, sensor geometry  |
| Outbox dispatcher    | Application       | Reliable publication of committed run events to Redis               |
| Celery worker        | Application       | Claims runs, launches the versioned container, persists outcomes    |
| OCI container        | Runtime           | MNE-Python computation with read-only inputs and bounded resources  |
| PostgreSQL           | Persistence       | Authoritative metadata and run lifecycle                            |
| Object storage       | Persistence       | Raw recordings, summaries, and derived artifacts                    |
| Redis                | Transport         | Task notifications only, never authoritative run state              |

## Flow explanation

Metadata moves exclusively through the API: authorisation, project scoping, and
parameter validation happen before any SQL statement executes. Data moves around
the API rather than through it. Recording bytes and derived artifacts stay in
private storage and are referenced by object key, checksum, and validated
metadata. The viewer receives only a bounded signal window or a precomputed
multiresolution summary, and sensor geometry is fetched as a separate, small
payload. Redis carries task notifications only and is never the authoritative
source of run state; the API can always read run status from PostgreSQL.
Scientific computation happens only inside the versioned MNE-Python container
launched by the worker, never inside a request handler.

## Related documents

- [MEG Lab overview](../00-overview.md)
- [MEG Lab architecture](../04-architecture/04-architecture.md)
- [MEG Lab data model](../05-data-model/05-data-model.md)
- [MEG Lab API specification](../06-api-specification/06-api-specification.md)
- [MEG Lab deployment](../11-deployment/11-deployment.md)
- [MEG Lab documentation index](../README.md)
