"""Unit tests for adapter-independent scientific helpers."""

from __future__ import annotations

from types import SimpleNamespace
from typing import cast

import numpy as np
import pytest

from app.schemas.datasets import FileDeclaration
from app.scientific.adapters import (
    compute_decimation,
    decimate,
    download_assets,
    dump_json,
    required_roles,
)


def test_decimation_and_window_bounds() -> None:
    values = np.arange(10)
    assert decimate(values, 1) is values
    assert decimate(values, 3).tolist() == [0, 3, 6, 9]
    assert compute_decimation(100, 1, "full", 200) == (1, False)
    assert compute_decimation(1_000, 10, "low", 100) == (128, True)


def test_decimation_defaults_unknown_resolution_and_json_serialises_numpy() -> None:
    assert compute_decimation(100, 1, "unknown", 100) == (4, False)
    assert dump_json({"float": np.float32(1.5), "array": np.array([1, 2])}) == (
        '{"float": 1.5, "array": [1, 2]}'
    )
    with pytest.raises(TypeError):
        dump_json(object())


def test_required_roles_are_format_specific() -> None:
    assert "recording" in required_roles("fif")
    assert "header" in required_roles("bin")


def test_download_assets_preserves_nested_names_and_rejects_missing(tmp_path) -> None:
    class Storage:
        def get_object(self, key):
            return {"raw/a.bin": b"abc"}.get(key)

    files = [SimpleNamespace(name="nested/a.bin", object_key="raw/a.bin")]
    destination = download_assets(Storage(), cast(list[FileDeclaration], files), tmp_path)
    assert (destination / "nested/a.bin").read_bytes() == b"abc"
    with pytest.raises(FileNotFoundError, match="unavailable"):
        download_assets(
            Storage(),
            cast(list[FileDeclaration], [SimpleNamespace(name="missing", object_key="missing")]),
            tmp_path,
        )
