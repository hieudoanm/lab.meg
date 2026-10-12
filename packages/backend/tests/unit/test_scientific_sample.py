"""Unit tests for the synthetic sample recording generator."""

from __future__ import annotations

import json

from app.scientific import sample


def test_sample_recording_and_metadata(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(sample, "N_MAG", 2)
    monkeypatch.setattr(sample, "N_GRAD", 2)
    monkeypatch.setattr(sample, "DURATION_S", 0.2)
    monkeypatch.setattr(sample, "STIMULUS_INTERVAL_S", 0.1)

    raw = sample.build_sample_raw()
    assert raw.info["nchan"] == 13
    assert raw.info["sfreq"] == sample.SFREQ
    assert raw.info["description"].startswith("MEG Lab sample")

    metadata = sample.build_sample_metadata(raw)
    assert metadata.n_channels == 13
    assert metadata.duration_s == 0.2
    assert len(metadata.channels) == 13
    assert metadata.sensor_config is not None
    assert len(metadata.sensor_config.sensors) == 4
    assert len(metadata.event_sets[0].events) == 2
    assert metadata.channels[-1].type == "stim"

    destination = tmp_path / "nested" / "sample.fif"
    sample.save_sample_fif(raw, destination)
    assert destination.exists()
    manifest = json.loads(sample.sample_manifest_json())
    assert manifest["license"] == "CC0-1.0"
