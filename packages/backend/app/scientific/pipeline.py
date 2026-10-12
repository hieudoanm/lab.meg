"""Pipeline execution against a loaded recording.

Executes the versioned pipeline definition's nodes (filter, epoch,
evoked, psd, bad_channels) using MNE-Python inside the versioned
scientific runtime image. Pure computation: no HTTP, no database
access - the caller (worker task) owns persistence.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Protocol

import mne
import numpy as np

from app.scientific.adapters import (
    BoundedWindow,
    EventSetMeta,
    RecordingAdapter,
    RecordingMeta,
    decimate,
    dump_json,
)


class ArtifactSink(Protocol):
    def add(
        self,
        name: str,
        media_type: str,
        kind: str,
        payload: bytes | str,
        metadata: dict[str, Any] | None = None,
    ) -> None: ...


@dataclass
class ArtifactRecord:
    name: str
    media_type: str
    kind: str
    payload: bytes | str
    metadata: dict[str, Any] = field(default_factory=dict)


class PipelineExecutionError(Exception):
    def __init__(self, message: str, classification: str = "invalid_input") -> None:
        super().__init__(message)
        self.classification = classification


def _require_params(params: dict[str, Any], *keys: str) -> None:
    for key in keys:
        if key not in params:
            raise PipelineExecutionError(f"missing required parameter '{key}'")


def _apply_filter(raw, params: dict[str, Any]) -> Any:
    _require_params(params, "l_freq_hz", "h_freq_hz")
    l_freq = float(params["l_freq_hz"])
    h_freq = float(params["h_freq_hz"])
    if not (0 <= l_freq < h_freq <= raw.info["sfreq"] / 2):
        raise PipelineExecutionError(
            f"invalid bandpass range [{l_freq}, {h_freq}] for sampling frequency {raw.info['sfreq']}"
        )
    return raw.filter(l_freq=l_freq, h_freq=h_freq, verbose="error")


def _find_stim_events(meta: RecordingMeta) -> tuple[np.ndarray, dict]:
    if not meta.event_sets:
        raise PipelineExecutionError("recording has no event sets; epoching requires events")
    event_set = meta.event_sets[0]
    events = np.array(
        [[int(e.sample), 0, int(e.value or 1)] for e in event_set.events],
        dtype=int,
    )
    event_id = {str(e.value or 1): e.code or f"event_{e.value or 1}" for e in event_set.events}
    return events, event_id


def _apply_epochs(raw, meta: RecordingMeta, params: dict[str, Any]) -> tuple[Any, dict]:
    _require_params(params, "tmin_s", "tmax_s")
    tmin = float(params["tmin_s"])
    tmax = float(params["tmax_s"])
    if tmin >= tmax:
        raise PipelineExecutionError("epoch tmin_s must be less than tmax_s")
    baseline = params.get("baseline_s")
    if baseline is not None and (
        not isinstance(baseline, list) or len(baseline) != 2 or baseline[0] >= baseline[1]
    ):
        raise PipelineExecutionError("baseline_s must be a [start, end] pair with start < end")
    events, event_id = _find_stim_events(meta)
    picks = mne_picks_meg(raw)
    epochs = mne.Epochs(
        raw,
        events,
        event_id=event_id,
        tmin=tmin,
        tmax=tmax,
        baseline=tuple(baseline) if baseline else None,
        picks=picks,
        preload=True,
        reject_by_annotation=True,
        verbose="error",
    )
    summary = {
        "n_epochs": len(epochs),
        "n_channels": len(epochs.ch_names),
        "tmin_s": tmin,
        "tmax_s": tmax,
        "baseline_s": baseline,
        "event_id": event_id,
        "drop_log_summary": _summarize_drop_log(epochs.drop_log),
    }
    return epochs, summary


def _summarize_drop_log(drop_log: list[tuple]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for entry in drop_log:
        for reason in entry:
            counts[reason] = counts.get(reason, 0) + 1
    return counts


def _apply_evoked(epochs, params: dict[str, Any]) -> tuple[Any, dict]:
    if len(epochs) == 0:
        raise PipelineExecutionError("no epochs survived rejection; evoked average is undefined")
    evoked = epochs.average()
    times = np.asarray(evoked.times)
    data = np.asarray(evoked.data)
    step = max(1, len(times) // 200)
    return evoked, {
        "nave": int(evoked.nave),
        "n_channels": len(evoked.ch_names),
        "times_s": [round(float(t), 6) for t in times[::step]],
        "data_decimated": [[round(float(v), 9) for v in row[::step]] for row in data],
        "channels": evoked.ch_names,
    }


def _apply_psd(raw, params: dict[str, Any]) -> dict:
    fmin = float(params.get("fmin_hz", 1.0))
    fmax = float(params.get("fmax_hz", 100.0))
    if not (0 <= fmin < fmax):
        raise PipelineExecutionError("psd requires 0 <= fmin_hz < fmax_hz")
    picks = mne_picks_meg(raw)
    psds, freqs = mne.time_frequency.psd_array_welch(
        raw.get_data(picks=picks),
        sfreq=float(raw.info["sfreq"]),
        fmin=fmin,
        fmax=fmax,
        n_fft=2048,
        verbose="error",
    )
    band_means = {
        "delta": (0.5, 4.0),
        "theta": (4.0, 8.0),
        "alpha": (8.0, 13.0),
        "beta": (13.0, 30.0),
        "gamma": (30.0, 80.0),
    }
    bands: dict[str, float] = {}
    for band, (lo, hi) in band_means.items():
        mask = (freqs >= lo) & (freqs <= hi)
        if mask.any():
            bands[band] = round(float(np.mean(psds[:, mask])), 12)
    return {"fmin_hz": fmin, "fmax_hz": fmax, "bands_mean_psd": bands, "n_channels": len(picks)}


def execute_definition(
    definition: dict[str, Any],
    adapter: RecordingAdapter,
    meta: RecordingMeta,
) -> list[ArtifactRecord]:
    """Execute definition nodes sequentially; return produced artifacts."""
    nodes = definition.get("nodes") or definition.get("steps")
    if not isinstance(nodes, list) or not nodes:
        raise PipelineExecutionError("pipeline definition has no nodes/steps")

    raw = None
    epochs = None
    artifacts: list[ArtifactRecord] = []

    try:
        for node in nodes:
            node_type = node.get("type") or node.get("op") or node.get("name")
            params = node.get("params", {})
            if node_type in ("filter", "bandpass", "mne.filter.filter_data"):
                if raw is None:
                    raw = _open_raw(adapter)
                raw = _apply_filter(raw, params)
            elif node_type in ("epoch", "epochs", "mne.Epochs"):
                if raw is None:
                    raw = _open_raw(adapter)
                epochs, summary = _apply_epochs(raw, meta, params)
                artifacts.append(
                    ArtifactRecord(
                        "epochs_summary.json",
                        "application/json",
                        "derived",
                        dump_json(summary),
                        summary,
                    )
                )
            elif node_type in ("evoked", "average", "mne.Epochs.average"):
                if epochs is None:
                    raise PipelineExecutionError("evoked node requires a preceding epoch node")
                evoked, summary = _apply_evoked(epochs, params)
                evoked_fif = _evoked_to_fif(evoked)
                artifacts.append(
                    ArtifactRecord(
                        "evoked_response.fif", "application/octet-stream", "derived", evoked_fif
                    )
                )
                artifacts.append(
                    ArtifactRecord(
                        "evoked_summary.json",
                        "application/json",
                        "derived",
                        dump_json(summary),
                        summary,
                    )
                )
            elif node_type in ("psd", "spectral", "psd_welch"):
                if raw is None:
                    raw = _open_raw(adapter)
                summary = _apply_psd(raw, params)
                artifacts.append(
                    ArtifactRecord(
                        "psd_summary.json",
                        "application/json",
                        "derived",
                        dump_json(summary),
                        summary,
                    )
                )
            elif node_type in ("bad_channels", "bad-channel-detection"):
                continue  # metadata-only step: bad channels are preserved, not discarded
            else:
                raise PipelineExecutionError(f"unsupported pipeline node type: {node_type}")
        return artifacts
    finally:
        adapter.close()


def _open_raw(adapter: RecordingAdapter):
    # Pipeline execution is supported for MNE-backed adapters (FIF/CTF/KIT/BIDS).
    open_raw = getattr(adapter, "open_raw", None)
    if open_raw is None:
        raise PipelineExecutionError(
            "pipeline execution is not supported for this recording format",
            "unsupported_format",
        )
    return open_raw()


def _evoked_to_fif(evoked) -> bytes:
    import io

    buffer = io.BytesIO()
    evoked.save(buffer, overwrite=True, verbose="error")
    return buffer.getvalue()


def mne_picks_meg(raw):
    import mne

    return mne.pick_types(raw.info, meg=True, eeg=False, exclude=[])


_ = hashlib, json, BoundedWindow, EventSetMeta, decimate
