"""Source-agnostic review loader. Normalizes reviews to a common schema and
NEVER scrapes Amazon product pages directly.

Sources: csv | json | agentcentral (MCP dump) | api (third-party).
Normalized fields:
  review_id, asin, rating, title, body, reviewer, date, helpful_votes, url
"""

from __future__ import annotations

import csv
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

from .config import Config
from .io_utils import write_jsonl

FIELD_ALIASES: dict[str, list[str]] = {
    "review_id": ["review_id", "id", "reviewId", "review_id_str", "reviewID"],
    "asin": ["asin", "ASIN", "product_id", "productAsin", "product_asin"],
    "rating": ["rating", "stars", "star_rating", "overall", "score"],
    "title": ["title", "review_title", "headline", "summary"],
    "body": ["body", "text", "review_text", "content", "reviewBody", "comment"],
    "reviewer": ["reviewer", "author", "reviewer_name", "profile_name", "user", "name"],
    "date": ["date", "review_date", "reviewDate", "submitted_at", "timestamp", "created_at"],
    "helpful_votes": ["helpful_votes", "helpful", "helpful_count", "helpfulVotes", "num_helpful"],
    "url": ["url", "review_url", "link", "permalink"],
    "verified": ["verified", "verified_purchase", "is_verified", "verifizierter_kauf", "verifizierterKauf"],
    "product": ["product", "product_name", "item_name", "productTitle", "product_title"],
}


def _to_bool(value: Any) -> bool | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("1", "true", "yes", "y", "verified", "verifiziert", "verifizierter kauf")


def _first(raw: dict[str, Any], names: list[str]) -> Any:
    for name in names:
        if name in raw and raw[name] not in (None, ""):
            return raw[name]
    return None


def _to_int(value: Any) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def _to_rating(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize(raw: dict[str, Any]) -> dict[str, Any]:
    """Coerce one raw review dict into the normalized schema."""
    return {
        "review_id": str(_first(raw, FIELD_ALIASES["review_id"]) or "").strip(),
        "asin": str(_first(raw, FIELD_ALIASES["asin"]) or "").strip(),
        "rating": _to_rating(_first(raw, FIELD_ALIASES["rating"])),
        "title": str(_first(raw, FIELD_ALIASES["title"]) or "").strip(),
        "body": str(_first(raw, FIELD_ALIASES["body"]) or "").strip(),
        "reviewer": str(_first(raw, FIELD_ALIASES["reviewer"]) or "").strip(),
        "date": str(_first(raw, FIELD_ALIASES["date"]) or "").strip(),
        "helpful_votes": _to_int(_first(raw, FIELD_ALIASES["helpful_votes"])),
        "url": str(_first(raw, FIELD_ALIASES["url"]) or "").strip(),
        "verified": _to_bool(_first(raw, FIELD_ALIASES["verified"])),
        "product": str(_first(raw, FIELD_ALIASES["product"]) or "").strip(),
    }


def extract_reviews(data: Any) -> list[dict[str, Any]]:
    """Pull a flat list of review dicts out of common container shapes:
    a bare list, {reviews|data|items|results: [...]}, or an ASIN-keyed mapping."""
    if isinstance(data, list):
        return [d for d in data if isinstance(d, dict)]
    if isinstance(data, dict):
        for key in ("reviews", "data", "items", "results"):
            if isinstance(data.get(key), list):
                return [d for d in data[key] if isinstance(d, dict)]
        flattened: list[dict[str, Any]] = []
        for value in data.values():
            flattened.extend(extract_reviews(value))
        return flattened
    return []


def _load_csv(path: Path) -> list[dict[str, Any]]:
    with open(path, encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def _load_json(path: Path) -> list[dict[str, Any]]:
    with open(path, encoding="utf-8") as fh:
        return extract_reviews(json.load(fh))


def _load_api(api_cfg: dict[str, Any], asins: list[str]) -> list[dict[str, Any]]:
    import requests

    key_env = api_cfg.get("key_env", "REVIEW_DATA_API_KEY")
    api_key = os.environ.get(key_env)
    if not api_key:
        raise SystemExit(f"environment variable {key_env} is not set (api source)")

    base_url = api_cfg["base_url"]
    headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
    collected: list[dict[str, Any]] = []

    for asin in asins:
        for attempt in range(5):
            try:
                resp = requests.get(base_url, headers=headers, params={"asin": asin}, timeout=30)
                if resp.status_code == 429:
                    wait = 2 ** attempt
                    print(f"  rate limited on {asin}; retrying in {wait}s", file=sys.stderr)
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
                collected.extend(extract_reviews(resp.json()))
                break
            except requests.RequestException as exc:
                wait = 2 ** attempt
                print(f"  request error for {asin}: {exc}; retry in {wait}s", file=sys.stderr)
                time.sleep(wait)
        else:
            print(f"  giving up on {asin} after retries", file=sys.stderr)
    return collected


def fetch(config: Config) -> list[dict[str, Any]]:
    """Load, normalize, dedupe (by review_id), and ASIN-filter the reviews."""
    ds = config.data_source
    source = ds.get("type")

    if source == "csv":
        raw = _load_csv(config.source_path("path"))
    elif source == "json":
        raw = _load_json(config.source_path("path"))
    elif source == "agentcentral":
        raw = _load_json(config.source_path("agentcentral_path"))
    elif source == "api":
        raw = _load_api(ds["api"], config.asins)
    else:
        raise SystemExit(f"unknown data_source.type '{source}'")

    by_id: dict[str, dict[str, Any]] = {}
    for item in raw:
        rec = normalize(item)
        if rec["review_id"] and rec["body"]:
            by_id[rec["review_id"]] = rec

    if config.asins:
        asin_set = set(config.asins)
        by_id = {
            rid: rec for rid, rec in by_id.items()
            if not rec["asin"] or rec["asin"] in asin_set
        }
    return list(by_id.values())


def run_fetch(config: Config, source: str | None = None) -> tuple[int, Path]:
    if source:
        config.data_source["type"] = source
    reviews = fetch(config)
    out_path = config.path("reviews")
    write_jsonl(out_path, reviews)
    return len(reviews), out_path
