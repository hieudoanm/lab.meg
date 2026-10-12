"""Identifier helpers.

Entity primary keys are non-guessable UUIDs (DBML default
``gen_random_uuid()``). Experiment run identifiers use the canonical
``run_<8 hex>`` form (OpenAPI pattern ``^run_[0-9a-f]{8}$``).
"""

from __future__ import annotations

import secrets
import uuid


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()


def new_run_id() -> str:
    return f"run_{secrets.token_hex(4)}"
