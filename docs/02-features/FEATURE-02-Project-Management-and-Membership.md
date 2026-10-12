# 4. Project Management and Membership

## 4. Project Management and Membership

**Priority:** P0 (FR-002, FR-015)

### Description
Projects organise datasets and analyses. Membership is project-scoped.

### User-visible behaviour
Project list shows: name, description, dataset count, status (active/archived), visibility, last updated, available actions. Users can search, paginate, create, inspect, edit, archive per permissions.

### Create project
Required: name. Optional: description. Prevent duplicate submissions with validation.

### Project details
Overview, dataset list, pipeline list, experiment history, provenance, role-appropriate actions.

### Membership management (P1)
Owners manage: list members/roles, invite members, accept invitations, change
roles, remove members, and preserve the last-owner invariant. The implemented
roles are `owner`, `editor`, and `viewer`; there is no `researcher` role in the
current API. Membership changes generate audit events.

### States
- `active`: editable per role.
- `archived`: read-only by default.
- `deleting`: locked.
- `deleted`: resources removed per documented semantics.

### Acceptance conditions
- Only authorised roles can create/rename/archive/delete.
- Membership changes authorised server-side and audited.
- Archiving preserves data and makes read-only.
- Deletion follows documented semantics for source/derived/cached/backup data.

