# MEG Lab — Operations

## 1. Purpose

Operations documentation covers running MEG Lab reliably: monitoring, backups, disaster recovery, rollback, security, and teardown. The local Docker Compose stack is the source of truth; cloud evolution is optional.

## 2. Monitoring and Alerting

See [`monitoring-alerting.md`](monitoring-alerting.md).

## 3. Backup and Recovery

See [`backup-recovery.md`](backup-recovery.md).

## 4. Disaster Recovery

See [`disaster-recovery.md`](disaster-recovery.md).

## 5. Rollback Strategy

See [`rollback-strategy.md`](rollback-strategy.md).

## 6. Security

See [`security.md`](security.md).

## 7. Teardown and Resource Cleanup

## 17. Teardown and Resource Cleanup

## 17. Teardown and Resource Cleanup

Provide a documented teardown process for disposable environments.

Before deleting resources:

1. Identify the environment.
2. Confirm that it contains no data that must be retained.
3. Check for object-storage contents, database backups, and image archives.
4. Review the destruction plan.
5. Confirm that shared resources will not be removed.
6. Apply the approved teardown.
7. Verify that the intended resources were removed.
8. Check for remaining billable resources.

Typical commands:

```bash
# Stop the stack, preserving volumes
docker compose down

# Stop the stack and delete database, MinIO, and upload volumes
docker compose down --volumes

# Remove locally built images for the project
docker compose down --rmi local
```

Use `--volumes` only when the data is disposable. Do not delete backups as part of an ordinary deployment failure handler.


## 18. Cloud Deployment

See [`cloud-deployment-aws.md`](cloud-deployment-aws.md) and [`cloud-deployment-gcp.md`](cloud-deployment-gcp.md).

## 19. Troubleshooting Guide

## 19. Troubleshooting Guide

### 19.1 API cannot connect to PostgreSQL

Check:

- PostgreSQL container status and the readiness health check.
- `DATABASE_URL` format and hostname (`postgres` inside Compose, `localhost` on the host).
- Network configuration and service name resolution.
- Authentication and permissions.
- Connection-pool limits and database connection exhaustion.
- That `migrate` completed before the API started.

Do not print passwords or full connection strings into logs.

### 19.2 Worker does not process runs

Check:

- Redis availability and `CELERY_BROKER_URL`.
- Worker container status and task registration.
- Outbox dispatch status and lag (undispatched events remain in PostgreSQL).
- Queue depth and worker concurrency.
- Run state and lease information.
- Resource and time limits.
- That `MNE_WORKER_IMAGE` resolves to a digest-qualified image that can be pulled.

Inspect run and outbox records before manually resubmitting work.

### 19.3 Recording upload remains pending

Check:

- Upload-session state and expiry.
- Signed-URL expiry and expiry clock skew.
- Object existence in the MinIO bucket.
- Object size and SHA-256 checksum for every file in the set.
- Storage credentials and bucket policy (anonymous access must be disabled).
- That directory-based and companion-file sets were fully uploaded.
- Validation worker health and validation error records.

Do not manually mark a recording ready without verifying the file set.

### 19.4 Run remains queued

Check:

- Outbox dispatch status.
- Redis connectivity.
- Worker availability.
- Retry policy and attempt counts.
- Resource limits and host pressure.
- Scientific-image pull failures.

Use the documented recovery procedure rather than modifying production rows without an approved process.

### 19.5 Scientific job fails with a resource-limit reason

Check:

- `RUN_CPU_LIMIT`, `RUN_MEMORY_LIMIT_MB`, `RUN_DISK_LIMIT_MB`, and `RUN_TIMEOUT_SECONDS`.
- The size and channel count of the input recording against the configured limits.
- Host pressure and worker concurrency.

Adjust limits deliberately and document the change; do not raise them unboundedly.

### 19.6 Frontend cannot reach the API

Check:

- `NEXT_PUBLIC_API_BASE_URL` (browser) and `API_INTERNAL_BASE_URL` (server-side).
- That the frontend build-time API URL matches the deployment origin.
- `API_CORS_ORIGINS`.
- The API health check and container status.

Remember that `NEXT_PUBLIC_*` values are embedded at build time and require a rebuild to change.

### 19.7 Migration service fails

Check:

- Database reachability and credentials.
- For a rejected modified migration, that the checksum in the migrations table matches the file.
- Migration SQL for syntax errors against the target PostgreSQL version.
- That the migration is transactional and repeatable in a clean environment.

### 19.8 Deployment succeeds but the application fails

Check:

- Environment variables and `APP_ENV`-dependent validation.
- Whether any placeholder secret remains, which should block production start-up.
- Health-check configuration.
- API base URLs.
- Migration status.
- Storage bucket and credentials.
- Worker, broker, and scientific-image connectivity.
- Frontend/API contract compatibility.


## 20. Definition of Done

## 20. Definition of Done

Deployment is complete when:

1. The application can be run locally using documented instructions and `docker compose up`.
2. CI validates the codebase (backend, frontend, scientific-image, end-to-end, and security jobs).
3. The environment is defined reproducibly in `docker-compose.yaml` and `.env.example`.
4. Production secrets are not stored in source control, images, or logs, and no placeholder values remain.
5. Frontend, API, worker, and dispatcher run as separate services with correct dependencies.
6. The versioned MNE-Python scientific image is built, pinned by digest, and referenced through `MNE_WORKER_IMAGE`.
7. Database and object-storage access are restricted to the internal network.
8. Migrations run as a controlled, one-shot step before the API and worker start.
9. Liveness and readiness endpoints work, and the asynchronous pipeline is observable.
10. Logs and basic operational metrics are available, with rotation configured.
11. Backups, retention, and deletion semantics are documented and restoration has been tested.
12. Self-hosting costs and teardown procedures are documented.
13. A deployed synthetic-data workflow passes smoke tests.
14. Rollback of application and scientific images is documented and backward-compatible migrations are preferred.
15. Cloud providers, Terraform, and Kubernetes remain optional future evolutions, not requirements.
16. Known operational and scientific limitations are clearly documented.
