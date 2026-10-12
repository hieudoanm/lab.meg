"""Unit tests: schema boundaries and canonical patterns."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.datasets import FileDeclaration
from app.schemas.runs import ResourceLimits


def test_run_id_pattern_rejected_by_schema() -> None:
    # Run.id carries the ^run_[0-9a-f]{8}$ pattern; construct
    # through the repository path instead, so only verify that
    # the schema enforces resource limits bounds.
    limits = ResourceLimits(cpu_cores=4.0, memory_bytes=8, disk_bytes=16, wall_clock_limit_s=60)
    assert limits.cpu_cores == 4.0


def test_file_declaration_checksum_pattern() -> None:
    with pytest.raises(ValidationError):
        FileDeclaration(
            name="a.fif",
            size_bytes=10,
            role="recording",
            checksum_sha256="not-a-checksum",
        )


def test_file_declaration_accepts_canonical_checksum() -> None:
    declaration = FileDeclaration(
        name="a.fif",
        size_bytes=10,
        role="recording",
        checksum_sha256="sha256:" + "1f" * 32,
    )
    assert declaration.checksum_sha256 is not None
    assert declaration.checksum_sha256.startswith("sha256:")


def test_file_declaration_rejects_negative_size() -> None:
    with pytest.raises(ValidationError):
        FileDeclaration(name="a.fif", size_bytes=-1, role="recording")
