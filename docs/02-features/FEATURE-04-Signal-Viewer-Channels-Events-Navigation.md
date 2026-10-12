# 6. Signal Viewer, Channels, Events, Navigation

## 6. Signal Viewer, Channels, Events, Navigation

**Priority:** P0 (FR-006, FR-007, FR-008, FR-009)

### Viewer
Responsive multichannel time-series plotting with channel selection, grouping (mag/grad/other/aux), search, bad-channel indicators.

### Navigation
Pan/zoom time axis, jump to time/events, show visible window and duration. Bounded requests.

### Events
Event markers aligned to recording time base, filter by type, click to navigate, event sets listed with counts.

### Display controls
Amplitude scaling, show/hide channels/groups, reset view. Display transforms distinct from analysis.

### Data retrieval
Request bounded windows/multiresolution summaries; no full recording download for viewport rendering.

### States
- `loading`, `ready`, `partial`, `error`

### Edge cases
- Long recordings, many channels, missing events, bad channels, network interruptions.
- Access revocation mid-view.

### Acceptance conditions
- Can view selected channels, navigate timeline, inspect events, adjust scaling without loading entire recording.
- Bad channels clearly marked.
- Bounded responses enforced server-side.
- The shipped viewer exposes time-series traces, event markers, channel
  metadata, and sensor-geometry availability. Multiplanar anatomical rendering
  is not implemented.

