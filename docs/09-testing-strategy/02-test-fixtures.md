# Test Fixtures

## 7. Synthetic MEG Fixtures

Generate deterministic fixtures (no large committed binaries). Include:
1. Tiny multichannel synthetic (few channels, short duration) with known events.
2. Known landmarks for time/sample checks.
3. Anisotropic sampling/frequency edge cases.
4. Oblique/varied geometry for round-trips.
5. Bad-channel markers and event sets.
6. `.fif`-style minimal synthetic (via MNE-Python) and compressed variants.
7. Malformed/truncated headers/structures.
8. Decompression-bomb-like small crafted cases (resource-bounded).
9. SQUID-like channel groups (grad/mag/aux).
10. OPM-like minimal geometry/metadata (positions/orientations, coordinate frame).
11. Event timing edge cases (overlaps, boundaries).

Fixture generator API: `make_meg_recording(...)` with fixed seed or no randomness. Document expected values alongside definitions.

