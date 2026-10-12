"""Unit tests for the UCL FIL OPM binary adapter."""

from __future__ import annotations

import json

import numpy as np

from app.scientific.opm_bin_adapter import OpmBinAdapter


def _write_opm(tmp_path):
    header = {
        "name": "OPM test",
        "sampling_frequency_hz": 10,
        "n_channels": 2,
        "coordinate_frame": "opm",
        "channels": [
            {"name": "OPM001", "unit": "T", "position_mm": [1, 2, 3], "status": "bad"},
            {"name": "AUX001", "unit": "V", "sensor_type": "aux"},
        ],
        "event_sets": [{"name": "stim", "events": [{"sample": 5, "value": 3, "code": "go"}]}],
        "movement_tracking": True,
        "movement_ref": "motion.json",
    }
    (tmp_path / "recording.json").write_text(json.dumps(header))
    np.arange(20, dtype=np.float32).tofile(tmp_path / "recording.bin")


def test_opm_metadata_window_and_close(tmp_path) -> None:
    _write_opm(tmp_path)
    adapter = OpmBinAdapter(tmp_path, "opm")
    metadata = adapter.metadata()
    assert metadata.name == "OPM test"
    assert metadata.duration_s == 1
    assert metadata.bad_channel_names == ["OPM001"]
    assert metadata.channels[0].unit == "tesla"
    assert metadata.channels[1].unit == "volt"
    assert metadata.event_sets[0].events[0].time_s == 0.5
    assert metadata.sensor_config is not None
    assert metadata.sensor_config.time_varying
    window = adapter.read_window(-1, 1, ["OPM001", "AUX001"], 1, 100)
    assert window.data[0][:3] == [0.0, 2.0, 4.0]
    assert window.effective_sampling_frequency_hz == 10
    adapter.close()
    assert adapter._samples is None


def test_opm_missing_assets_raise(tmp_path) -> None:
    adapter = OpmBinAdapter(tmp_path, "opm")
    try:
        adapter.metadata()
    except FileNotFoundError as error:
        assert "sidecar" in str(error)
    (tmp_path / "header.json").write_text(json.dumps({"n_channels": 1}))
    try:
        adapter.metadata()
    except FileNotFoundError as error:
        assert "payload" in str(error)
