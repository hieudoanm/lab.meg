# Rollback Strategy

## 16. Rollback Strategy

## 16. Rollback Strategy

Application rollback and data rollback are separate operations.

### 16.1 Application rollback

Keep previous immutable application images available. If a deployment fails, restore the previous compatible image tag in `docker-compose.prod.yaml` and run smoke tests. Because migrations run as a separate one-shot step, a rollback does not silently re-run schema changes.

### 16.2 Database rollback

Do not automatically reverse a migration without checking its effects. Prefer backward-compatible migrations that allow the application to be rolled back without losing data. For destructive changes, define a specific recovery plan before deployment.

### 16.3 Worker compatibility

During a rollout, old and new workers may temporarily coexist. Ensure that:

- Task payloads remain compatible during the transition.
- Algorithm and pipeline versions are explicit, and `image_digest` is recorded.
- Result and manifest schemas are versioned.
- Workers cannot overwrite results from incompatible executions.
- Queued jobs remain processable after deployment.

### 16.4 Scientific image rollback

Rolling back the scientific image means selecting a previously recorded digest. Because pipeline versions reference the digest they executed, rolling back the worker image does not change the provenance of already-completed runs. Never mutate or re-tag a scientific image in place; always record a new digest.


