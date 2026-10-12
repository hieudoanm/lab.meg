"""Supported MEG recording formats and their complete file sets.

A directory-based format such as CTF ``.ds`` is only complete when
every required companion file is present (docs §01, FR-004).
"""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.datasets import FileDeclaration


@dataclass(frozen=True)
class FileSetRequirement:
    format: str
    required_roles: frozenset[str]
    optional_roles: frozenset[str] = frozenset()
    description: str = ""


FORMAT_REQUIREMENTS: dict[str, FileSetRequirement] = {
    "fif": FileSetRequirement(
        format="fif",
        required_roles=frozenset({"recording"}),
        optional_roles=frozenset({"events", "channels", "coordsystem", "metadata"}),
        description="Elekta/Neuromag FIF container",
    ),
    "ctf": FileSetRequirement(
        format="ctf",
        required_roles=frozenset({"header", "recording", "companion"}),
        optional_roles=frozenset({"events", "coordsystem", "calibration", "crosstalk", "metadata"}),
        description="CTF .ds directory dataset",
    ),
    "kit": FileSetRequirement(
        format="kit",
        required_roles=frozenset({"recording"}),
        optional_roles=frozenset(
            {"header", "coordsystem", "calibration", "crosstalk", "events", "metadata"}
        ),
        description="Yokogawa KIT .sqd/.con",
    ),
    "bin": FileSetRequirement(
        format="bin",
        required_roles=frozenset({"recording", "header"}),
        optional_roles=frozenset({"events", "coordsystem", "calibration", "metadata"}),
        description="UCL FIL OPM binary with JSON sidecar header",
    ),
    "bids": FileSetRequirement(
        format="bids",
        required_roles=frozenset({"metadata", "recording"}),
        optional_roles=frozenset({"events", "channels", "coordsystem", "header", "companion"}),
        description="BIDS-organised MEG dataset",
    ),
}

SUPPORTED_FORMATS = frozenset(FORMAT_REQUIREMENTS)


def default_acquisition_system(recording_format: str) -> str:
    return "opm" if recording_format == "bin" else "squid"


def validate_file_set(recording_format: str, files: list[FileDeclaration]) -> list[str]:
    """Return validation findings; an empty list means the file set is complete."""
    if recording_format not in SUPPORTED_FORMATS:
        return [f"unsupported recording format: {recording_format}"]
    requirement = FORMAT_REQUIREMENTS[recording_format]
    findings: list[str] = []
    seen_roles: set[str] = set()
    names: set[str] = set()
    for declaration in files:
        if declaration.name in names:
            findings.append(f"duplicate file name: {declaration.name}")
        names.add(declaration.name)
        seen_roles.add(declaration.role)
    for role in sorted(requirement.required_roles - seen_roles):
        findings.append(f"missing required file role '{role}' for format '{recording_format}'")
    for role in sorted(seen_roles - requirement.required_roles - requirement.optional_roles):
        findings.append(f"unexpected file role '{role}' for format '{recording_format}'")
    if sum(f.size_bytes for f in files) == 0:
        findings.append("declared file set is empty")
    return findings
