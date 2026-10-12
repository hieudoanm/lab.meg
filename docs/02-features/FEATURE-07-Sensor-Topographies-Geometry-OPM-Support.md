# 9. Sensor Topographies, Geometry, OPM Support

## 9. Sensor Topographies, Geometry, OPM Support

**Priority:** P1 (FR-020, FR-022, FR-023)

### Sensor geometry
Inspect positions/orientations, coordinate frame, units. Handle missing geometry. OPM geometry may vary.

### Sensor Explorer
Visualise sensor layout by type, bad channels, coordinate frame; link to channels/viewer.

### Sensor topographies
Plot sensor-level measurements when geometry available; indicate missing positions.

### OPM support
Identify OPM recordings; expose compatible workflows; validate required metadata; document assumptions; record sensor type.

### Acceptance conditions
- Geometry recorded with sensor configuration.
- Topographies require valid geometry; graceful fallback if missing.
- OPM workflows validated and distinguished from SQUID.

