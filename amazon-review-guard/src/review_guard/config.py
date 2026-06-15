"""Configuration loading. All paths resolve relative to the config file's
directory, so the tool works the same from any working directory (cron, CI)."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


@dataclass
class Config:
    asins: list[str]
    confidence_threshold: float
    model: str
    data_source: dict[str, Any]
    paths: dict[str, str]
    base_dir: Path = field(default_factory=Path.cwd)

    def path(self, key: str) -> Path:
        """Resolve a configured output/working path and ensure its parent exists."""
        resolved = self.base_dir / self.paths[key]
        resolved.parent.mkdir(parents=True, exist_ok=True)
        return resolved

    def source_path(self, key: str) -> Path:
        """Resolve a path inside data_source (e.g. 'path', 'agentcentral_path')."""
        return self.base_dir / self.data_source[key]


def load_config(config_path: str | Path = "config.yaml") -> Config:
    config_path = Path(config_path).resolve()
    if not config_path.exists():
        raise SystemExit(
            f"config not found: {config_path}\n"
            "Copy config.example.yaml to config.yaml and edit it."
        )
    with open(config_path, encoding="utf-8") as fh:
        raw = yaml.safe_load(fh) or {}
    return Config(
        asins=[str(a).strip() for a in raw.get("asins", [])],
        confidence_threshold=float(raw.get("confidence_threshold", 0.8)),
        model=raw.get("model", "claude-opus-4-8"),
        data_source=raw.get("data_source", {}),
        paths=raw.get("paths", {}),
        base_dir=config_path.parent,
    )
