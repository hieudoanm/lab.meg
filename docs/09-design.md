# MEG Lab — Design System and User Interface

## 1. Purpose

This document defines MEG Lab's information architecture, visual identity, page layouts, interaction patterns, accessibility requirements, and responsive behaviour.

The interface is designed to feel like a professional scientific workbench: precise, calm, data-oriented, and trustworthy. It must present dense, highly visual electrophysiological data (multichannel MEG time-series, sensor geometry, and derived analyses) clearly and legibly without distraction, while keeping every supporting workflow—projects, datasets (recordings), pipelines, runs, experiments, and settings—consistent.

The design must support the workflows defined in:

- `README.md` (product specification) — vision, functional requirements (FR-001..FR-027), user journeys, and non-functional requirements.
- The shipped design prototype at `docs/design/html/` (01-landing through 15-settings) and its rendered assets in `docs/design/images/`.
- The canonical MEG product context: SQUID-MEG + OPM-MEG; MNE-Python backbone; formats FIF, CTF `.ds`, KIT, UCL FIL OPM `.bin`, BIDS.

The canonical stack is Next.js (App Router) + React + TypeScript, with TailwindCSS and the daisyUI 5 component layer, React Query for server state, and Plotly.js/WebGL (or custom canvas) for multichannel signal traces and Three.js/vtk.js for sensor geometry visualisation.

An architectural principle applies: the Signal Viewer, Sensor Explorer, and pipeline runner operate on the same project, dataset/version, and artifact system. Display transformations (scaling, zoom, pan, filtering preview state, saved view state) are never recorded as analytical inputs to a run.

## 2. Design Principles

### 2.1 Clarity before decoration

Every screen should make three things obvious:
1. Where am I?
2. What data am I looking at?
3. What can I do next?

Avoid decorative components that compete with electrophysiological data. Time-series traces, sensor layouts, and derived plots are primary content; chrome and scaffolding must recede.

### 2.2 One project and artifact system

Projects, datasets (recordings), dataset versions, signal viewer, sensor explorer, pipelines, pipeline versions, runs, artifacts, comparisons, experiments, and shares all operate on the same project-scoped records. Navigation must never imply the viewer, notebooks, or pipeline runner manages files separately.

### 2.3 Data density with readable hierarchy

Researchers inspect multichannel signals, sensor geometry, events, metadata, logs, tables, and run states efficiently. Use compact layouts for scientific information while preserving readable text, explicit labels, sufficient spacing, and units.

### 2.4 Scientific precision

Always display units, coordinate frames, orientation/geometry provenance, timestamps, checksums/SHA-256, software environment (e.g. MNE-Python version), pipeline version/image digest, and input references where relevant. Sensor coordinates/orientations must state their declared coordinate frame. Do not imply that display-only transforms (amplitude scaling, windowing, zoom) are the stored/analytical representation.

### 2.5 Honest system feedback

Every asynchronous operation must communicate its state truthfully. Do not show success before the server confirms it. A run must never be marked `succeeded` before its artifacts and experiment manifest are persisted. Duplicate submissions are prevented and idempotency is respected.

### 2.6 Consistent interactions

Use the same patterns for navigation, forms, status chips, dialogs, tables, overlays, logs, errors, confirmations, and toggles throughout the application.

### 2.7 Security-aware presentation

Do not expose resources, identifiers, object keys, internal paths, or actions the current user is not authorised to access. Frontend visibility is usability, not a substitute for server-side authorisation. Treat object-key possession as non-authorisation.

### 2.8 MEG-first, sensor-technology aware

The interface must support SQUID-MEG and OPM-MEG in the same workspace. Where workflows differ (sensor geometry, channel groupings, auxiliary channels), present those differences explicitly with clear labels and coordinate-frame context. Never force OPM recordings into SQUID-only assumptions.

## 3. Visual Direction

### Design concept
**Scientific workstation for electrophysiology.**

The interface resembles a focused, dark-room instrument rather than a consumer application. A dark theme reduces glare, lets multichannel traces and sensor geometry dominate, and improves perceptual separation for coloured channel traces, bad-channel markers, event markers, and overlays. The application ships both a `lab-light` and a `lab-dark` theme with a user toggle: `lab-light` is the default and `lab-dark` is preferred when the user's system is set to dark.

Characteristics:
- Deep neutral backgrounds with clear surface separation (lab-dark); the lab-light theme mirrors the same structure on light surfaces.
- High-contrast, slightly cool text.
- Restrained blue accent for actions and focus.
- Subtle one-pixel borders; minimal shadows.
- Monospaced typography for IDs, hashes/checksums, timestamps, logs, sample indices, frequencies, and coordinate values.
- Consistent channel-type colouring (grad/mag/bad) and semantic status colours that never rely on hue alone.
- A near-black plotting canvas for signal traces and geometry views.

Avoid excessive gradients, glassmorphism, neon glows, animated backgrounds, and oversized marketing headings inside the authenticated application.

### 3.1 Duality: marketing and application
Landing/explore is public and may be slightly more expressive. The authenticated application is dense, quiet, and task-oriented. Both share the same token system and component layer.

## 4. Design Tokens

The visual system is implemented through reusable design tokens and the daisyUI theme layer. All values below reflect the shipped HTML prototype.

### 4.1 Colour palette

The palette is defined once and rendered through two themes: `lab-light` (the
default) and `lab-dark`. Both are declared in `globals.css` as daisyUI themes and
as `--color-*` semantic tokens (kebab-case); components reference the token,
never a literal, so the same markup adapts to the active theme.

| Token             | Light       | Dark      | Usage                          |
| ----------------- | ----------- | --------- | ------------------------------ |
| `background`      | `#F6F8FB`   | `#0B0F14` | Application background         |
| `surface`         | `#FFFFFF`   | `#121821` | Cards, tables, panels, nav     |
| `surface-muted`   | `#EEF2F7`   | `#1A2230` | Secondary surfaces, inputs     |
| `surface-raised`  | `#E2E8F0`   | `#212B3A` | Menus, popovers, dropdowns     |
| `overlay-scrim`   | `#17203366` | `#05080B` | Modal and drawer backdrop      |
| `border`          | `#DCE3EC`   | `#263244` | Dividers and outlines          |
| `border-strong`   | `#C3CDD9`   | `#35455C` | Emphasised borders             |
| `text-primary`    | `#172033`   | `#E6EDF5` | Main text                      |
| `text-secondary`  | `#5B6578`   | `#9BA9BC` | Supporting text                |
| `text-muted`      | `#8A94A6`   | `#6B7A90` | Disabled / de-emphasised text  |
| `accent`          | `#4059C7`   | `#4C8DFF` | Primary actions and links      |
| `accent-hover`    | `#3146A5`   | `#6BA1FF` | Hover state                    |
| `accent-muted`    | `#E8ECFB`   | `#1C3355` | Accent tint backgrounds        |
| `success`         | `#18794E`   | `#3FB950` | Success, `succeeded`, ready    |
| `success-muted`   | `#E1F4EC`   | `#16301F` | Success tint backgrounds       |
| `warning`         | `#986500`   | `#D9A441` | Warnings, `approaching_limit`  |
| `warning-muted`   | `#FBF0DE`   | `#33290F` | Warning tint backgrounds       |
| `danger`          | `#B42318`   | `#F0554D` | Errors, destructive actions    |
| `danger-muted`    | `#FBEAE9`   | `#3A1C1A` | Error tint backgrounds         |
| `info`            | `#175CD3`   | `#58A6FF` | Informational feedback         |
| `info-muted`      | `#E7EEFC`   | `#16283F` | Info tint backgrounds          |
| `neutral-state`   | `#8A94A6`   | `#5B6578` | Pending / queued / cancelled   |
| `focus-ring`      | `#4059C7`   | `#7FB2FF` | Keyboard focus outline         |

Status colours are always accompanied by text or another non-colour indicator.

### 4.2 Viewer/Signal-specific tokens

The viewer and trace rendering use the shared channel trace palette plus the
canvas token. They are kept separate from the component layer so viewer
rendering never depends on component-layer colours.

| Token     | Light     | Dark      | Usage                                   |
| --------- | --------- | --------- | --------------------------------------- |
| `canvas`  | `#EEF2F7` | `#05080B` | Signal trace canvas / plotting surface  |
| `trace-1` | `#4059C7` | `#4C8DFF` | Gradiometer traces (channel type)       |
| `trace-2` | `#175CD3` | `#58A6FF` | Magnetometer traces (channel type)      |
| `trace-3` | `#18794E` | `#3FB950` | Valid/good channel highlights           |
| `trace-4` | `#986500` | `#D9A441` | Event markers on the time axis          |
| `trace-5` | `#B42318` | `#F0554D` | Bad channels/segments and overlays      |
| `trace-6` | `#7C3AED` | `#B07CFF` | Additional channel-type accent          |

Viewport separators and grid lines use `border`; inactive crosshairs use
`text-secondary` and the active crosshair uses `accent`.

### 4.3 Typography

Sans-serif stack: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
Monospace stack: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`

Type scale (as shipped):

| Token | Size / line height | Weight | Usage |
|---|---|---|---|
| `text-display` | 32 / 40 px | 700 | Landing hero (public) |
| `text-h1` | 28 / 36 px | 650–700 | Page title |
| `text-h2` | 22 / 30 px | 600 | Major section heading |
| `text-h3` | 18 / 26 px | 600 | Card/panel heading |
| `text-body` | 14 / 22 px | 400 | Default body text |
| `text-body-strong` | 14 / 22 px | 600 | Emphasised body/labels |
| `text-sm` | 13 / 20 px | 400 | Dense tables, metadata |
| `text-caption` | 12 / 16 px | 500 | Captions, badges, overlines |
| `text-mono` | 13 / 20 px | 400 | Hashes, IDs, timestamps, logs, coordinates, frequencies |
| `text-readout` | 13 / 18 px | 500 | Signal/sensor readouts |

### 4.4 Spacing, radii, elevation, focus, motion

Spacing uses 4 px base scale: `space-1` 4, `space-2` 8, `space-3` 12, `space-4` 16, `space-5` 20, `space-6` 24, `space-8` 32, `space-10` 40, `space-12` 48, `space-16` 64.
Radii: `radius-sm` 4 px (inputs/badges), `radius-md` 6 px (buttons/chips), `radius-lg` 8 px (cards/panels/tables), `radius-xl` 12 px (dialogs/drawers), `radius-pill` 999 px (pills/chips/toggles).
Elevation via subtle 1px borders; shadows reserved for overlays. Light: `elevation-1` `0 1px 2px rgba(23,32,51,0.06)`, `elevation-2` `0 8px 24px rgba(23,32,51,0.12)`, `elevation-3` `0 16px 48px rgba(23,32,51,0.16)`. Dark: `0 1px 2px rgba(0,0,0,0.4)`, `0 8px 24px rgba(0,0,0,0.45)`, `0 16px 48px rgba(0,0,0,0.55)`.
Focus ring: `focus-ring` (`#4059C7` light, `#7FB2FF` dark), 2 px solid, 2 px offset, always on `:focus-visible`.
Motion: fast 120 ms, normal 200 ms, slow 320 ms, `ease-standard` `cubic-bezier(0.2,0,0,1)`.

### 4.5 Component layer (daisyUI 5)

Implemented as two daisyUI v5 themes declared in `globals.css`: `lab-light` (default, `color-scheme: light`) and `lab-dark` (`prefersdark: true`, `color-scheme: dark`). The prototype uses daisyUI component classes (`card`, `table`, `menu`, `checkbox`, `toggle`, `badge`, `btn`, `input`, `select`, `textarea`, `file-input`, `progress`, `alert`, `dropdown`, `drawer`, `steps`, `loading`). Viewer canvas and signal trace rendering are custom (SVG/canvas/WebGL).

The theme is switched at runtime by setting the `data-theme` attribute on the root element. A `ThemeProvider`/`ThemeToggle` pair (in `components/atoms`) exposes the active theme and a toggle; the choice is persisted in `localStorage` under the key `lab-theme`, and with no stored value the page follows the user's `prefers-color-scheme`. An inline boot script applies the stored theme before first paint.

Mapping from design tokens (§4.1) to daisyUI theme variables (identical for both themes):

| daisyUI variable       | MEG Lab token    |
| ---------------------- | ---------------- |
| `--color-base-100`     | `surface`        |
| `--color-base-200`     | `surface-muted`  |
| `--color-base-300`     | `border`         |
| `--color-base-content` | `text-primary`   |
| `--color-primary`      | `accent`         |
| `--color-secondary`    | `text-secondary` |
| `--color-neutral`      | `text-primary` (light) / `surface-raised` (dark) |
| `--color-info`         | `info`           |
| `--color-success`      | `success`        |
| `--color-warning`      | `warning`        |
| `--color-error`        | `danger`         |

## 5. Application Layout

### 5.1 Desktop layout
Persistent left sidebar (60 wide) + sticky 56 px top bar + main content area.

### 5.2 Sidebar (shipped)
Fixed width `w-60` with brand “MEG Lab”, navigation items in order: Home, Projects, Datasets, Signal Viewer, Sensor Explorer, Pipelines, Notebooks, Explore, Settings. Active nav uses `bg-accent-muted font-medium text-text-primary`. Icons are single-colour, muted; keyboard focus uses the shared focus ring. Notebooks is present in navigation (placeholder) consistent with P2 deferred visibility policy in practice.

### 5.3 Top bar (shipped)
Includes project selector with privacy chip (e.g. `private`), ⌘K search, notifications (badge dot), and avatar/user menu. Breadcrumbs appear on deeper pages (dataset/run detail). Switching active project refreshes project-scoped content safely.

### 5.4 Content area
Full width for dense views (Signal Viewer, tables, logs, comparisons); constrained width for forms (Settings). Wide tables scroll within their region.

## 6. Information Architecture

Primary navigation: Home, Projects, Datasets, Signal Viewer, Sensor Explorer, Pipelines, Notebooks, Explore, Settings.

Route structure (logical):
```
/
├── (marketing) / landing, sign-in
├── app
│   ├── home (Dashboard)
│   ├── projects
│   │   ├── new
│   │   └── [projectId] (overview, datasets, pipelines, runs, experiments, settings)
│   ├── datasets / [datasetId] (detail, versions)
│   ├── viewer (Signal Viewer) / [datasetVersionId]
│   ├── sensor-explorer / [datasetVersionId]
│   ├── pipelines / [pipelineId] (versions)
│   ├── runs / [runId] (detail)
│   ├── explore
│   └── settings (account, security, compute & storage, usage, project)
└── not-found
```

Navigation rules: protected routes require auth; resource routes require server-verified project access; breadcrumbs use human-readable names; deep links preserve destination; unknown/unauthorised handled without leaking existence.

## 7. Landing / Marketing
Hero with product name and promise; sample/workspace entry; capability blocks (View signals, Compute, Share/reproducibility). Read-only sample permitted; write actions prompt sign-in. No clinical/diagnostic claims.

## 8. Authentication
Centered card, sign-in/register/password reset with labels, inline validation, show/hide password, progress state, non-enumerating auth errors, session-expired handling, OIDC provider support if configured.

## 9. Dashboard (Home) — shipped prototype
Summary row: Projects, Recordings, Storage used, Runs this week (with breakdowns). Recent activity sections (e.g. recent runs/datasets), shortcuts (Upload recording, New project). States: first-time (empty guidance), loading skeletons, partial/error with independent recovery.

## 10. Projects and Project Detail
Projects list: search, create, table/cards (name, counts, visibility, status, last updated). Project detail: header with name/visibility/status, tabs (Overview, Datasets, Pipelines, Runs, Experiments, Settings). Membership (P1) with last-owner invariant.

## 11. Datasets (Recordings), Upload and Detail

### 11.1 Upload (wizard)
Multi-step: dataset details, file selection (supports MEG formats), metadata, upload/validation progress, outcome. Clearly shows filename/size/format and safe rejections. Resumable transfers; progress reflects real transfer/validation; `ready` only on server confirmation.

### 11.2 Dataset detail
Header with name/version, status (ready/validating/rejected/failed), primary actions (Open Signal Viewer, Run analysis). Metadata: format (FIF/CTF `.ds`/KIT/UCL FIL OPM `.bin`/BIDS), checksum (copyable), sampling frequency (Hz), duration (s), channel counts by type (SQUID: grad/mag/aux; OPM: OPM/aux), coordinate frame, orientation, validation status and timestamps. Versions and file assets tables with scoped downloads.

## 12. Signal Viewer — shipped prototype (core workspace)

Desktop layout (prototype): left sidebar controls + main plotting canvas area with header/status. Signal Viewer is the primary scientific screen.

### 12.1 Channel selection and grouping
Channel browser groups by type: Gradiometers, Magnetometers, Reference/aux (and OPM sensors when present). Channel list shows checkboxes grouped mag/grad/bad with type labels (grad/mag) and bad channels flagged with `bad` badge and danger styling. Search channel available. Supports selecting/hiding multiple traces.

### 12.2 Filtering
Filtering controls include Low-pass (e.g. 40 Hz/80 Hz/160 Hz/No filter), High-pass (e.g. 0.1 Hz/1 Hz/No filter), and Notch (50 Hz toggle). Settings are user-facing display/preview controls; analytical filter parameters used in runs are configured in the pipeline/run form (documented in run workflow).

### 12.3 Amplitude scaling
Scale control: “Amplitude” slider (prototype shows 0–100, value 62) with numeric readout (e.g. `100 µV`). This is display-only scaling.

### 12.4 Time navigation and visible window
Viewer includes time-range/navigation controls (visible window width, current time position, scroll) consistent with dense multichannel plotting. Interactions remain responsive via bounded window requests.

### 12.5 Signal-trace rendering (implementation spec)
Multichannel traces rendered on a canvas background (`#05080B`). Channel-type colouring: gradiometer traces `#B07CFF`, magnetometer traces `#42a5f5`, bad channel/segment `#F0554D`. Event markers rendered as vertical lines/markers using `#D9A441`. BAD segment overlay rendered for marked bad intervals. Rendering supports linked navigation and respects channel selection.

### 12.6 Sensor Explorer (reference)
Separate Sensor Explorer screen (`09-sensor-explorer.html`) provides sensor layout visualisation (conceptually 102 mag + 204 grad rings/positions in SQUID layout) in declared coordinate frame with orientation display. Sensor geometry view uses Three.js/vtk.js conventions.

### 12.7 View-state save
Named view states (viewport/time window, channel selection, amplitude scaling, filters, crosshair/markers) persistable per dataset/project. Clearly stated as display preference, not analytical input.

### 12.8 States
Loading (skeleton viewports), ready (interactive), partial (overlays still loading), error (clear retry, preserve state). Handles validating dataset, 4D/time selection, anisotropic geometry, and out-of-bounds ranges with explicit explanations.

## 13. Pipelines List and Versions
Pipelines list (cards/table): name, latest version, status (draft/published/deprecated), run count, last updated. Pipeline version detail shows immutable `pipeline_versions`, `image_digest` (shortened/copyable), changelog, and parameter schema. Published versions immutable; edits create new versions. Deprecated cannot be selected for new runs.

## 14. New Run Form and Run Detail — shipped prototype

### 14.1 Run detail (prototype)
Header: run id (`run_9f3c1b7a`), pipeline `spectral-analysis · v0.9.3`, status chip `succeeded` (success indicator), dataset `AEF-001 · v3` (FIF, 306 SQUID, 1000 Hz). Actions: Rerun, Download manifest.

### 14.2 Status timeline
Vertical/horizontal timeline of `queued → running → succeeded/failed/cancelled` with timestamps at each transition (prototype shows three states with check marks and timestamps).

### 14.3 Log viewer (critical component)
Logs panel with structured lines. **Log row grid layout:** `88px 56px 1fr` for timestamps/level/message (implemented in CSS: `.log-line { display:grid; grid-template-columns:88px 56px 1fr; gap:12px; }`). Monospaced text, alternating/hover background, scrollable (`max-h-[420px]`), Copy and Download actions. Logs must not contain credentials, signed URLs, or raw voxel/signal bulk dumps.

### 14.4 Metrics and artifacts
Metrics panel (duration, peak memory, exit code, environment: python/mne versions). Artifacts table: outputs with media type/size/checksum (sha256), Download and Open in viewer actions where applicable. Manifest is copyable/downloadable with full provenance.

### 14.5 Status presentation
States: queued (neutral), running (progress), succeeded (success), failed (danger + safe reason), cancelled (neutral). No false completion percentage unless backend provides meaningful progress.

## 15. Compare (Input vs Derived)
Side-by-side comparison with linked crosshairs when comparable (same coordinate frame/dimensions/spacing), labels (input/derived), optional difference/overlay. Non-comparable states explained explicitly.

## 16. Experiment History
Filterable table (pipeline, dataset, status, date range, submitter), columns include run id (shortened/copyable), pipeline/version, dataset version, status, duration, submitted time, actions. Row links to manifest; rerun rules explicit.

## 17. Explore (Public Samples)
Public sample projects/datasets with licence/citation prominently displayed; read-only viewer; sign-in required for write actions.

## 18. Settings — shipped prototype
Workspace settings with secondary nav: Account, Security, Compute & storage, Usage, API keys/notifications as applicable. Storage/compute shows quota states (within/approaching/limit_reached) with numeric figures and bars where relevant.

## 19. Forms, Dialogs, Feedback
Labels for all fields, inline validation with corrective guidance, disabled/progress during submission, non-blocking toasts plus page-level explanations, destructive actions require confirmation, quota/permission feedback explicit.

## 20. Responsive Behaviour
Desktop-first (1200 px+). Sidebar collapses to icon rail on smaller screens and drawer on mobile; tables scroll regionally; dense scientific views prioritise usability.

## 21. Page Inventory (shipped HTML)
`docs/design/html/`: 01-landing, 02-sign-in, 03-dashboard, 04-projects, 05-project-detail, 06-dataset-upload, 07-dataset-detail, 08-viewer, 09-sensor-explorer, 10-pipelines, 11-run-new, 12-run-detail, 13-experiments, 14-explore, 15-settings. Rendered PNGs in `docs/design/images/`.

## 22. Component Specs (real implementation)
- Stat cards: surface + 1px border, value large, supporting text.
- Status chips: ready/succeeded/validating/running/failed/cancelled with coloured dot and semantic text.
- Data tables: headers uppercase tracked, borders use `#263244`, dense rows.
- Steppers (upload wizard): clear stages with progress.
- Channel checkboxes grouped mag/grad/bad; bad channels visually distinct.
- Scale sliders (amplitude).
- Signal-trace rendering: SVG/canvas with grad `#B07CFF`, mag `#42a5f5`, bad `#F0554D`, event markers, BAD segment overlay.
- Sensor layout SVG/concept (102 mag + 204 grad rings) for SQUID; OPM geometry adapts when present.
- Log viewer: grid `88px 56px 1fr` (timestamps/level/message), monospace, scrollable, copy/download.
- Pull-to-refresh (conceptual where applicable), toggles in settings.
- Accessibility: focus rings `#7FB2FF`, contrast considerations, semantic labels throughout.

## 23. States and Accessibility
States: loading, empty, error, disabled, busy (running), partial. Accessibility: keyboard navigation, visible focus rings, ARIA labels for interactive controls, non-colour indicators for status, readable contrast, explicit coordinate/frame labels, and accessible readouts. Do not remove focus outlines without an equally visible replacement.

## 24. Design Rules Summary

- Preserve scientific precision: always show coordinate frames, units, sample rates, checksums, and software versions where relevant.
- Keep the UI quiet and data-dense: traces and sensor geometry are primary content; chrome must recede.
- Never conflate display transforms with analytical inputs: viewer scaling, windowing, and zoom are presentation only.
- Security and authorisation first in presentation: never reveal resources, object keys, or actions the current user is not authorised for.
- Sensor-technology aware: SQUID and OPM geometry differ and must be labelled explicitly rather than hidden behind shared assumptions.
- The implementation matches the shipped prototype tokens, layout, and components exactly (see §21 page inventory and §22 component specs).
