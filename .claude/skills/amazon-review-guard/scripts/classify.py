#!/usr/bin/env python3
"""Classify reviews against Amazon's community guidelines.

For each review, asks Claude whether it violates a SPECIFIC guideline. The
decision IGNORES star rating and sentiment entirely — a low rating is not a
violation, and a high rating does not excuse one. Conservative: when unsure,
the answer is not_a_violation.

Per-review output (data/classifications.jsonl):
  is_violation, violation_type, evidence_quote, matched_guideline,
  confidence (0-1), justification

Idempotent: a review is re-classified only if it is new or its text changed
(tracked by a content hash). Errors are recorded as such and retried on the
next run, never silently dropped.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone

from _common import load_config, read_jsonl, resolve, write_jsonl

VIOLATION_TYPES = [
    "profanity",
    "hate_harassment",
    "promotional",
    "off_topic",
    "private_info",
    "illegal_dangerous",
    "plagiarized",
    "fake_incentivized",
]

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
- private_info: personal or private information (names+contact, addresses, order
  numbers tied to a person, etc.).
- illegal_dangerous: illegal activity or dangerous/unsafe instructions.
- plagiarized: text copied/duplicated from elsewhere or obviously templated/repeated.
- fake_incentivized: clear signals of a fake, paid, incentivized, or competitor
  review — ONLY with concrete evidence (e.g. states it was free in exchange for
  a review, admits not buying it, mentions a competitor brand promotion). A
  generic vague review is NOT enough.

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


def content_hash(review: dict) -> str:
    payload = f"{review.get('title', '')}\n{review.get('body', '')}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def classify_one(client, model: str, review: dict) -> dict:
    """Call Claude for a single review. Returns the decision dict (without
    bookkeeping fields). Raises on API error so the caller can record it."""
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Classify reviews for guideline violations.")
    parser.add_argument("--force", action="store_true", help="Re-classify every review.")
    parser.add_argument("--limit", type=int, default=0, help="Max reviews to classify this run (0 = all).")
    args = parser.parse_args()

    config = load_config()
    model = config.get("model", "claude-opus-4-8")
    reviews = read_jsonl(resolve(config["paths"]["reviews"]))
    if not reviews:
        sys.exit("error: no reviews found — run fetch_reviews.py first")

    class_path = resolve(config["paths"]["classifications"])
    existing = {rec["review_id"]: rec for rec in read_jsonl(class_path)}

    try:
        import anthropic
    except ImportError:
        sys.exit("error: the 'anthropic' package is required (pip install -r requirements.txt)")

    client = anthropic.Anthropic(max_retries=5)  # reads ANTHROPIC_API_KEY from env

    processed = 0
    for review in reviews:
        rid = review["review_id"]
        chash = content_hash(review)
        prior = existing.get(rid)
        # Skip if already classified successfully with the same content (idempotent).
        if not args.force and prior and prior.get("content_hash") == chash and not prior.get("error"):
            continue
        if args.limit and processed >= args.limit:
            break

        record = {
            "review_id": rid,
            "asin": review.get("asin", ""),
            "content_hash": chash,
            "model": model,
            "classified_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            decision = classify_one(client, model, review)
            record.update(decision)
            record["error"] = None
        except Exception as exc:  # noqa: BLE001 — record and continue, retry next run
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
            print(f"  error on {rid}: {record['error']}", file=sys.stderr)

        existing[rid] = record
        processed += 1
        if processed % 10 == 0:
            print(f"  classified {processed} reviews...")

    # Write the full snapshot back (every known review keeps its latest decision).
    write_jsonl(class_path, list(existing.values()))
    violations = sum(1 for r in existing.values() if r.get("is_violation"))
    errors = sum(1 for r in existing.values() if r.get("error"))
    print(
        f"classified {processed} this run; {len(existing)} total "
        f"({violations} flagged, {errors} errored) -> {class_path}"
    )


if __name__ == "__main__":
    main()
