"""Classify each review against Amazon's community guidelines using Claude.

The decision IGNORES star rating and sentiment — a low rating is not a
violation, and a high rating does not excuse one. Conservative: when unsure,
not_a_violation. Idempotent: a review is re-classified only if new or changed.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from . import VIOLATION_TYPES
from .config import Config
from .io_utils import read_jsonl, write_jsonl

SYSTEM_PROMPT = """You are a strict, conservative compliance reviewer for Sportstech.
Your ONLY job is to decide whether a single Amazon product review VIOLATES one of
Amazon's community guidelines. You are NOT judging product quality, sentiment, or
star rating.

ABSOLUTE RULES:
- NEVER treat a low rating, negative sentiment, criticism, or a high rating as a
  violation. Honest negative opinions about the product are explicitly allowed.
- Flag a violation ONLY when there is clear, concrete textual evidence of one of
  the categories below. When in doubt, it is NOT a violation.
- The evidence_quote MUST be an exact substring copied verbatim from the review
  title or body. If you cannot quote specific evidence, it is NOT a violation.

VIOLATION CATEGORIES:
- profanity: profanity, obscene, or sexual content.
- hate_harassment: hate speech, harassment, or threats toward a person or group.
- promotional: advertising, spam, promotion of other products/sellers, URLs,
  email addresses, phone numbers, or other contact info.
- off_topic: the review is about the SELLER, shipping, packaging, delivery,
  price, or Amazon's service rather than the PRODUCT itself.
- private_info: personal or private information (names+contact, addresses,
  order numbers tied to a person, etc.).
- illegal_dangerous: illegal activity or dangerous/unsafe instructions.
- plagiarized: text copied/duplicated from elsewhere or obviously templated.
- fake_incentivized: clear signals of a fake, paid, incentivized, or competitor
  review — ONLY with concrete evidence (e.g. states it was free in exchange for
  a review, admits not buying it, promotes a competitor brand). A generic vague
  review is NOT enough.

If none clearly applies above your confidence, set is_violation=false,
violation_type="none", evidence_quote="", matched_guideline="", and explain why
in justification.

confidence is your certainty (0.0-1.0) that this is a genuine, reportable
guideline violation."""

OUTPUT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "is_violation": {"type": "boolean"},
        "violation_type": {"type": "string", "enum": VIOLATION_TYPES + ["none"]},
        "evidence_quote": {"type": "string"},
        "matched_guideline": {"type": "string"},
        "confidence": {"type": "number"},
        "justification": {"type": "string"},
    },
    "required": [
        "is_violation",
        "violation_type",
        "evidence_quote",
        "matched_guideline",
        "confidence",
        "justification",
    ],
}


def content_hash(review: dict[str, Any]) -> str:
    payload = f"{review.get('title', '')}\n{review.get('body', '')}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def classify_one(client: Any, model: str, review: dict[str, Any]) -> dict[str, Any]:
    """Ask Claude about one review. Returns the decision dict; raises on API
    error so the caller can record it and continue."""
    user_content = (
        "Review to evaluate (rating/sentiment are NOT relevant to your decision):\n"
        f"Title: {review.get('title', '')}\n"
        f"Body: {review.get('body', '')}"
    )
    resp = client.messages.create(
        model=model,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
        output_config={"format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}},
    )
    text = "".join(block.text for block in resp.content if block.type == "text")
    return json.loads(text)


def _make_client() -> Any:
    try:
        import anthropic
    except ImportError as exc:  # pragma: no cover - import guard
        raise SystemExit("the 'anthropic' package is required (pip install -e .)") from exc
    return anthropic.Anthropic(max_retries=5)  # reads ANTHROPIC_API_KEY from env


def run_classify(
    config: Config,
    *,
    client: Any | None = None,
    force: bool = False,
    limit: int = 0,
) -> dict[str, int]:
    """Classify reviews and write classifications.jsonl. Returns counts."""
    reviews = read_jsonl(config.path("reviews"))
    if not reviews:
        raise SystemExit("no reviews found — run 'review-guard fetch' first")

    class_path = config.path("classifications")
    existing = {rec["review_id"]: rec for rec in read_jsonl(class_path)}

    if client is None:
        client = _make_client()

    processed = 0
    for review in reviews:
        rid = review["review_id"]
        chash = content_hash(review)
        prior = existing.get(rid)
        if not force and prior and prior.get("content_hash") == chash and not prior.get("error"):
            continue
        if limit and processed >= limit:
            break

        record: dict[str, Any] = {
            "review_id": rid,
            "asin": review.get("asin", ""),
            "content_hash": chash,
            "model": config.model,
            "classified_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            record.update(classify_one(client, config.model, review))
            record["error"] = None
        except Exception as exc:  # noqa: BLE001 — record and retry next run
            record.update(
                {
                    "is_violation": False,
                    "violation_type": "none",
                    "evidence_quote": "",
                    "matched_guideline": "",
                    "confidence": 0.0,
                    "justification": "",
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )
        existing[rid] = record
        processed += 1

    write_jsonl(class_path, list(existing.values()))
    return {
        "processed": processed,
        "total": len(existing),
        "flagged": sum(1 for r in existing.values() if r.get("is_violation")),
        "errored": sum(1 for r in existing.values() if r.get("error")),
    }
