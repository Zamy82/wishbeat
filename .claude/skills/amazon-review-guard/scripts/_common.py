"""Shared helpers for amazon-review-guard scripts.

Small, dependency-light utilities: config loading, path resolution relative to
the skill root, and JSONL read/write. Kept separate so each script stays short
and the behavior is consistent.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Iterable

import yaml

# Skill root = parent of this scripts/ directory.
SKILL_ROOT = Path(__file__).resolve().parent.parent


def load_config() -> dict[str, Any]:
    """Load config.yaml from the skill root."""
    with open(SKILL_ROOT / "config.yaml", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def resolve(rel_path: str) -> Path:
    """Resolve a config path relative to the skill root and ensure its parent
    directory exists."""
    path = SKILL_ROOT / rel_path
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    """Read a JSONL file into a list of dicts. Missing file -> []."""
    if not path.exists():
        return []
    records: list[dict[str, Any]] = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


def write_jsonl(path: Path, records: Iterable[dict[str, Any]]) -> None:
    """Overwrite a JSONL file with the given records (atomic via temp file)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        for record in records:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
    os.replace(tmp, path)


def append_jsonl(path: Path, record: dict[str, Any]) -> None:
    """Append a single record to a JSONL file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")
