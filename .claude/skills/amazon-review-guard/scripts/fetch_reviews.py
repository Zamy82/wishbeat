#!/usr/bin/env python3
"""Source-agnostic review loader for amazon-review-guard.

Loads Sportstech Amazon reviews from one configured source and normalizes them
to a common schema. It NEVER scrapes Amazon product pages directly.

Sources (config.yaml -> data_source.type):
  csv           local CSV export
  json          local JSON export (list of objects, or {"reviews": [...]})
  agentcentral  JSON dump previously written by the agentcentral MCP review
                tools (get_product_reviews / get_review_trends)
  api           third-party review-data API (key read from an env var)

Normalized record fields:
  review_id, asin, rating, title, body, reviewer, date, helpful_votes, url

Output: data/reviews.jsonl (one normalized review per line, deduped by
review_id). Idempotent — re-running rewrites the snapshot.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from pathlib import Path
from typing import Any

from _common import load_config, resolve, write_jsonl

# Accept a range of upstream field names and normalize to our schema.
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
}


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
    }


def _load_csv(path: Path) -> list[dict[str, Any]]:
    with open(path, encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def _load_json(path: Path) -> list[dict[str, Any]]:
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    return _extract_reviews(data)


def _extract_reviews(data: Any) -> list[dict[str, Any]]:
    """Pull a flat list of review dicts out of common container shapes."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("reviews", "data", "items", "results"):
            if isinstance(data.get(key), list):
                return data[key]
        # agentcentral output may be keyed by ASIN -> {reviews: [...]}
        flattened: list[dict[str, Any]] = []
        for value in data.values():
            flattened.extend(_extract_reviews(value))
        if flattened:
            return flattened
    return []


def _load_api(api_cfg: dict[str, Any], asins: list[str]) -> list[dict[str, Any]]:
    import os

    import requests

    key_env = api_cfg.get("key_env", "REVIEW_DATA_API_KEY")
    api_key = os.environ.get(key_env)
    if not api_key:
        sys.exit(f"error: environment variable {key_env} is not set (api source)")

    base_url = api_cfg["base_url"]
    headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
    collected: list[dict[str, Any]] = []

    for asin in asins:
        for attempt in range(5):
            try:
                resp = requests.get(
                    base_url, headers=headers, params={"asin": asin}, timeout=30
                )
                if resp.status_code == 429:
                    wait = 2 ** attempt
                    print(f"  rate limited on {asin}; retrying in {wait}s", file=sys.stderr)
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
                collected.extend(_extract_reviews(resp.json()))
                break
            except requests.RequestException as exc:
                wait = 2 ** attempt
                print(f"  request error for {asin}: {exc}; retrying in {wait}s", file=sys.stderr)
                time.sleep(wait)
        else:
            print(f"  giving up on {asin} after retries", file=sys.stderr)
    return collected


def fetch(config: dict[str, Any]) -> list[dict[str, Any]]:
    ds = config["data_source"]
    source = ds["type"]
    asins = [str(a).strip() for a in config.get("asins", [])]

    if source == "csv":
        raw = _load_csv(resolve(ds["path"]))
    elif source == "json":
        raw = _load_json(resolve(ds["path"]))
    elif source == "agentcentral":
        raw = _load_json(resolve(ds["agentcentral_path"]))
    elif source == "api":
        raw = _load_api(ds["api"], asins)
    else:
        sys.exit(f"error: unknown data_source.type '{source}'")

    normalized = [normalize(r) for r in raw]
    # Keep only rows we can act on, and dedupe by review_id (last wins).
    by_id: dict[str, dict[str, Any]] = {}
    for rec in normalized:
        if rec["review_id"] and rec["body"]:
            by_id[rec["review_id"]] = rec

    # If ASINs are configured, restrict to them (defensive — exports may include others).
    if asins:
        asin_set = set(asins)
        by_id = {
            rid: rec
            for rid, rec in by_id.items()
            if not rec["asin"] or rec["asin"] in asin_set
        }
    return list(by_id.values())


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch and normalize Sportstech reviews.")
    parser.add_argument(
        "--source",
        help="Override data_source.type (csv|json|agentcentral|api)",
    )
    args = parser.parse_args()

    config = load_config()
    if args.source:
        config["data_source"]["type"] = args.source

    reviews = fetch(config)
    out_path = resolve(config["paths"]["reviews"])
    write_jsonl(out_path, reviews)
    print(f"fetched {len(reviews)} reviews -> {out_path}")


if __name__ == "__main__":
    main()
