# Definition of Project Completion

## 16. Definition of Project Completion

The MVP is complete when:

1. A user can sign in and access a project they are a member of.
2. A user can create, rename, archive, and delete a project according to their role.
3. A user can upload or open a supported MEG recording and see its validation status and acquisition metadata.
4. An invalid or incomplete recording set is rejected with a safe, actionable message, and no raw signal arrays are stored in the database.
5. The Signal Viewer renders multiple channels against a navigable timeline with event markers that stay aligned to the declared time base.
6. An OPM recording flows through metadata validation and a compatible, documented preprocessing template with its assumptions recorded.
7. Sensor geometry is visualised in a declared coordinate frame and degrades gracefully when absent.
8. A versioned pipeline can be submitted as a background run and progresses through `queued`, `running`, `succeeded`, `failed`, or `cancelled`.
9. Each successful run produces validated artifacts, checksums, and a machine-readable experiment manifest.
10. Epoching, evoked responses, and spectral analysis produce traceable results that can be rerun from their recorded configuration.
11. Comparisons, export, scoped sharing, and the public sample project function within their documented scope.
12. Quotas, usage records, and audit events are enforced and recorded, and health endpoints operate without leaking secrets.
13. Project and role permissions are enforced with automated negative tests for cross-project access.
14. Every primary screen implements the required loading, empty, error, partial-success, disabled, and permission-denied states.
15. Automated checks pass in CI, including scientific-correctness and end-to-end tests.
16. A self-hosted Docker Compose deployment can be reproduced from documented instructions and passes smoke tests.
17. The README explains setup, architecture, testing, limitations, and the deferred cloud evolution.

A feature is not complete merely because its primary happy path works. Validation, failure handling, permission checks, and observability must also be addressed.

