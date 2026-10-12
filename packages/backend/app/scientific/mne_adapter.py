"""MNE-Python adapter for FIF, CTF, KIT, and BIDS recordings."""

from __future__ import annotations

import json
from pathlib import Path

import mne
import numpy as np

from app.scientific.adapters import (
    BoundedWindow,
    ChannelMeta,
    EventSetMeta,
    RecordingMeta,
    SensorConfigMeta,
    SensorMeta,
    compute_decimation,
    decimate,
)

_MNE_TYPE_TO_CHANNEL = {
    "mag": ("mag", "tesla", "magnetometer"),
    "grad": ("grad", "tesla_per_metre", "planar_gradiometer"),
    "eeg": ("eeg", "volt", None),
    "eog": ("eog", "volt", None),
    "ecg": ("ecg", "volt", None),
    "stim": ("stim", "dimensionless", None),
    "misc": ("misc", "other", None),
}

_MNE_GROUP = {
    "mag": "MEG magnetometers",
    "grad": "MEG planar gradiometers",
    "eeg": "EEG",
    "eog": "EOG",
    "ecg": "ECG",
    "stim": "Trigger",
    "misc": "Miscellaneous",
}


class MneRecordingAdapter:
    def __init__(self, directory: Path, acquisition_system: str) -> None:
        self._directory = directory
        self._acquisition_system = acquisition_system
        self._raw: mne.io.BaseRaw | None = None

    def _load(self) -> mne.io.BaseRaw:
        if self._raw is None:
            fif_files = sorted(self._directory.glob("*.fif"))
            ctf_dirs = sorted(
                p for p in self._directory.iterdir() if p.is_dir() and p.suffix == ".ds"
            )
            sqd_files = sorted(
                list(self._directory.glob("*.sqd")) + list(self._directory.glob("*.con"))
            )
            bids_dirs = [
                p for p in self._directory.iterdir() if (p / "dataset_description.json").exists()
            ]
            if bids_dirs:
                from mne_bids.path import find_matched_paths

                bids_root = bids_dirs[0]
                raw_paths = find_matched_paths(bids_root, suffixes="raw", extensions=".fif")
                if not raw_paths:
                    raise FileNotFoundError("no BIDS raw data found")
                self._raw = mne.io.read_raw_fif(raw_paths[0], preload=False, verbose="error")
            elif ctf_dirs:
                self._raw = mne.io.read_raw_ctf(
                    input_fname=str(ctf_dirs[0]), preload=False, verbose="error"
                )
            elif sqd_files:
                self._raw = mne.io.read_raw_kit(
                    input_fname=str(sqd_files[0]), preload=False, verbose="error"
                )
            elif fif_files:
                self._raw = mne.io.read_raw_fif(fif_files[0], preload=False, verbose="error")
            else:
                raise FileNotFoundError("no supported MEG file found in upload")
        return self._raw

    def metadata(self) -> RecordingMeta:
        raw = self._load()
        info = raw.info
        channels: list[ChannelMeta] = []
        for index, channel in enumerate(info["chs"]):
            mne_type = mne.channel_type(info, index)
            mapped = _MNE_TYPE_TO_CHANNEL.get(mne_type, ("misc", "other", None))
            channel_type, unit, coil_type = mapped
            loc = channel.get("loc", np.zeros(12))
            position_mm = [round(float(v) * 1000.0, 3) for v in loc[0:3]] if len(loc) >= 3 else None
            orientation = [round(float(v), 6) for v in loc[3:6]] if len(loc) >= 6 else None
            channels.append(
                ChannelMeta(
                    name=channel["ch_name"],
                    type=channel_type,
                    unit=unit,
                    unit_mul=1.0,
                    group_name=_MNE_GROUP.get(channel_type),
                    status="bad" if channel["ch_name"] in info["bads"] else "good",
                    coil_type=coil_type,
                    position_mm=position_mm,
                    orientation=orientation,
                )
            )

        event_sets: list[EventSetMeta] = []
        try:
            events = mne.find_events(raw, verbose="error")
            if events is not None and len(events):
                event_names = {
                    str(value): f"event_{value}" for value in sorted({int(e[2]) for e in events})
                }
                event_sets.append(
                    EventSetMeta(
                        name="stimulus_events",
                        source="acquisition",
                        sample_convention="onset",
                        events=[
                            _event_meta(int(e[0]), raw.info["sfreq"], int(e[2])) for e in events
                        ],
                        metadata={"event_id_mapping": event_names, "stim_channel": "STI 014"},
                    )
                )
        except Exception:  # noqa: BLE001 - events are optional metadata
            event_sets = []

        sensor_config = self._extract_sensors(raw, channels)
        return RecordingMeta(
            name=raw.info.get("description") or raw.filenames[0].stem
            if raw.filenames
            else "recording",
            format=_detect_format(raw),
            acquisition_system=self._acquisition_system,
            duration_s=float(raw.times[-1]) if len(raw.times) else 0.0,
            sampling_frequency_hz=float(raw.info["sfreq"]),
            n_channels=len(raw.ch_names),
            coordinate_frame="head",
            device_serial=raw.info.get("device_info", {}).get("serial")
            if isinstance(raw.info.get("device_info"), dict)
            else None,
            manufacturer=raw.info.get("device_info", {}).get("manufacturer")
            if isinstance(raw.info.get("device_info"), dict)
            else None,
            maxfilter_sss_applied=raw.info.get("max_info") is not None,
            bad_channel_names=list(raw.info["bads"]),
            channels=channels,
            event_sets=event_sets,
            sensor_config=sensor_config,
        )

    def _extract_sensors(
        self, raw: mne.io.BaseRaw, channels: list[ChannelMeta]
    ) -> SensorConfigMeta:
        sensors: list[SensorMeta] = []
        for index, channel in enumerate(raw.info["chs"]):
            mne_type = mne.channel_type(raw.info, index)
            if mne_type not in ("mag", "grad"):
                continue
            loc = channel.get("loc", np.zeros(12))
            position_mm = [round(float(v) * 1000.0, 3) for v in loc[0:3]] if len(loc) >= 3 else None
            orientation = [round(float(v), 6) for v in loc[3:6]] if len(loc) >= 6 else None
            sensor_type = "magnetometer" if mne_type == "mag" else "gradiometer"
            sensors.append(
                SensorMeta(
                    name=channel["ch_name"],
                    type=sensor_type,
                    channel_names=[channel["ch_name"]],
                    position_mm=position_mm,
                    orientation=orientation,
                )
            )
        return SensorConfigMeta(
            sensor_type=sensors[0].type if sensors else "magnetometer",
            coordinate_frame="head",
            sensors=sensors,
            time_varying=False,
            positions_json={"length_unit": "mm", "frame": "head"},
            orientations_json={"frame": "head"},
        )

    def read_window(
        self,
        tmin_s: float,
        tmax_s: float,
        channel_names: list[str],
        decimation: int,
        max_samples: int,
    ) -> BoundedWindow:
        raw = self._load()
        sfreq = float(raw.info["sfreq"])
        window_s = tmax_s - tmin_s
        factor, truncated = compute_decimation(sfreq, window_s, "full", max_samples)
        factor = max(factor, decimation)
        start = max(0, int(round(tmin_s * sfreq)))
        stop = min(len(raw.times), int(round(tmax_s * sfreq)))
        picks = mne.pick_channels(raw.ch_names, channel_names, ordered=True)
        data = raw.get_data(picks=picks, start=start, stop=stop)
        data = decimate(data, factor)
        times = decimate(np.arange(start, stop) / sfreq, factor)
        return BoundedWindow(
            times_s=[float(t) for t in times],
            data=[[float(v) for v in row] for row in data],
            decimation=factor,
            effective_sampling_frequency_hz=sfreq / factor,
            truncated=truncated,
        )

    def open_raw(self) -> mne.io.BaseRaw:
        """Return the underlying MNE raw object for pipeline execution."""
        return self._load()

    def close(self) -> None:
        self._raw = None


def _event_meta(sample: int, sfreq: float, value: int):
    from app.scientific.adapters import EventMeta

    return EventMeta(
        sample=sample,
        time_s=round(sample / sfreq, 6),
        value=value,
        code=f"STI {value:03d}",
    )


def _detect_format(raw: mne.io.BaseRaw) -> str:
    first = str(raw.filenames[0] if raw.filenames else "").lower()
    if first.endswith(".ds"):
        return "ctf"
    if first.endswith((".sqd", ".con")):
        return "kit"
    return "fif"


_ = json
