# Frontend

## 4. Frontend

### 4.1 Next.js + React + TypeScript
- App Router, strict TypeScript (`strict: true`, no `any` without documented exception).
- Client components only where interactivity required (Signal Viewer, Sensor Explorer, forms).
- Keep MEG visualisation code in client components (Plotly.js/Three.js depend on browser APIs).
- Type API resources explicitly; model run states as finite union (`queued`, `running`, `succeeded`, `failed`, `cancelled`).

### 4.2 Styling (Tailwind CSS + daisyUI 5)
Two themes (`lab-light` default, `lab-dark`) with tokens aligned with the shipped prototype:
- `lab-light` background `#F6F8FB`, surface `#FFFFFF`, accent `#4059C7`
- `lab-dark` background `#0B0F14`, surface `#121821`, accent `#4C8DFF`

Requirements: centralise tokens, prefer daisyUI primitives, accessible focus states/contrast, avoid arbitrary values, reusable components.

### 4.3 Data Fetching (React Query)
- Typed API client centralising auth (Bearer/session), error normalisation, cancellation.
- Treat runs, artifacts, bounded signal windows as server state.
- Revalidate on mutations; paginate/bound requests (never fetch entire recordings client-side).
- Signals endpoint: request bounded windows with explicit `tmin/tmax` and resolution/decimation.

### 4.4 Signal Rendering (Plotly.js)
Primary: Plotly.js for multichannel time-series. Decision factors: up to ~300 channels, ~1000 Hz, smooth panning over minutes, channel selection/hiding/groups, event overlays. 
Evaluation: custom WebGL/canvas renderer if memory/overdraw becomes limiting for dense views; prefer multiresolution summaries + bounded windows by design (API returns bounded windows, never whole recording).

### 4.5 Sensor Visualisation (Three.js)
Primary: Three.js for 3D helmet/head model + sensor coils/positions/orientations with coordinate frame awareness (head/world). 
Secondary: evaluate vtk.js for alternate geometry workflows. SVG fallback for Sensor Explorer overview (simplified layout). Geometry consumed from `GET /api/v1/recordings/{id}/sensors`.

### 4.6 Frontend Conventions
- Arrow functions for all declarations.
- Prefer `const`; no `var`.
- Named exports for utilities/components; default exports for page/layouts as required.
- Colocate tests in `__tests__/`.
- Keep domain logic separate from visual components.

