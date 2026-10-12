"""Unit tests for the MNE recording adapter."""

from __future__ import annotations

import mne
import numpy as np

from app.scientific.mne_adapter import MneRecordingAdapter, _detect_format


def test_mne_metadata_and_bounded_window(tmp_path) -> None:
    info = mne.create_info(["MEG 0001", "STI 014"], 20, ["mag", "stim"])
    data = np.zeros((2, 100))
    data[0] = np.arange(100)
    data[1, 20:22] = 4
    raw = mne.io.RawArray(data, info, verbose="error")
    raw.info["bads"] = ["MEG 0001"]
    raw.info["description"] = "MNE test"
    raw.save(tmp_path / "recording.fif", overwrite=True, verbose="error")
    adapter = MneRecordingAdapter(tmp_path, "squid")
    metadata = adapter.metadata()
    assert metadata.name == "MNE test"
    assert metadata.format == "fif"
    assert metadata.bad_channel_names == ["MEG 0001"]
    assert metadata.channels[0].status == "bad"
    assert len(metadata.event_sets) == 1
    window = adapter.read_window(-1, 2, ["MEG 0001"], 1, 100)
    assert window.data[0][0] == 0
    assert window.truncated is False
    assert adapter.open_raw() is adapter.open_raw()
    adapter.close()


def test_mne_missing_file_and_format_detection(tmp_path) -> None:
    adapter = MneRecordingAdapter(tmp_path, "squid")
    try:
        adapter.metadata()
    except FileNotFoundError as error:
        assert "supported" in str(error)
    assert _detect_format(type("Raw", (), {"filenames": ("/x/test.ds",)})()) == "ctf"
    assert _detect_format(type("Raw", (), {"filenames": ("/x/test.sqd",)})()) == "kit"
    assert _detect_format(type("Raw", (), {"filenames": ()})()) == "fif"
