# 3. Authentication and Project Context

## 3. Authentication and Project Context

**Priority:** P0 (FR-001, FR-015)

### Description
Users authenticate and work within a project. Project context determines which datasets, pipelines, runs, artifacts, annotations they may access.

### User-visible behaviour
- Clear sign-in experience.
- After auth, see available projects.
- Select project or return to last valid selection.
- Active project displayed consistently in navigation/header.
- Session expiry prompts recovery.
- If no memberships, explain next steps (create project or open sample).

### Inputs
- Credentials/OIDC callback.
- Active project selection.
- Project identifier in API requests.

### Outputs
- Authenticated session.
- Verified project context.
- Project-scoped resource collections.
- Signed-out state clearing cached project data.

### Behaviour
1. Authenticate via managed OIDC provider.
2. Retrieve identity and project_members roles.
3. Select project with verified membership.
4. Load project-scoped resources.
5. Include project context in API requests.
6. Independently verify membership/permissions server-side for every request.

### States
- `anonymous`: only public sample reachable.
- `authenticated-no-project`: signed in but no memberships.
- `active`: signed in with verified project context.
- `expired`: session invalid; resources hidden with recovery prompt.

### Edge cases
- Invalid/expired session.
- Removed membership or role downgrade.
- Project archived/deleted while open.
- Multiple projects.
- Altered project identifier in API request.
- Identity provider unavailable.
- Concurrent sign-out in another tab.

### Acceptance conditions
- Cannot access private resources without auth.
- Changing active project changes visible scope.
- Direct API cannot bypass membership checks.
- Cross-project reads/writes rejected even if storage key known.
- Auth errors handled without exposing sensitive details.

