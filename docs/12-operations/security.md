# Security

## 15. Production Readiness Checklist

## 15. Production Readiness Checklist

### Application

- [ ] Production build succeeds for frontend, API, worker, and dispatcher.
- [ ] Images are immutable and tagged by commit SHA or digest.
- [ ] Authentication is enabled and `AUTH_MODE` is not `development`.
- [ ] No `.env.example` placeholder value (`replace-me`, `insecure-...`) remains in production.
- [ ] Project isolation tests pass.
- [ ] Upload and processing limits are configured.
- [ ] Worker retries, time limits, and run leases are configured.
- [ ] Secrets are managed securely and not baked into images.
- [ ] Health and readiness endpoints work.

### Database and storage

- [ ] Migrations are reviewed and applied through the one-shot `migrate` service.
- [ ] Database access is restricted to the internal network.
- [ ] Backups are enabled as required and a restore has been tested.
- [ ] Object storage is private (anonymous access disabled).
- [ ] Storage credentials are distinct from the development defaults.
- [ ] Retention and cleanup policies are defined.

### Scientific runtime

- [ ] The MNE worker image is pinned by digest and referenced through `MNE_WORKER_IMAGE`.
- [ ] The pinned MNE-Python and library versions are recorded.
- [ ] Pipeline versions store the digest they executed.
- [ ] Numerical regression tests pass inside the pinned image.

### Operations

- [ ] Structured logs are available with rotation configured.
- [ ] Critical metrics are monitored.
- [ ] Alerts are actionable.
- [ ] Deployment smoke tests pass.
- [ ] Cost controls and disk alerts are configured.
- [ ] Rollback and recovery limitations are documented.
- [ ] TLS terminates in front of the frontend and API.

### Portfolio demonstration

- [ ] Only synthetic or appropriately licensed public data is used.
- [ ] Demo credentials are not privileged production credentials.
- [ ] The README explains limitations.
- [ ] The primary workflow works in the deployed environment.
- [ ] A reviewer can understand the architecture and run the project locally.


