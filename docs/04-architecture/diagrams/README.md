# MEG Lab Architecture and Data Flow Diagrams

These diagrams describe the implemented application architecture and data
flows. They complement the architecture notes in
[`../04-architecture/04-architecture.md`](../04-architecture/04-architecture.md), the data model in
[`../05-data-model/05-data-model.md`](../05-data-model/05-data-model.md), and the API contract in
[`../06-api-specification/06-api-specification.md`](../06-api-specification/06-api-specification.md).

The through-line for every diagram is the product promise: go from a raw MEG
recording to an interpretable, reproducible neural signal analysis in the cloud.
Interactive web requests are separated from scientific computation, and the API
never streams a whole recording through its own memory to satisfy the Signal
Viewer.

| Diagram                                                     | Purpose                                                                                          | Source doc mapping                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| [Architecture](architecture.md)                             | Logical application components, runtime processes, boundaries, and stores                        | [`../04-architecture/04-architecture.md`](../04-architecture/04-architecture.md) |
| [Comprehensive architecture](architecture-comprehensive.md) | System, request lifecycle, isolation, outbox, run state machine, data model, deployment          | [`../04-architecture/04-architecture.md`](../04-architecture/04-architecture.md) |
| [System data flow](system-data-flow.md)                     | Metadata flow vs data flow across user, frontend, API, persistence, storage, and worker          | [`../04-architecture/04-architecture.md`](../04-architecture/04-architecture.md) |
| [Dataset upload and validation](dataset-upload.md)          | Resumable upload session, finalisation, checksum verification, and dataset version state         | [`../04-architecture/04-architecture.md`](../04-architecture/04-architecture.md) |
| [Experiment pipeline](experiment-pipeline.md)               | Run lifecycle, idempotent submission, transactional outbox, worker execution, container, artifacts | [`../04-architecture/04-architecture.md`](../04-architecture/04-architecture.md) |
| [End-to-end sequence](end-to-end-sequence.md)               | Upload, validate, view, run, inspect, and export across the whole workflow                       | [`../00-overview.md`](../00-overview.md)  |
| [CI/CD pipeline](cicd-pipeline.md)                          | GitHub Actions validation, container builds, security scan, optional prototype deployment        | [`../11-deployment/11-deployment.md`](../11-deployment/11-deployment.md) |

Update these diagrams when the corresponding implementation or data contract
changes. The upload diagram describes the direct-to-object-storage, resumable
upload with a signed URL; finalisation and validation remain server-side, and a
directory-based format such as CTF `.ds` is only complete when every required
companion file is present. The experiment pipeline diagram shows the versioned
MNE-Python OCI container runtime used for reproducible computation, pinned by
`image_digest`.

## Related documents

- [MEG Lab overview](../00-overview.md)
- [MEG Lab architecture](../04-architecture/04-architecture.md)
- [MEG Lab data model](../05-data-model/05-data-model.md)
- [MEG Lab API specification](../06-api-specification/06-api-specification.md)
- [MEG Lab deployment](../11-deployment/11-deployment.md)
- [MEG Lab documentation index](../README.md)
