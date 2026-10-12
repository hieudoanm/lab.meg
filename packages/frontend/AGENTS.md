# MEG Lab Frontend Guidelines

## Scope and architecture

- This package is the Next.js App Router frontend for the MEG Lab workspace.
- Keep route files focused on composition and route parameters. Put interactive
  page behavior in adjacent `*-view.tsx` client components.
- Use the existing layers:
  - `src/app/` for routes and page-level composition.
  - `src/components/` for reusable UI primitives and layout.
  - `src/lib/api/` for typed API clients and domain operations.
  - `src/server/api/` for server-side tRPC/BFF routers.
  - `src/lib/` for session, formatting, status, and other shared helpers.
- Preserve the project-scoped tenancy model. Never infer access from a route
  parameter or hide an authorization failure with mock data.

## Next.js and React conventions

- Read the relevant Next.js guidance under
  `node_modules/next/dist/docs/` before changing framework behavior.
- Treat route `params` as asynchronous where the current Next.js version
  requires it.
- Add `'use client'` only to components that need browser state, event
  handlers, or client-side data fetching.
- Prefer TanStack Query for client-server data loading and mutations. Use
  stable query keys, invalidate related queries after mutations, and expose
  loading, empty, error, and permission states.
- Keep browser-only APIs out of server components and server-only session
  helpers out of client bundles.

## API and data conventions

- Reuse exports from `src/lib/api/index.ts` and the types in
  `src/lib/api/types.ts`; do not duplicate endpoint calls or response models.
- Route API requests through the existing `ApiClient`/BFF boundary. Do not
  place bearer tokens, storage credentials, or signed URLs in persistent
  browser state.
- Keep mock behavior and real API behavior contract-compatible. When adding a
  field or endpoint, update the typed client, mock data, and relevant UI
  states together.
- For uploads, compute and send the declared checksum and size through the
  existing signed-upload flow. Do not buffer large recordings in application
  state or proxy them through unrelated UI routes.

## UI, accessibility, and styling

- Follow the existing dark, low-glare design system and reuse atoms,
  molecules, layout components, status badges, fields, and toast helpers
  before creating new primitives.
- Use the project’s Tailwind/daisyUI class conventions and Prettier formatting;
  avoid ad hoc inline styles or a second design-token system.
- Every interactive control needs an accessible name. Forms need associated
  labels, validation text, and an observable success/error state.
- Do not communicate status by color alone. Use text, labels, or status
  semantics alongside badges and icons.
- Preserve responsive behavior and keyboard navigation when modifying tables,
  dialogs, navigation, viewers, or upload controls.

## Testing and validation

- Add or update Vitest/Testing Library coverage for behavior that does not
  require a browser.
- Add Playwright coverage in `e2e/` for route guards, navigation, permission
  boundaries, and important end-to-end workflows.
- The focused checks are:

  ```bash
  pnpm lint
  pnpm format:check
  pnpm typecheck
  pnpm test
  pnpm test:e2e --grep "<focused test>"
  ```

- Run `pnpm build` when changing routes, Next.js configuration, environment
  handling, or server/client boundaries.
- Generated directories such as `.next/`, `src-tauri/target/`, and
  `src-tauri/gen/` are build output; do not hand-edit or format their contents.
