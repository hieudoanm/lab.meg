# Dataset Upload and Validation Data Flow

MEG upload is resumable and direct-to-object-storage. A recording may be a
single file (FIF, KIT) or a directory or file set with companion files (CTF
`.ds`, UCL FIL OPM `.bin` plus metadata, BIDS). Session creation, finalisation,
and validation are API operations executed through the Next.js BFF. The browser
uploads file bytes directly to short-lived, scoped signed URLs rather than
streaming them through application memory. Finalisation verifies every object,
then validation is scheduled asynchronously; the validation worker parses the
header with MNE (`mne.io`) and persists metadata, channel, sensor, and event
summaries plus preview artifacts.

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web App
    participant A as FastAPI
    participant DB as PostgreSQL
    participant S as Object Storage
    participant V as Validation Worker

    U->>W: Select FIF / report / CTF .ds folder,\nor OPM .bin with companion metadata
    W->>A: POST /api/v1/projects/{id}/datasets (create upload session)
    A->>DB: Create pending upload session record\n(file set, expected sizes, optional checksums, expiry)
    A-->>W: Short-lived scoped upload instructions (session ID, per-object URLs)
    W-->>U: Prompt to continue upload
    U->>W: Continue upload of recording bytes
    W->>S: Write each object to its private key\n(resumable, chunked, signed URL, checksummed)
    S-->>W: Parts uploaded / object complete
    W->>A: POST /api/v1/datasets/{id}/complete (finalise)
    A->>S: Inspect objects and verify size and checksums
    A->>DB: Record file_assets rows and draft dataset_version\n(mark session completed)
    A->>V: Schedule validation via outbox event
    V->>S: Read recording header via MNE (mne.io.read_raw_*)\nand required companion files
    V->>V: Parse format, sampling frequency, duration,\nchannels, units, bad channels, events,\nsensor type and coordinate frame\ncheck limits and decompression bounds
    alt Validation succeeds
        V->>S: Write preview and PSD summary artifacts
        V->>DB: Persist recording metadata, channel/sensor/event\nsummaries, manifest; set dataset_version ready;\nrecord audit event
        V-->>A: Validation success
        A-->>W: Dataset version ready
    else Validation fails (unsupported format, missing companion file, checksum mismatch)
        V->>DB: Persist diagnostic manifest\nset dataset_version failed
        V-->>A: Validation failure
        A-->>W: Safe structured validation error
    end
    W->>A: Poll dataset version status
    A-->>W: Ready or failed
    W-->>U: Show validated recording metadata or error
```

## Supported formats and required file sets

| Format        | Shape                        | Reader                        | Required companion files                       |
| ------------- | ---------------------------- | ----------------------------- | ---------------------------------------------- |
| FIF           | Single file (`.fif`)         | `mne.io.read_raw_fif`         | `_events.fif`, `_meg.json` where present       |
| CTF `.ds`     | Directory (`.ds/`)           | `mne.io.read_raw_ctf`         | The full directory file set                    |
| KIT           | Single file (`.sqd`/`.con`)  | `mne.io.read_raw_kit`         | Marker files where required                    |
| UCL FIL OPM   | Single file (`.bin`)         | FIL reader with metadata      | Companion acquisition / sensor metadata        |
| BIDS          | Directory structure          | MNE-BIDS                      | `channels.tsv`, `events.tsv`, `coordsystem.json` |

## Upload invariants

- The user must be authorised to upload into the target project via
  `project_members`.
- Storage is private; the object key is a server-generated path, not a public
  URL, and possession of a key is not authorisation.
- The server validates the file set independently of browser-side checks.
- The dataset version is not `ready` before validation succeeds.
- Finalisation confirms every declared object exists, matches its declared size,
  and has the expected SHA-256 checksum (or the server computes one).
- A directory-based format (CTF `.ds`) is only complete when all required
  companion files are present; an incomplete set is rejected.
- Finalisation is idempotent or protected against duplicate requests using
  `idempotency_keys`.
- Interrupted uploads remain resumable and abandoned sessions are reconciled by
  a cleanup task.
- Upload sessions and signed URLs expire.
- File-size, total-recording-size, channel-count, and parser limits are
  enforced, including decompression bounds.
- Validation is read-only; it never mutates the source recording.

## Flow explanation

Metadata moves through the API: session creation, finalisation, and status
polling are all authenticated, project-scoped operations. Recording bytes move
directly between the browser and private object storage through per-object,
short-lived signed URLs, so the API never buffers a large FIF or a CTF `.ds`
directory file set in memory. Validation is dispatched through the outbox and
performed by the worker, which reads the header with MNE, records channel,
sensor, and event summaries, writes preview and PSD summary artifacts, and only
then marks the dataset version `ready`. If validation fails, the dataset version
is marked `failed` with a structured, user-safe error and a diagnostic manifest.

## Related documents

- [MEG Lab overview](../01-overview.md)
- [MEG Lab architecture](../05-architecture.md)
- [MEG Lab data model](../06-data-model.md)
- [MEG Lab API specification](../07-api-spec.md)
- [MEG Lab deployment](../12-deployment.md)
- [MEG Lab documentation index](../README.md)
