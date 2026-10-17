# Authentication and Session Model

## 9. Authentication & Session Model

- Managed OIDC-compatible identity provider.
- Browser: HttpOnly session cookie held by BFF (`meg-lab_session`).
- Machine/CLI: `Authorization: Bearer <token>`.
- Short-lived tokens; secure cookie attributes in prod (HttpOnly, Secure, SameSite, path/domain scoped).
- Logout invalidates session/token as appropriate.

