"""Unit tests: MEG file-set requirements (FR-004)."""

from __future__ import annotations

from app.schemas.common import FileRole
from app.schemas.datasets import FileDeclaration
from app.scientific.formats import (
    default_acquisition_system,
    validate_file_set,
)


def _file(name: str, role: FileRole, size: int = 1024) -> FileDeclaration:
    return FileDeclaration(name=name, size_bytes=size, role=role)


def test_fif_requires_single_recording_file() -> None:
    assert validate_file_set("fif", [_file("a.fif", "recording")]) == []


def test_fif_rejects_missing_recording() -> None:
    findings = validate_file_set("fif", [_file("a.json", "metadata")])
    assert any("recording" in f for f in findings)


def test_ctf_requires_companion_set() -> None:
    findings = validate_file_set(
        "ctf",
        [
            _file("a.ds", "header"),
            _file("a_meg.fif", "recording"),
        ],
    )
    assert any("companion" in f for f in findings)


def test_ctf_complete_set_passes() -> None:
    files = [
        _file("a.ds", "header"),
        _file("a_meg.fif", "recording"),
        _file("a_res4.ds", "companion"),
    ]
    assert validate_file_set("ctf", files) == []


def test_bin_requires_header_sidecar() -> None:
    findings = validate_file_set("bin", [_file("a.bin", "recording")])
    assert any("header" in f for f in findings)


def test_bids_requires_metadata_and_recording() -> None:
    findings = validate_file_set("bids", [_file("a.fif", "recording")])
    assert any("metadata" in f for f in findings)


def test_unsupported_format_rejected() -> None:
    findings = validate_file_set("matlab", [_file("a.mat", "recording")])
    assert any("unsupported" in f for f in findings)


def test_duplicate_names_rejected() -> None:
    findings = validate_file_set("fif", [_file("a.fif", "recording"), _file("a.fif", "recording")])
    assert any("duplicate" in f for f in findings)


def test_default_acquisition_system() -> None:
    assert default_acquisition_system("bin") == "opm"
    assert default_acquisition_system("fif") == "squid"
