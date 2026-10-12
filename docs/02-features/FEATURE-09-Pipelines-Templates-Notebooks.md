# 11. Pipelines, Templates, Notebooks (concept)

## 11. Pipelines, Templates, Notebooks (concept)

**Priority:** P1 (FR-024), P2 (advanced)

### Pipeline templates
Template gallery with documented IO/params; versioned; container image digest recorded.

### Create/version
Immutable versions; changes create new version; scoped access.

### Publish
Mark as template with visibility; no private data exposure.

### Custom analysis (P2)
Hosted Python envs with controlled data access, save env spec/code/logs/artifacts, package as reusable template.

### Acceptance conditions
- Every run references specific pipeline version + image digest.
- Published templates specify visibility; private data not exposed.

