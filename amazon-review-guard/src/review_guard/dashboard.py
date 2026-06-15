"""Build a self-contained HTML dashboard over the reviews.

Segments reviews so you can see, at a glance, e.g. "of 1953 negative reviews,
553 violate Amazon policy" — broken down by category, plus a filterable table.

The dashboard is read-only analytics. It categorizes ALL reviews (negativity is
shown, but a violation is decided independently of rating). It never reports
anything — reporting stays in the human-confirmed `submit` step.
"""

from __future__ import annotations

import html
from collections import Counter
from pathlib import Path
from typing import Any

from .config import Config
from .io_utils import read_jsonl

_CATEGORY_LABELS = {
    "profanity": "Profanity / obscene",
    "hate_harassment": "Hate / harassment / threats",
    "promotional": "Promotional / spam / URLs",
    "off_topic": "Off-topic (seller / shipping / courier / price)",
    "private_info": "Private information",
    "illegal_dangerous": "Illegal / dangerous",
    "plagiarized": "Plagiarized / duplicated",
    "fake_incentivized": "Fake / incentivized / competitor",
}


def compute_stats(config: Config) -> dict[str, Any]:
    """Join reviews with classifications and compute dashboard numbers."""
    reviews = {r["review_id"]: r for r in read_jsonl(config.path("reviews"))}
    decisions = {d["review_id"]: d for d in read_jsonl(config.path("classifications"))}
    if not decisions:
        raise SystemExit("no classifications found — run 'review-guard classify' first")

    threshold = config.confidence_threshold
    neg_max = config.negative_max_rating

    rows: list[dict[str, Any]] = []
    for rid, decision in decisions.items():
        review = reviews.get(rid, {})
        rating = review.get("rating")
        confidence = float(decision.get("confidence", 0.0) or 0.0)
        is_violation = bool(
            decision.get("is_violation") and not decision.get("error") and confidence >= threshold
        )
        is_negative = rating is not None and rating <= neg_max
        rows.append(
            {
                "review_id": rid,
                "asin": decision.get("asin", review.get("asin", "")),
                "rating": rating,
                "date": review.get("date", ""),
                "title": review.get("title", ""),
                "body": review.get("body", ""),
                "url": review.get("url", ""),
                "is_negative": is_negative,
                "is_violation": is_violation,
                "violation_type": decision.get("violation_type", "none") if is_violation else "none",
                "confidence": round(confidence, 3),
                "evidence_quote": decision.get("evidence_quote", "") if is_violation else "",
            }
        )

    negatives = [r for r in rows if r["is_negative"]]
    neg_violations = [r for r in negatives if r["is_violation"]]
    by_type = Counter(r["violation_type"] for r in neg_violations)
    violations_in_non_negative = sum(
        1 for r in rows if r["is_violation"] and not r["is_negative"]
    )

    return {
        "threshold": threshold,
        "negative_max_rating": neg_max,
        "total": len(rows),
        "total_negative": len(negatives),
        "negative_violations": len(neg_violations),
        "negative_clean": len(negatives) - len(neg_violations),
        "by_type": dict(by_type),
        "violations_in_non_negative": violations_in_non_negative,
        "rows": rows,
    }


def _esc(value: Any) -> str:
    return html.escape("" if value is None else str(value))


def render_html(stats: dict[str, Any]) -> str:
    s = stats
    pct = (100 * s["negative_violations"] / s["total_negative"]) if s["total_negative"] else 0

    cards = [
        ("Reviews total", s["total"]),
        (f"Negativ (≤ {s['negative_max_rating']}★)", s["total_negative"]),
        ("Negativ &amp; verstößt", f"{s['negative_violations']} ({pct:.0f}%)"),
        ("Negativ, kein Verstoß", s["negative_clean"]),
    ]
    cards_html = "\n".join(
        f'<div class="card"><div class="num">{_esc(v) if not isinstance(v, str) else v}</div>'
        f'<div class="lbl">{lbl}</div></div>'
        for lbl, v in cards
    )

    cat_rows = "\n".join(
        f"<tr><td>{_CATEGORY_LABELS.get(t, _esc(t))}</td><td class='r'>{c}</td></tr>"
        for t, c in sorted(s["by_type"].items(), key=lambda kv: -kv[1])
    ) or "<tr><td colspan='2'>—</td></tr>"

    # Only negative reviews in the table (matches the dashboard's framing).
    table_rows = []
    for r in sorted(s["rows"], key=lambda x: (not x["is_violation"], -(x["confidence"] or 0))):
        if not r["is_negative"]:
            continue
        cat = _CATEGORY_LABELS.get(r["violation_type"], "—") if r["is_violation"] else "—"
        badge = "v" if r["is_violation"] else "ok"
        body = r["body"]
        body_short = body if len(body) <= 240 else body[:240] + "…"
        table_rows.append(
            "<tr class='{cls}' data-violation='{v}'>"
            "<td class='r'>{rating}</td>"
            "<td><span class='badge {badge}'>{cat}</span></td>"
            "<td class='r'>{conf}</td>"
            "<td><b>{title}</b><br>{body}</td>"
            "<td>{ev}</td>"
            "<td>{url}</td></tr>".format(
                cls="viol" if r["is_violation"] else "",
                v="1" if r["is_violation"] else "0",
                rating=_esc(r["rating"]),
                badge=badge,
                cat=cat,
                conf=_esc(r["confidence"]) if r["is_violation"] else "",
                title=_esc(r["title"]),
                body=_esc(body_short),
                ev=_esc(r["evidence_quote"]),
                url=(f'<a href="{_esc(r["url"])}" target="_blank">öffnen</a>' if r["url"] else ""),
            )
        )
    table_html = "\n".join(table_rows) or "<tr><td colspan='6'>Keine negativen Reviews.</td></tr>"

    note = ""
    if s["violations_in_non_negative"]:
        note = (
            f"<p class='note'>Hinweis: zusätzlich {s['violations_in_non_negative']} "
            "Verstoß/Verstöße in <em>nicht-negativen</em> Reviews gefunden "
            "(Verstöße sind unabhängig von der Sternebewertung).</p>"
        )

    return f"""<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>amazon-review-guard — Dashboard</title>
<style>
  :root {{ color-scheme: light dark; }}
  body {{ font-family: system-ui, sans-serif; margin: 24px; line-height: 1.45; }}
  h1 {{ font-size: 1.4rem; }}
  .cards {{ display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; }}
  .card {{ border: 1px solid #8884; border-radius: 10px; padding: 14px 18px; min-width: 150px; }}
  .num {{ font-size: 1.8rem; font-weight: 700; }}
  .lbl {{ opacity: .7; font-size: .85rem; }}
  table {{ border-collapse: collapse; width: 100%; margin-top: 10px; font-size: .9rem; }}
  th, td {{ border-bottom: 1px solid #8883; padding: 8px; text-align: left; vertical-align: top; }}
  td.r, th.r {{ text-align: right; white-space: nowrap; }}
  .badge {{ padding: 2px 8px; border-radius: 999px; font-size: .8rem; white-space: nowrap; }}
  .badge.v {{ background: #e5484d22; color: #e5484d; }}
  .badge.ok {{ background: #8881; opacity: .7; }}
  tr.viol {{ background: #e5484d0d; }}
  .controls {{ margin: 12px 0; }}
  .note {{ opacity: .75; font-size: .9rem; }}
  .two {{ display: flex; flex-wrap: wrap; gap: 32px; align-items: flex-start; }}
</style></head>
<body>
  <h1>amazon-review-guard — Review-Dashboard</h1>
  <p class="note">Verstoß = nur klare, belegte Richtlinien-Verletzung mit
     Konfidenz ≥ {s['threshold']}. Sterne/Stimmung sind kein Signal. Dieses
     Dashboard meldet nichts — Meldung erfolgt separat, menschlich bestätigt.</p>
  <div class="cards">{cards_html}</div>
  {note}
  <div class="two">
    <div>
      <h2 style="font-size:1.1rem">Verstöße nach Kategorie (negative Reviews)</h2>
      <table><thead><tr><th>Kategorie</th><th class="r">Anzahl</th></tr></thead>
        <tbody>{cat_rows}</tbody></table>
    </div>
  </div>
  <h2 style="font-size:1.1rem; margin-top:24px">Negative Reviews (≤ {s['negative_max_rating']}★)</h2>
  <div class="controls">
    <label><input type="checkbox" id="onlyViol"> nur Verstöße anzeigen</label>
    &nbsp;&nbsp;
    <input type="search" id="q" placeholder="Suche in Titel/Text…" style="padding:6px;min-width:220px">
  </div>
  <table id="tbl"><thead><tr>
    <th class="r">★</th><th>Kategorie</th><th class="r">Konfidenz</th>
    <th>Review</th><th>Beleg</th><th>Link</th>
  </tr></thead><tbody>{table_html}</tbody></table>
<script>
  const tbl = document.getElementById('tbl');
  const onlyViol = document.getElementById('onlyViol');
  const q = document.getElementById('q');
  function apply() {{
    const term = q.value.toLowerCase();
    for (const tr of tbl.tBodies[0].rows) {{
      const isViol = tr.dataset.violation === '1';
      const text = tr.innerText.toLowerCase();
      const show = (!onlyViol.checked || isViol) && (!term || text.includes(term));
      tr.style.display = show ? '' : 'none';
    }}
  }}
  onlyViol.addEventListener('change', apply);
  q.addEventListener('input', apply);
</script>
</body></html>"""


def run_dashboard(config: Config) -> dict[str, Any]:
    stats = compute_stats(config)
    out_path = config.path("dashboard")
    Path(out_path).write_text(render_html(stats), encoding="utf-8")
    stats["dashboard_path"] = out_path
    return stats
