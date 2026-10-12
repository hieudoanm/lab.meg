"""Synthetic sample recording generator.

Produces a Neuromag Vectorview-style recording matching the product
canon: 306 MEG channels (102 magnetometers + 204 planar gradiometers)
plus 9 auxiliary channels, 1000 Hz, head coordinate frame, with
stimulus events every 1.5 s alternating auditory/visual condition codes.
"""

from __future__ import annotations

import json
from pathlib import Path

import mne
import numpy as np

from app.scientific.adapters import (
    ChannelMeta,
    EventMeta,
    EventSetMeta,
    RecordingMeta,
    SensorConfigMeta,
    SensorMeta,
)

SFREQ = 1000.0
DURATION_S = 120.0
N_MAG = 102
N_GRAD = 204
N_AUX = 9
STIMULUS_INTERVAL_S = 1.5


def _helmet_positions(n: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    theta = np.linspace(0.1, np.pi - 0.1, int(np.ceil(np.sqrt(n))))
    phi = np.linspace(0, 2 * np.pi, int(np.ceil(np.sqrt(n))))
    grid = np.stack(np.meshgrid(theta, phi), axis=-1).reshape(-1, 2)[:n]
    radius = 0.11 + 0.01 * rng.standard_normal(n)
    x = radius * np.sin(grid[:, 0]) * np.cos(grid[:, 1])
    y = radius * np.sin(grid[:, 0]) * np.sin(grid[:, 1])
    z = radius * np.cos(grid[:, 0])
    return np.stack((x, y, z), axis=1)


def build_sample_raw() -> mne.io.RawArray:
    rng = np.random.default_rng(42)
    n_total = N_MAG + N_GRAD + N_AUX
    sfreq = SFREQ
    n_times = int(DURATION_S * sfreq)
    times = np.arange(n_times) / sfreq

    mag_pos = _helmet_positions(N_MAG, seed=1)
    grad_pos = _helmet_positions(N_GRAD, seed=2)

    data = np.zeros((n_total, n_times))
    # Auditory evoked response: 100 ms post-stimulus deflection, alternating
    # with a weaker visual response; plus sensor noise.
    for i in range(N_MAG):
        data[i] = 2e-13 * rng.standard_normal(n_times)
    for i in range(N_MAG, N_MAG + N_GRAD):
        data[i] = 3e-14 * rng.standard_normal(n_times)

    n_events = int(DURATION_S / STIMULUS_INTERVAL_S)
    for k in range(n_events):
        onset = int(k * STIMULUS_INTERVAL_S * sfreq)
        length = int(0.25 * sfreq)
        if onset + length > n_times:
            break
        envelope = np.exp(-np.linspace(0, 6, length)) * np.sin(np.linspace(0, 4 * np.pi, length))
        amplitude = 8e-13 if k % 2 == 0 else 4e-13
        data[: N_MAG + N_GRAD, onset : onset + length] += amplitude * envelope

    # Auxiliary channels: EOG (slow eye movements), ECG (periodic pulses),
    # stim (event codes), misc (room noise).
    aux = np.zeros((N_AUX, n_times))
    aux[0] = 200e-6 * np.sin(2 * np.pi * 0.3 * times) + 20e-6 * rng.standard_normal(n_times)  # EOG1
    aux[1] = 150e-6 * np.sin(2 * np.pi * 0.25 * times + 1.0) + 20e-6 * rng.standard_normal(
        n_times
    )  # EOG2
    aux[2] = 100e-6 * rng.standard_normal(n_times)  # EOG3
    ecg_pulse = np.zeros(n_times)
    for beat in range(int(DURATION_S * 1.2)):
        centre = int(beat / 1.2 * sfreq)
        if centre + 20 > n_times:
            break
        ecg_pulse[centre : centre + 20] = np.exp(-np.linspace(0, 5, 20)) * 1.2e-3
    aux[3] = ecg_pulse + 10e-6 * rng.standard_normal(n_times)  # ECG
    stim = np.zeros(n_times)
    for k in range(n_events):
        onset = int(k * STIMULUS_INTERVAL_S * sfreq)
        if onset + 50 > n_times:
            break
        code = 1 if k % 2 == 0 else 2
        stim[onset : onset + 50] = code
    aux[4] = stim  # STI 014
    aux[5] = rng.standard_normal(n_times) * 0.5  # MISC1
    aux[6] = rng.standard_normal(n_times) * 0.5  # MISC2
    aux[7] = rng.standard_normal(n_times) * 0.5  # MISC3
    aux[8] = stim * 0.0  # STI 015 spare
    data[N_MAG + N_GRAD :] = aux

    ch_names = (
        [f"MEG {i + 1:04d}" for i in range(N_MAG)]
        + [f"MEG {N_MAG + i + 1:04d}" for i in range(N_GRAD)]
        + [
            "EOG 001",
            "EOG 002",
            "EOG 003",
            "ECG 001",
            "STI 014",
            "MISC 001",
            "MISC 002",
            "MISC 003",
            "STI 015",
        ]
    )
    ch_types = (
        ["mag"] * N_MAG
        + ["grad"] * N_GRAD
        + ["eog"] * 3
        + ["ecg"]
        + ["stim"]
        + ["misc"] * 3
        + ["stim"]
    )

    info = mne.create_info(ch_names=ch_names, sfreq=sfreq, ch_types=ch_types)
    positions = np.vstack((mag_pos, grad_pos, np.zeros((N_AUX, 3))))
    for i, channel in enumerate(info["chs"]):
        loc = np.zeros(12)
        loc[0:3] = positions[i]
        loc[3:6] = (
            positions[i] / np.linalg.norm(positions[i])
            if np.linalg.norm(positions[i]) > 0
            else np.array([0.0, 0.0, 1.0])
        )
        channel["loc"] = loc

    raw = mne.io.RawArray(data, info, verbose="error")
    raw.info["description"] = "MEG Lab sample recording (synthetic Vectorview)"
    device_info = {"serial": "Vectorview-204", "manufacturer": "Elekta Neuromag"}
    raw.info["device_info"] = device_info
    return raw


def build_sample_metadata(raw: mne.io.RawArray) -> RecordingMeta:
    positions = {}
    for channel in raw.info["chs"]:
        loc = channel["loc"]
        positions[channel["ch_name"]] = {
            "position_mm": [round(float(v) * 1000.0, 3) for v in loc[0:3]],
            "orientation": [round(float(v), 6) for v in loc[3:6]],
        }

    channels: list[ChannelMeta] = []
    sensors: list[SensorMeta] = []
    for i, channel in enumerate(raw.info["chs"]):
        kind = mne.channel_type(raw.info, i)
        if kind == "mag":
            channel_type, unit, coil, group = "mag", "tesla", "magnetometer", "MEG magnetometers"
        elif kind == "grad":
            channel_type, unit, coil, group = (
                "grad",
                "tesla_per_metre",
                "planar_gradiometer",
                "MEG planar gradiometers",
            )
        elif kind == "eog":
            channel_type, unit, coil, group = "eog", "volt", None, "EOG"
        elif kind == "ecg":
            channel_type, unit, coil, group = "ecg", "volt", None, "ECG"
        elif kind == "stim":
            channel_type, unit, coil, group = "stim", "dimensionless", None, "Trigger"
        else:
            channel_type, unit, coil, group = "misc", "other", None, "Miscellaneous"
        channels.append(
            ChannelMeta(
                name=channel["ch_name"],
                type=channel_type,
                unit=unit,
                unit_mul=1.0,
                group_name=group,
                coil_type=coil,
                position_mm=positions[channel["ch_name"]]["position_mm"],
                orientation=positions[channel["ch_name"]]["orientation"],
            )
        )
        if kind in ("mag", "grad"):
            sensors.append(
                SensorMeta(
                    name=channel["ch_name"],
                    type="magnetometer" if kind == "mag" else "gradiometer",
                    channel_names=[channel["ch_name"]],
                    position_mm=positions[channel["ch_name"]]["position_mm"],
                    orientation=positions[channel["ch_name"]]["orientation"],
                )
            )

    sfreq = float(raw.info["sfreq"])
    n_events = int(DURATION_S / STIMULUS_INTERVAL_S)
    events = [
        EventMeta(
            sample=int(k * STIMULUS_INTERVAL_S * sfreq),
            time_s=round(k * STIMULUS_INTERVAL_S, 3),
            value=1 if k % 2 == 0 else 2,
            code=f"STI {1 if k % 2 == 0 else 2:03d}",
            description="auditory tone" if k % 2 == 0 else "visual flash",
        )
        for k in range(n_events)
    ]
    event_sets = [
        EventSetMeta(
            name="stimulus_events",
            source="acquisition",
            sample_convention="onset",
            events=events,
            metadata={
                "event_id_mapping": {"1": "auditory tone", "2": "visual flash"},
                "stim_channel": "STI 014",
            },
        )
    ]

    return RecordingMeta(
        name="Sample Recording",
        format="fif",
        acquisition_system="squid",
        duration_s=DURATION_S,
        sampling_frequency_hz=sfreq,
        n_channels=raw.info["nchan"],
        coordinate_frame="head",
        device_serial="Vectorview-204",
        manufacturer="Elekta Neuromag",
        maxfilter_sss_applied=False,
        bad_channel_names=[],
        channels=channels,
        event_sets=event_sets,
        sensor_config=SensorConfigMeta(
            sensor_type="magnetometer",
            coordinate_frame="head",
            sensors=sensors,
            time_varying=False,
            positions_json={"length_unit": "mm", "frame": "head"},
            orientations_json={"frame": "head"},
        ),
    )


def save_sample_fif(raw: mne.io.RawArray, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    raw.save(destination, overwrite=True, fmt="double", verbose="error")


SAMPLE_MANIFEST = {
    "license": "CC0-1.0",
    "citation": "MEG Lab synthetic sample recording (Vectorview-style, 306+9 channels, 1000 Hz).",
    "description": "Synthetic auditory/visual evoked MEG sample generated by the backend.",
}


def sample_manifest_json() -> str:
    return json.dumps(SAMPLE_MANIFEST)
