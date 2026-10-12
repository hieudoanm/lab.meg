# Backup and Recovery

## 13. Backups and Recovery

## 13. Backups and Recovery

Define a recovery policy for every durable data store. Both durable stores live in named volumes and must be backed up independently.

### 13.1 PostgreSQL

Document:

- Backup frequency (`pg_dump` on a schedule, for example nightly).
- Retention (for example 7 daily plus 4 weekly copies).
- Recovery procedure.
- Who can restore.
- Recovery point objective (RPO).
- Recovery time objective (RTO).

Example logical backup:

```bash
docker compose exec -T postgres \
  pg_dump -U meg-lab -d meg-lab -Fc > backups/meg-lab-$(date +%F).dump
```

A database dump is not a substitute for object-storage backups.

### 13.2 Object storage

Document:

- Raw-recording and artifact retention.
- Bucket versioning or object-lock behaviour where enabled.
- Deletion policy and the relationship to `file_assets`, `dataset_versions`, and `artifacts` rows.
- Recovery options.
- How database metadata maps to stored object keys.

For the self-hosted demo, back up the `meg-lab-minio` volume or mirror the bucket with `mc mirror` to a second location. Keep database dumps and object mirrors consistent so a restore does not reference missing recordings.

### 13.3 Retention and deletion semantics

Deletion must have explicit, documented semantics across:

- Source recordings (`file_assets` and their object keys).
- Dataset versions and derived signals.
- Run artifacts, plots, and manifests.
- Cached and derived viewer summaries.
- Backups.

Deletion of a project or dataset is recorded in the audit trail and must not silently leave orphaned objects or dangling database rows. A reconciliation job removes unreferenced objects and repairs references after a partial failure, and abandoned upload sessions are cleaned up on a schedule.

### 13.4 Recovery testing

A backup is not proven useful until restoration has been tested.

- Document the restore procedure.
- Perform a test restore in a disposable environment.
- Verify that representative metadata and synthetic recording references remain consistent.
- Record any limitations.


