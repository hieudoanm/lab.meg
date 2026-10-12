# End-to-End Workflow Sequence

This sequence follows the full journey from sign-in through upload, validation,
viewing, run submission, artifact inspection, and export. Protected API requests
authenticate the user and verify `project_members` role before accessing
project-scoped records. Upload bytes move directly to object storage through a
signed URL; run computation is asynchronous.

`Web` denotes the Next.js application as a whole: the browser calls BFF route
handlers, which the server executes, reads the HttpOnly session cookie, resolves
the active project, and forwards the request to FastAPI. The browser never calls
FastAPI directly.

```mermaid
sequenceDiagram
    autonumber
    actor Researcher
    participant Web as Next.js app (browser + BFF)
    participant API as FastAPI
    participant DB as PostgreSQL
    participant Storage as Private object storage
    participant Dispatcher as Outbox dispatcher
    participant Redis as Redis broker
    participant Worker as Celery worker
    participant Viewer as Signal viewer

    Researcher->>Web: Sign in
    Web->>API: Authenticate session
    Note over API: Verify identity and establish session
    API-->>Web: Session established
    Web-->>Researcher: Signed in

    Researcher->>Web: Open project "Auditory evoked fields"
    Web->>API: GET /api/v1/projects/{id}
    API->>DB: Verify membership; read project
    API-->>Web: Project metadata
    Web-->>Researcher: Project workspace

    Researcher->>Web: Upload AEF-001 FIF recording and companions
    Web->>API: POST /api/v1/projects/{id}/datasets (upload session)
    API->>DB: Insert pending upload session, expected sizes/checksums
    API-->>Web: Session ID and scoped signed upload URLs
    Web->>Storage: Upload AEF-001_meg.fif, _events.fif, _meg.json\n(resumable, chunked, checksummed)
    Storage-->>Web: Upload complete
    Web->>API: POST /api/v1/datasets/{id}/complete
    Note over API: Verify sizes and checksums; record file_assets; schedule validation
    API->>DB: Create draft dataset version and file assets
    API->>DB: Create outbox event for validation
    API-->>Web: Validation scheduled

    Dispatcher->>DB: Claim validation outbox event
    Dispatcher->>Redis: Publish validation task
    Redis-->>Worker: Deliver validation task
    Worker->>Storage: Read FIF header via MNE
    Worker->>Worker: Parse channels (MEG 0422 grad, MEG 0112 mag,\nbad MEG 0131), events (STI 014, STI 015),\nsensor configuration (SQUID, 1000 Hz)
    Worker->>Storage: Write preview and PSD summary artifacts
    Worker->>DB: Persist metadata; set dataset version AEF-001 v3 ready
    Note over Researcher,Worker: Recording is now dataset AEF-001 v3 ready

    Researcher->>Web: Open Signal Viewer
    Web->>API: GET recording, channels, events, and signed signal URL
    API->>DB: Verify membership; resolve channel and time parameters
    API-->>Web: Channels, event sets, bounded window, signed URL
    Web->>Storage: Fetch bounded window / multiresolution summary
    Viewer->>Viewer: Render channels, timeline, and event markers
    Viewer-->>Researcher: Explore channels 0422/0112 and STI 014 events

    Researcher->>Web: Configure event-related-analysis v1.2.0\n(event STI 014, tmin -0.2, tmax 0.5, baseline, low-pass 40 Hz)
    Researcher->>Web: Submit run
    Web->>API: POST /api/v1/runs with Idempotency-Key
    Note over API: Verify role, ready dataset version, and parameter schema
    API->>DB: Begin transaction
    API->>DB: Reserve idempotency key; insert queued run and outbox event; audit
    API-->>Web: 202 Accepted with run_id
    Web-->>Researcher: Run queued

    loop Dispatcher runs periodically
        Dispatcher->>DB: Claim pending run outbox event
        Dispatcher->>Redis: Publish task with run ID
        Dispatcher->>DB: Mark event dispatched
    end

    Redis-->>Worker: Deliver run task
    Worker->>DB: Claim run (queued -> running)
    Worker->>Storage: Read authorised AEF-001 v3 recording files
    Worker->>Worker: Launch versioned OCI container by image_digest\n(MNE-Python) with read-only inputs and limits
    Note over Worker: Scientific MEG processing runs here,\nnever in a request handler
    Worker->>Storage: Write artifacts (epochs, evoked) and manifest
    alt Run succeeds
        Worker->>DB: Commit artifacts, usage, and succeeded state
        Worker->>Storage: Finalise artifact objects
        Worker->>DB: Mark run succeeded with manifest reference
    else Retryable failure
        Worker->>DB: Requeue run with backoff; create new outbox event
    else Terminal failure
        Worker->>DB: Mark run failed with sanitised error and audit event
    end

    loop Frontend polls run status
        Web->>API: GET /api/v1/runs/{id}
        API->>DB: Read project-scoped run state
        API-->>Web: Current status and logs reference
    end

    opt Run succeeded
        Web->>API: GET /api/v1/runs/{id}/artifacts
        API->>DB: List artifacts and manifest
        API-->>Web: Artifact metadata and download URLs
        Researcher->>Web: Inspect epochs and evoked response in viewer
        API-->>Web: Signed URL for artifact
        Web->>Storage: Fetch artifact bytes
        Viewer-->>Researcher: Compare evoked response with raw signal
        Researcher->>Web: Export results and experiment manifest
        Web->>API: POST artifact download (authorised)
        API-->>Web: Short-lived signed URL
        Web-->>Researcher: Download artifacts and manifest
        Researcher->>Web: Create scoped share link
        Web->>API: POST /api/v1/projects/{id}/shares
        API->>DB: Record scoped, expiring share
        API-->>Web: Share link with explicit access policy
        Web-->>Researcher: Share reproducible experiment
    end
```

An identical run request using the same idempotency key replays the original run
instead of creating a second one. Redis delivers task notifications only;
PostgreSQL remains authoritative for run state, artifacts, and provenance.
Display transforms applied in the Signal Viewer are never recorded as scientific
input to a run.

## Related documents

- [MEG Lab overview](../00-overview.md)
- [MEG Lab architecture](../04-architecture/04-architecture.md)
- [MEG Lab data model](../05-data-model/05-data-model.md)
- [MEG Lab API specification](../06-api-specification/06-api-specification.md)
- [MEG Lab deployment](../11-deployment/11-deployment.md)
- [MEG Lab documentation index](../README.md)
