"""Unit tests for the in-process scientific pipeline executor."""

from __future__ import annotations

from types import SimpleNamespace
from typing import cast

import mne
import numpy as np
import pytest

from app.scientific.adapters import EventMeta, EventSetMeta, RecordingAdapter, RecordingMeta
from app.scientific.pipeline import (
    PipelineExecutionError,
    _apply_epochs,
    _apply_filter,
    _apply_psd,
    _find_stim_events,
    _summarize_drop_log,
    execute_definition,
)


def _raw() -> mne.io.RawArray:
    info = mne.create_info(["MEG 0001", "STI 014"], 100.0, ["mag", "stim"])
    data = np.zeros((2, 3000))
    data[0] = np.sin(np.linspace(0, 20, 3000))
    data[1, 100:105] = 1
    data[1, 200:205] = 2
    return mne.io.RawArray(data, info, verbose="error")


def _meta() -> RecordingMeta:
    return RecordingMeta(
        name="test",
        format="fif",
        acquisition_system="squid",
        duration_s=3,
        sampling_frequency_hz=100,
        n_channels=2,
        coordinate_frame="head",
        event_sets=[
            EventSetMeta(
                name="stim",
                source="test",
                sample_convention="onset",
                events=[
                    EventMeta(sample=100, time_s=1, value=1, code="one"),
                    EventMeta(sample=200, time_s=2, value=2, code="two"),
                ],
            )
        ],
    )


class Adapter:
    def __init__(self, raw: mne.io.RawArray) -> None:
        self.raw = raw
        self.closed = False

    def open_raw(self) -> mne.io.RawArray:
        return self.raw

    def close(self) -> None:
        self.closed = True


def test_pipeline_validation_helpers_and_filter() -> None:
    raw = _raw()
    filtered = _apply_filter(raw, {"l_freq_hz": 1, "h_freq_hz": 20})
    assert filtered is raw
    assert _summarize_drop_log([(), ("IGNORED",), ("IGNORED", "BAD")]) == {
        "IGNORED": 2,
        "BAD": 1,
    }
    assert _find_stim_events(_meta())[0].tolist() == [[100, 0, 1], [200, 0, 2]]
    assert _find_stim_events(_meta())[1] == {"one": 1, "two": 2}
    with pytest.raises(PipelineExecutionError, match="missing required"):
        _apply_filter(raw, {})
    with pytest.raises(PipelineExecutionError, match="invalid bandpass"):
        _apply_filter(raw, {"l_freq_hz": 30, "h_freq_hz": 20})
    with pytest.raises(PipelineExecutionError, match="no event sets"):
        _find_stim_events(cast(RecordingMeta, SimpleNamespace(event_sets=[])))


def test_pipeline_epochs_and_psd_validation() -> None:
    raw = _raw()
    epochs, summary = _apply_epochs(
        raw,
        _meta(),
        {"tmin_s": -0.1, "tmax_s": 0.2, "baseline_s": [-0.1, 0]},
    )
    assert len(epochs) == 2
    assert summary["event_id"] == {"one": 1, "two": 2}
    psd = _apply_psd(raw, {"fmin_hz": 1, "fmax_hz": 40})
    assert psd["n_channels"] == 1
    assert set(psd["bands_mean_psd"]).issubset({"delta", "theta", "alpha", "beta", "gamma"})
    with pytest.raises(PipelineExecutionError, match="tmin_s"):
        _apply_epochs(raw, _meta(), {"tmin_s": 1, "tmax_s": 1})
    with pytest.raises(PipelineExecutionError, match="baseline_s"):
        _apply_epochs(raw, _meta(), {"tmin_s": 0, "tmax_s": 1, "baseline_s": [0]})
    with pytest.raises(PipelineExecutionError, match="fmin_hz"):
        _apply_psd(raw, {"fmin_hz": 20, "fmax_hz": 10})


def test_execute_definition_produces_artifacts_and_closes_adapter() -> None:
    adapter = Adapter(_raw())
    artifacts = execute_definition(
        {
            "nodes": [
                {"type": "filter", "params": {"l_freq_hz": 1, "h_freq_hz": 20}},
                {"type": "epoch", "params": {"tmin_s": -0.1, "tmax_s": 0.2}},
                {"type": "evoked"},
                {"type": "psd", "params": {"fmin_hz": 1, "fmax_hz": 40}},
                {"type": "bad_channels"},
            ]
        },
        cast(RecordingAdapter, adapter),
        _meta(),
    )
    assert adapter.closed
    assert {artifact.name for artifact in artifacts} == {
        "epochs_summary.json",
        "evoked_response.fif",
        "evoked_summary.json",
        "psd_summary.json",
    }


@pytest.mark.parametrize(
    ("definition", "message"),
    [
        ({}, "no nodes"),
        ({"nodes": [{"type": "evoked"}]}, "preceding epoch"),
        ({"nodes": [{"type": "unknown"}]}, "unsupported"),
    ],
)
def test_execute_definition_rejects_invalid_definitions(definition: dict, message: str) -> None:
    adapter = Adapter(_raw())
    with pytest.raises(PipelineExecutionError, match=message):
        execute_definition(definition, cast(RecordingAdapter, adapter), _meta())


def test_execute_definition_rejects_adapters_without_open_raw() -> None:
    class MetadataOnlyAdapter:
        def close(self) -> None:
            pass

    with pytest.raises(PipelineExecutionError, match="not supported"):
        execute_definition(
            {"nodes": [{"type": "psd"}]},
            cast(RecordingAdapter, MetadataOnlyAdapter()),
            _meta(),
        )
