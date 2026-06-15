---
name: amazon-review-guard
description: >-
  Scan Sportstech's Amazon reviews and detect ONLY reviews that VIOLATE Amazon's
  review/community guidelines, then prepare a report-ready evidence packet for
  each. Detection and packet prep are automatic; report submission is always
  human-confirmed. Star rating and sentiment are NEVER signals — the only thing
  that matters is whether a review breaks a specific Amazon guideline. Use when
  the user says things like "scan our Amazon reviews", "check Sportstech reviews
  for guideline violations", "find reviews we can report", "review guard",
  "report abusive reviews", "find fake/spam/off-topic reviews", or "build the
  Amazon review report queue".
---

# amazon-review-guard

Detects Sportstech Amazon reviews that violate Amazon's community guidelines,
builds a report-ready evidence packet for each, and helps a human submit the
reports one at a time. **It does not act on sentiment or star rating.** A
1-star review that is an honest product opinion is *not* a violation; a 5-star
review containing a URL *is*.

> Marketplace note: the agentcentral data source is scoped to **Amazon.de
> (Germany)**. For other marketplaces use a CSV/JSON export or a separate key.

## Violation categories (the ONLY reasons to flag a review)

1. **profanity** — profanity / obscene / sexual content
2. **hate_harassment** — hate speech, harassment, or threats
3. **promotional** — promotional content, spam, advertising, URLs, or contact info
4. **off_topic** — about the seller, shipping, packaging, price, or Amazon's
   service — NOT the product itself
5. **private_info** — personal or private information
6. **illegal_dangerous** — illegal or dangerous content
7. **plagiarized** — plagiarized or duplicated content
8. **fake_incentivized** — clear fake / incentivized / competitor-manipulation
   signals (only with concrete evidence)

Anything that is not one of these, above the confidence threshold, is
`not_a_violation`.

## Compliance rules (built in — do not weaken)

- Flag a review **only** when there is a clear, evidenced violation of a
  specific guideline, **and** `confidence >= confidence_threshold` (config).
- **Conservative by default:** when unsure, classify as `not_a_violation`.
- **Never** use sentiment or star rating as a signal for a violation decision.
- Every review checked is written to a full **audit log** with its decision and
  a timestamp.
- Amazon has **no official "report review" API.** Submission is therefore
  **human-confirmed and one-at-a-time** — this skill never bulk-submits.

## Workflow (runnable end-to-end)

```
fetch_reviews  →  classify  →  build_report  →  [human marks approved rows]  →  report_helper
```

1. **fetch_reviews** — `scripts/fetch_reviews.py`
   Loads reviews from the configured source and normalizes them to
   `data/reviews.jsonl`. Sources: local CSV/JSON export, an agentcentral MCP
   dump, or a third-party review-data API. **Never scrapes Amazon directly.**
   - For the `agentcentral` source: first call the MCP tools
     `mcp__agentcentral__get_product_reviews` (and optionally
     `mcp__agentcentral__get_review_trends`) for each ASIN, save the combined
     JSON to the path in `config.yaml` (`data_source.agentcentral_path`), then
     run the loader.

2. **classify** — `scripts/classify.py`
   For each review, asks Claude (`ANTHROPIC_API_KEY`) whether it violates a
   specific guideline. Output per review: `is_violation`, `violation_type`,
   `evidence_quote`, `matched_guideline`, `confidence`, `justification`. Rating
   and sentiment are ignored. Idempotent — re-running only classifies
   new/changed reviews. Writes `data/classifications.jsonl`.

3. **build_report** — `scripts/build_report.py`
   Writes the **audit log** (`output/audit_log.jsonl`, every review checked)
   and the **report queue** (`output/report_queue.xlsx`) containing ONLY
   reviews where `is_violation == true AND confidence >= threshold`. Each queue
   row has the review URL, ASIN, rating, date, violation type, evidence quote,
   matched guideline, a drafted neutral report justification, the recommended
   report channel, and an empty `approve (y/n)` column.

4. **Human review** — a person opens `report_queue.xlsx` and types `y` in the
   `approve (y/n)` column for each row they want reported. This is the only gate
   that authorizes a submission.

5. **report_helper** — `scripts/report_helper.py`
   Processes ONLY approved rows, one at a time.
   - `manual` (default): prints the review URL, the Brand Registry "Report a
     Violation" / report-abuse steps, and the drafted justification to paste.
   - `assisted` (optional): uses Claude in Chrome to open the report flow and
     pre-fill it, but STOPS for explicit human confirmation before each
     submit. Never bulk-submits.

## Usage

```bash
cd .claude/skills/amazon-review-guard
export ANTHROPIC_API_KEY=sk-ant-...

python scripts/fetch_reviews.py        # → data/reviews.jsonl
python scripts/classify.py             # → data/classifications.jsonl
python scripts/build_report.py         # → output/report_queue.xlsx + audit_log.jsonl
# ... a human edits report_queue.xlsx, marking approved rows with "y" ...
python scripts/report_helper.py                 # manual mode (default)
python scripts/report_helper.py --mode assisted # assisted mode (confirm each submit)
```

The detection steps (1–3) are idempotent and schedulable (cron). Steps 4–5 are
deliberately human-driven. See `README.md` for env vars, scheduling, and the
full compliance note.
