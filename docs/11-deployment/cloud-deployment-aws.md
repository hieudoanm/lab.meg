# Cloud Deployment (AWS)

## 18. Optional Cloud Evolution

Cloud deployment is optional and must never be required to build, test, or run MEG Lab. The local and self-hosted Compose stack is the source of truth. If demand justifies managed infrastructure, adopt it in the following order, preserving the isolation properties established locally.

- **Managed PostgreSQL:** replace the `postgres` service with a managed instance reachable over private networking. Keep migrations as a one-shot step and never expose the database publicly.
- **Managed Redis:** replace the `redis` service with a managed Redis-compatible endpoint for the Celery broker.
- **Managed S3-compatible storage:** replace MinIO with a managed object store. Keep the bucket private by default, use least-privilege credentials, and continue issuing short-lived signed URLs only after an authorisation check.
- **Container worker pool:** run the API, worker, dispatcher, and scientific image as a container pool. Start with a simple container service and defer Kubernetes.

Isolation properties to preserve in any cloud evolution:

- Private by default; no public bucket access.
- Signed, short-lived URLs for all object access.
- Restricted worker egress, blocking internal services and cloud metadata endpoints.
- No cross-project access through the API, storage, or worker mounts.
- Per-run CPU, memory, disk, and wall-clock limits enforced by the platform.
- Immutable scientific image digests recorded per pipeline version.

When cloud infrastructure is introduced, manage it with Terraform, keep state remote and locked, review plans before applying, and document costs and teardown. Kubernetes and a microservice decomposition remain deferred.

