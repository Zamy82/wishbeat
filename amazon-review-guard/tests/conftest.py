"""Shared test fixtures: a throwaway project directory with a config."""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from review_guard.config import load_config


@pytest.fixture
def project(tmp_path: Path):
    """Create a config.yaml in tmp_path and return the loaded Config.

    Paths resolve relative to the config file, so all data/output lands in
    tmp_path — no pollution of the real project.
    """
    (tmp_path / "config.yaml").write_text(
        textwrap.dedent(
            """
            asins:
              - B000000000
              - B000000001
            confidence_threshold: 0.80
            negative_max_rating: 3
            model: claude-opus-4-8
            data_source:
              type: csv
              path: data/reviews_export.csv
              agentcentral_path: data/agentcentral_reviews.json
              api:
                base_url: https://example.test/reviews
                key_env: REVIEW_DATA_API_KEY
            paths:
              reviews: data/reviews.jsonl
              classifications: data/classifications.jsonl
              report_queue: output/report_queue.xlsx
              audit_log: output/audit_log.jsonl
              report_actions: output/report_actions.jsonl
              dashboard: output/dashboard.html
            """
        ),
        encoding="utf-8",
    )
    return load_config(tmp_path / "config.yaml")
