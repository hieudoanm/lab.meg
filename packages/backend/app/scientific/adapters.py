"""Recording adapters: metadata extraction and bounded signal reads.

Adapters never load a whole recording into memory. FIF/CTF/KIT are
opened lazily via MNE-Python (memory-mapped where the format allows)
and only the requested, bounded window is read and decimated.
"""

from __future__ import annotations

import json
import shutil
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

import numpy as np

from app.schemas.datasets import FileDeclaration
from app.scientific.formats import FORMAT_REQUIREMENTS

# Resolution levels map to integer decimation factors.
RESOLUTION_DECIMATION = {"full": 1, "high": 2, "medium": 4, "low": 8, "summary": 16}


@dataclass
class ChannelMeta:
    name: str
    type: str
    unit: str
    unit_mul: float = 1.0
    group_name: str | None = None
    status: str = "good"
    coil_type: str | None = None
    position_mm: list[float] | None = None
    orientation: list[float] | None = None
    opm_scalar: bool | None = None
    opm_vector: bool | None = None


@dataclass
class EventMeta:
    sample: int
    time_s: float
    code: str | None = None
    value: int | None = None
    description: str | None = None


@dataclass
class EventSetMeta:
    name: str
    source: str
    sample_convention: str
    events: list[EventMeta] = field(default_factory=list)
    description: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class SensorMeta:
    name: str
    type: str
    channel_names: list[str]
    position_mm: list[float] | None = None
    orientation: list[float] | None = None
    calibration: float | None = None


@dataclass
class SensorConfigMeta:
    sensor_type: str
    coordinate_frame: str
    sensors: list[SensorMeta]
    time_varying: bool = False
    movement_ref: str | None = None
    positions_json: dict[str, Any] | None = None
    orientations_json: dict[str, Any] | None = None
    calibrations_json: dict[str, Any] | None = None


@dataclass
class RecordingMeta:
    name: str
    format: str
    acquisition_system: str
    duration_s: float
    sampling_frequency_hz: float
    n_channels: int
    coordinate_frame: str
    device_serial: str | None = None
    manufacturer: str | None = None
    maxfilter_sss_applied: bool | None = None
    bad_channel_names: list[str] = field(default_factory=list)
    channels: list[ChannelMeta] = field(default_factory=list)
    event_sets: list[EventSetMeta] = field(default_factory=list)
    sensor_config: SensorConfigMeta | None = None


@dataclass
class BoundedWindow:
    times_s: list[float]
    data: list[list[float]]
    decimation: int
    effective_sampling_frequency_hz: float
    truncated: bool


class RecordingAdapter(Protocol):
    def metadata(self) -> RecordingMeta: ...

    def read_window(
        self,
        tmin_s: float,
        tmax_s: float,
        channel_names: list[str],
        decimation: int,
        max_samples: int,
    ) -> BoundedWindow: ...

    def close(self) -> None: ...


def download_assets(
    storage: Any,
    files: list[FileDeclaration],
    workdir: Path | None = None,
) -> Path:
    """Download declared assets into a directory preserving file names."""
    destination = workdir or Path(tempfile.mkdtemp(prefix="meglab-"))
    for declaration in files:
        target = destination / declaration.name
        if target.exists():
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = (
            storage.get_object(declaration.object_key)
            if hasattr(declaration, "object_key")
            else None
        )
        if payload is None:
            raise FileNotFoundError(f"asset unavailable: {declaration.name}")
        target.write_bytes(payload)
    return destination


def open_adapter(
    recording_format: str,
    directory: Path,
    acquisition_system: str,
    storage: Any,
    files: list[Any],
) -> RecordingAdapter:
    if recording_format == "fif":
        from app.scientific.mne_adapter import MneRecordingAdapter

        return MneRecordingAdapter(directory, acquisition_system)
    if recording_format in ("ctf", "kit"):
        from app.scientific.mne_adapter import MneRecordingAdapter

        return MneRecordingAdapter(directory, acquisition_system)
    if recording_format == "bin":
        from app.scientific.opm_bin_adapter import OpmBinAdapter

        return OpmBinAdapter(directory, acquisition_system)
    if recording_format == "bids":
        from app.scientific.mne_adapter import MneRecordingAdapter

        return MneRecordingAdapter(directory, acquisition_system)
    raise ValueError(f"unsupported recording format: {recording_format}")


def decimate(values: np.ndarray, factor: int) -> np.ndarray:
    """Integer decimation for summary/preview resolutions (no anti-alias filter)."""
    if factor <= 1:
        return values
    return values[::factor]


def compute_decimation(
    sampling_frequency_hz: float,
    window_s: float,
    resolution: str,
    max_samples: int,
) -> tuple[int, bool]:
    """Pick a decimation factor that keeps the window within ``max_samples``."""
    factor = RESOLUTION_DECIMATION.get(resolution, 4)
    truncated = False
    native_samples = int(window_s * sampling_frequency_hz)
    while native_samples / factor > max_samples:
        factor *= 2
        truncated = True
    return factor, truncated


def required_roles(recording_format: str) -> frozenset[str]:
    return FORMAT_REQUIREMENTS[recording_format].required_roles


def _json_default(obj: Any) -> Any:
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    raise TypeError(f"not serialisable: {type(obj)}")


def dump_json(payload: Any) -> str:
    return json.dumps(payload, default=_json_default)


__all__ = [
    "RecordingAdapter",
    "RecordingMeta",
    "ChannelMeta",
    "EventSetMeta",
    "SensorConfigMeta",
    "BoundedWindow",
    "download_assets",
    "open_adapter",
    "compute_decimation",
    "decimate",
    "dump_json",
    "RESOLUTION_DECIMATION",
]

_ = shutil  # reserved for adapter temp-dir lifecycle
