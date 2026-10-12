"""UCL FIL OPM binary adapter.

The ``.bin`` payload is interleaved little-endian float32 samples
accompanied by a JSON sidecar header declaring sampling frequency,
channel inventory (name, type, unit, unit multiplier, position,
orientation) and optional events. The declared coordinate frame is
authoritative and never inferred.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from app.scientific.adapters import (
    BoundedWindow,
    ChannelMeta,
    EventMeta,
    EventSetMeta,
    RecordingMeta,
    SensorConfigMeta,
    SensorMeta,
    compute_decimation,
    decimate,
)

_UNIT_MAP = {
    "T": "tesla",
    "T/m": "tesla_per_metre",
    "V": "volt",
    "A": "amperes",
    "1": "dimensionless",
}


class OpmBinAdapter:
    def __init__(self, directory: Path, acquisition_system: str) -> None:
        self._directory = directory
        self._acquisition_system = acquisition_system
        self._header: dict | None = None
        self._samples: np.ndarray | None = None

    def _load_header(self) -> dict:
        if self._header is None:
            headers = sorted(
                list(self._directory.glob("*.json")) + list(self._directory.glob("*.json"))
            )
            headers = [p for p in headers if p.suffix == ".json"]
            if not headers:
                raise FileNotFoundError("missing JSON sidecar header for UCL FIL OPM .bin")
            self._header = json.loads(headers[0].read_text())
        return self._header

    def _load_samples(self) -> np.ndarray:
        if self._samples is None:
            bins = sorted(self._directory.glob("*.bin"))
            if not bins:
                raise FileNotFoundError("missing .bin payload for UCL FIL OPM recording")
            header = self._load_header()
            n_channels = int(header["n_channels"])
            dtype = np.dtype(header.get("dtype", "float32")).newbyteorder("<")
            raw = bins[0].read_bytes()
            self._samples = np.frombuffer(raw, dtype=dtype).reshape(-1, n_channels)
        return self._samples

    def metadata(self) -> RecordingMeta:
        header = self._load_header()
        samples = self._load_samples()
        sfreq = float(header["sampling_frequency_hz"])
        channels: list[ChannelMeta] = []
        sensors: list[SensorMeta] = []
        for declaration in header["channels"]:
            unit = _UNIT_MAP.get(declaration.get("unit", "1"), "other")
            position_mm = declaration.get("position_mm")
            orientation = declaration.get("orientation")
            channels.append(
                ChannelMeta(
                    name=declaration["name"],
                    type=declaration.get("type", "opm"),
                    unit=unit,
                    unit_mul=float(declaration.get("unit_mul", 1.0)),
                    group_name=declaration.get("group_name"),
                    status=declaration.get("status", "good"),
                    coil_type="opm",
                    position_mm=position_mm,
                    orientation=orientation,
                    opm_scalar=declaration.get("opm_scalar"),
                    opm_vector=declaration.get("opm_vector"),
                )
            )
            sensors.append(
                SensorMeta(
                    name=declaration["name"],
                    type=declaration.get("sensor_type", "opm_vector"),
                    channel_names=[declaration["name"]],
                    position_mm=position_mm,
                    orientation=orientation,
                    calibration=declaration.get("calibration"),
                )
            )

        event_sets: list[EventSetMeta] = []
        for declaration in header.get("event_sets", []):
            events = [
                EventMeta(
                    sample=int(e["sample"]),
                    time_s=round(int(e["sample"]) / sfreq, 6),
                    value=e.get("value"),
                    code=e.get("code"),
                    description=e.get("description"),
                )
                for e in declaration.get("events", [])
            ]
            event_sets.append(
                EventSetMeta(
                    name=declaration.get("name", "events"),
                    source=declaration.get("source", "acquisition"),
                    sample_convention=declaration.get("sample_convention", "onset"),
                    events=events,
                    metadata=declaration.get("metadata", {}),
                )
            )

        coordinate_frame = header.get("coordinate_frame", "head")
        return RecordingMeta(
            name=header.get("name", "opm_recording"),
            format="bin",
            acquisition_system=self._acquisition_system,
            duration_s=samples.shape[0] / sfreq,
            sampling_frequency_hz=sfreq,
            n_channels=int(header["n_channels"]),
            coordinate_frame=coordinate_frame,
            device_serial=header.get("device_serial"),
            manufacturer=header.get("manufacturer", "UCL FIL"),
            maxfilter_sss_applied=None,
            bad_channel_names=[
                c["name"] for c in header.get("channels", []) if c.get("status") == "bad"
            ],
            channels=channels,
            event_sets=event_sets,
            sensor_config=SensorConfigMeta(
                sensor_type=header.get("sensor_type", "opm_vector"),
                coordinate_frame=coordinate_frame,
                sensors=sensors,
                time_varying=bool(header.get("movement_tracking", False)),
                movement_ref=header.get("movement_ref"),
                positions_json={"length_unit": "mm", "frame": coordinate_frame},
                orientations_json={"frame": coordinate_frame},
            ),
        )

    def read_window(
        self,
        tmin_s: float,
        tmax_s: float,
        channel_names: list[str],
        decimation: int,
        max_samples: int,
    ) -> BoundedWindow:
        header = self._load_header()
        samples = self._load_samples()
        sfreq = float(header["sampling_frequency_hz"])
        names = [c["name"] for c in header["channels"]]
        indices = [names.index(n) for n in channel_names]
        window_s = tmax_s - tmin_s
        factor, truncated = compute_decimation(sfreq, window_s, "full", max_samples)
        factor = max(factor, decimation)
        start = max(0, int(round(tmin_s * sfreq)))
        stop = min(samples.shape[0], int(round(tmax_s * sfreq)))
        data = samples[start:stop, indices].T.astype(np.float64)
        data = decimate(data, factor)
        times = decimate(np.arange(start, stop) / sfreq, factor)
        return BoundedWindow(
            times_s=[float(t) for t in times],
            data=[[float(v) for v in row] for row in data],
            decimation=factor,
            effective_sampling_frequency_hz=sfreq / factor,
            truncated=truncated,
        )

    def close(self) -> None:
        self._samples = None
