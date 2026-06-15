"""Build a self-contained HTML review dashboard (card layout) over the reviews.

It segments reviews so you can see "of N negative reviews, X violate Amazon
policy", broken down by category, plus a searchable/filterable card list in the
style of a review-management UI.

INTEGRITY RULE (enforced here): the report action is offered ONLY for reviews
with a genuine, evidenced guideline violation. Honest negative reviews are shown
but explicitly marked "nicht meldbar" (not reportable) and cannot be selected.
There is no bulk auto-submit — reporting stays human-confirmed in `submit`.
"""

from __future__ import annotations

import html
from collections import Counter
from pathlib import Path
from typing import Any

from .config import Config
from .io_utils import read_jsonl
from .report import DEFAULT_CHANNEL, REPORT_CHANNELS, draft_justification

_CATEGORY_LABELS = {
    "profanity": "Profanity / obszön",
    "hate_harassment": "Hass / Belästigung / Drohung",
    "promotional": "Werbung / Spam / URLs",
    "off_topic": "Off-topic (Verkäufer / Versand / Kurier / Preis)",
    "private_info": "Persönliche Daten",
    "illegal_dangerous": "Illegal / gefährlich",
    "plagiarized": "Plagiat / dupliziert",
    "fake_incentivized": "Fake / incentiviert / Wettbewerber",
}


def compute_stats(config: Config) -> dict[str, Any]:
    """Join reviews with classifications and compute dashboard data."""
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
        vtype = decision.get("violation_type", "none") if is_violation else "none"
        rows.append(
            {
                "review_id": rid,
                "asin": decision.get("asin", review.get("asin", "")),
                "product": review.get("product", ""),
                "rating": rating,
                "date": review.get("date", ""),
                "reviewer": review.get("reviewer", ""),
                "title": review.get("title", ""),
                "body": review.get("body", ""),
                "url": review.get("url", ""),
                "verified": review.get("verified"),
                "is_negative": rating is not None and rating <= neg_max,
                "is_violation": is_violation,
                "violation_type": vtype,
                "confidence": round(confidence, 3),
                "evidence_quote": decision.get("evidence_quote", "") if is_violation else "",
                "matched_guideline": decision.get("matched_guideline", "") if is_violation else "",
                "justification": (
                    draft_justification(vtype, decision.get("matched_guideline", ""), decision.get("evidence_quote", ""))
                    if is_violation else ""
                ),
                "channel": REPORT_CHANNELS.get(vtype, DEFAULT_CHANNEL) if is_violation else "",
            }
        )

    negatives = [r for r in rows if r["is_negative"]]
    neg_violations = [r for r in negatives if r["is_violation"]]
    by_type = Counter(r["violation_type"] for r in neg_violations)
    return {
        "threshold": threshold,
        "negative_max_rating": neg_max,
        "total": len(rows),
        "total_negative": len(negatives),
        "negative_violations": len(neg_violations),
        "negative_clean": len(negatives) - len(neg_violations),
        "by_type": dict(by_type),
        "violations_in_non_negative": sum(1 for r in rows if r["is_violation"] and not r["is_negative"]),
        "rows": rows,
    }


def _a(value: Any) -> str:
    """Escape for an HTML attribute (quotes included)."""
    return html.escape("" if value is None else str(value), quote=True)


def _t(value: Any) -> str:
    return html.escape("" if value is None else str(value))


def _stars(rating: Any) -> str:
    try:
        n = int(round(float(rating)))
    except (TypeError, ValueError):
        return ""
    n = max(0, min(5, n))
    return "★" * n + "☆" * (5 - n)


def _card(r: dict[str, Any]) -> str:
    initial = (r["reviewer"][:1] or "?").upper()
    blob = " ".join(str(r.get(k, "")) for k in ("title", "body", "reviewer", "asin", "product")).lower()

    if r["verified"] is True:
        verified = '<span class="tag ok">Verifizierter Kauf</span>'
    elif r["verified"] is False:
        verified = '<span class="tag warn">NICHT verifiziert</span>'
    else:
        verified = ""

    amazon_btn = (
        f'<a class="btn ghost" href="{_a(r["url"])}" target="_blank" rel="noopener">↗ Amazon</a>'
        if r["url"] else ""
    )

    if r["is_violation"]:
        cat = _CATEGORY_LABELS.get(r["violation_type"], _t(r["violation_type"]))
        badge = f'<span class="tag viol">{cat} · {r["confidence"]}</span>'
        details = (
            f'<div class="evid"><b>Beleg:</b> „{_t(r["evidence_quote"])}"<br>'
            f'<b>Richtlinie:</b> {_t(r["matched_guideline"])}<br>'
            f'<b>Meldetext:</b> {_t(r["justification"])}<br>'
            f'<b>Kanal:</b> {_t(r["channel"])}</div>'
        )
        checkbox = (
            f'<input type="checkbox" class="sel" '
            f'data-rid="{_a(r["review_id"])}" data-asin="{_a(r["asin"])}" data-url="{_a(r["url"])}" '
            f'data-type="{_a(r["violation_type"])}" data-ev="{_a(r["evidence_quote"])}" '
            f'data-just="{_a(r["justification"])}" data-channel="{_a(r["channel"])}">'
        )
        action = f'{amazon_btn}<button class="btn report" type="button">Für Meldung vormerken</button>'
    else:
        badge = '<span class="tag muted">Kein Richtlinienverstoß – nicht meldbar</span>'
        details = ""
        checkbox = '<input type="checkbox" class="sel" disabled title="Kein Verstoß – nicht meldbar">'
        action = amazon_btn

    return f"""<div class="card" data-viol="{1 if r['is_violation'] else 0}"
         data-stars="{_a(r['rating'])}" data-text="{_a(blob)}">
  <div class="sel-col">{checkbox}</div>
  <div class="body-col">
    <div class="head">
      <div class="who"><span class="avatar">{_t(initial)}</span>
        <span class="name">{_t(r['reviewer']) or '—'}</span></div>
      <div class="date">{_t(r['date'])}</div>
    </div>
    <div class="meta"><span class="stars">{_stars(r['rating'])}</span>
      <span class="rating">{_t(r['rating'])} / 5</span> {verified} {badge}</div>
    <div class="title">{_t(r['title'])}</div>
    <div class="text">{_t(r['body'])}</div>
    {details}
    <div class="foot">
      <span class="product">{_t(r['product'] or r['asin'])}</span>
      <span class="actions">{action}</span>
    </div>
  </div>
</div>"""


_TEMPLATE = """<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>amazon-review-guard — Dashboard</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 0; background: #f4f1ea; color: #1c1c1c; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 20px; }
  h1 { font-size: 1.35rem; margin: 0 0 4px; }
  .note { opacity: .7; font-size: .85rem; margin: 0 0 14px; }
  .cards { display: flex; flex-wrap: wrap; gap: 12px; margin: 14px 0; }
  .stat { background: #fff; border: 1px solid #0001; border-radius: 10px; padding: 12px 16px; min-width: 140px; }
  .stat .num { font-size: 1.6rem; font-weight: 700; }
  .stat .lbl { opacity: .65; font-size: .8rem; }
  .bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; background: #fff;
         border: 1px solid #0001; border-radius: 10px; padding: 10px 12px; position: sticky; top: 0; z-index: 5; }
  .bar input[type=search], .bar select { padding: 8px; border: 1px solid #0002; border-radius: 8px; }
  .bar input[type=search] { flex: 1; min-width: 200px; }
  .grow { flex: 1; }
  .card { display: flex; gap: 12px; background: #fff; border: 1px solid #0001;
          border-radius: 12px; padding: 14px 16px; margin: 10px 0; }
  .card[data-viol="1"] { border-left: 4px solid #e5484d; }
  .sel-col { padding-top: 2px; }
  .body-col { flex: 1; min-width: 0; }
  .head { display: flex; justify-content: space-between; align-items: center; }
  .who { display: flex; align-items: center; gap: 8px; }
  .avatar { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%;
            background: #333; color: #fff; font-size: .8rem; }
  .name { font-weight: 600; }
  .date { opacity: .6; font-size: .8rem; }
  .meta { margin: 6px 0; font-size: .85rem; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .stars { color: #f5a623; letter-spacing: 1px; }
  .title { font-weight: 700; margin: 4px 0; }
  .text { font-size: .92rem; }
  .evid { background: #e5484d0d; border: 1px solid #e5484d33; border-radius: 8px;
          padding: 8px 10px; margin: 8px 0; font-size: .85rem; }
  .foot { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; gap: 8px; }
  .product { font-size: .82rem; opacity: .7; }
  .tag { padding: 2px 8px; border-radius: 999px; font-size: .75rem; white-space: nowrap; }
  .tag.ok { background: #1f8b4c1a; color: #1f8b4c; }
  .tag.warn { background: #e5484d1a; color: #e5484d; }
  .tag.viol { background: #e5484d22; color: #e5484d; font-weight: 600; }
  .tag.muted { background: #0000000d; opacity: .7; }
  .btn { padding: 7px 12px; border-radius: 8px; border: 1px solid #0002; cursor: pointer;
         font-size: .82rem; background: #fff; }
  .btn.ghost { text-decoration: none; color: inherit; }
  .btn.report { background: #f5821f; color: #fff; border-color: #f5821f; }
  .catbox { background: #fff; border: 1px solid #0001; border-radius: 10px; padding: 12px 16px; }
  table { border-collapse: collapse; width: 100%; font-size: .88rem; }
  th, td { border-bottom: 1px solid #0001; padding: 6px 8px; text-align: left; }
  td.r, th.r { text-align: right; }
</style></head>
<body><div class="wrap">
  <h1>amazon-review-guard — Review-Dashboard</h1>
  <p class="note">Verstoß = nur klare, belegte Richtlinien-Verletzung (Konfidenz ≥ {{THRESHOLD}}).
     Sterne/Stimmung sind kein Signal. Melden nur erlaubt bei echten Verstößen — ehrliche
     negative Reviews sind „nicht meldbar". Nichts wird automatisch abgeschickt.</p>

  <div class="cards">{{STATCARDS}}</div>
  {{NOTE}}

  <div class="catbox">
    <b>Verstöße nach Kategorie (negative Reviews)</b>
    <table><tbody>{{CATROWS}}</tbody></table>
  </div>

  <h2 style="font-size:1.05rem; margin:18px 0 6px">Alle Reviews ({{TOTAL}})</h2>
  <div class="bar">
    <input type="search" id="q" placeholder="Titel, Text, Reviewer oder ASIN suchen…">
    <select id="stars">
      <option value="">Alle Sterne</option>
      <option value="1">1 ★</option><option value="2">2 ★</option><option value="3">3 ★</option>
      <option value="4">4 ★</option><option value="5">5 ★</option>
    </select>
    <label><input type="checkbox" id="onlyViol"> nur Verstöße</label>
    <span class="grow"></span>
    <button class="btn" type="button" id="selectAll">Alle Verstöße auswählen</button>
    <button class="btn report" type="button" id="export">Markierte exportieren (CSV)</button>
  </div>
  <div id="list">{{CARDS}}</div>
</div>
<script>
  var list = document.getElementById('list');
  var q = document.getElementById('q');
  var stars = document.getElementById('stars');
  var onlyViol = document.getElementById('onlyViol');

  function visible(card) {
    var term = q.value.toLowerCase();
    var s = stars.value;
    var isViol = card.dataset.viol === '1';
    if (onlyViol.checked && !isViol) return false;
    if (s && card.dataset.stars !== s) return false;
    if (term && card.dataset.text.indexOf(term) === -1) return false;
    return true;
  }
  function apply() {
    var cards = list.querySelectorAll('.card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].style.display = visible(cards[i]) ? '' : 'none';
    }
  }
  q.addEventListener('input', apply);
  stars.addEventListener('change', apply);
  onlyViol.addEventListener('change', apply);

  document.getElementById('selectAll').addEventListener('click', function () {
    var cards = list.querySelectorAll('.card');
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].style.display === 'none') continue;
      var cb = cards[i].querySelector('.sel');
      if (cb && !cb.disabled) cb.checked = true;
    }
  });

  function csvCell(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
  document.getElementById('export').addEventListener('click', function () {
    var checked = list.querySelectorAll('.sel:checked');
    var rows = [['review_id','asin','review_url','violation_type','evidence_quote','report_justification','recommended_channel']];
    for (var i = 0; i < checked.length; i++) {
      var c = checked[i].dataset;
      rows.push([c.rid, c.asin, c.url, c.type, c.ev, c.just, c.channel]);
    }
    if (rows.length === 1) { alert('Keine Reviews markiert.'); return; }
    var csv = rows.map(function (r) { return r.map(csvCell).join(','); }).join('\\n');
    var blob = new Blob([csv], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'report_candidates.csv';
    a.click();
  });
</script>
</body></html>"""


def render_html(stats: dict[str, Any]) -> str:
    s = stats
    pct = (100 * s["negative_violations"] / s["total_negative"]) if s["total_negative"] else 0
    statcards = [
        ("Reviews total", str(s["total"])),
        (f"Negativ (≤ {s['negative_max_rating']}★)", str(s["total_negative"])),
        ("Negativ &amp; Verstoß", f"{s['negative_violations']} ({pct:.0f}%)"),
        ("Negativ, kein Verstoß", str(s["negative_clean"])),
    ]
    statcards_html = "".join(
        f'<div class="stat"><div class="num">{v}</div><div class="lbl">{lbl}</div></div>'
        for lbl, v in statcards
    )
    catrows = "".join(
        f"<tr><td>{_CATEGORY_LABELS.get(t, _t(t))}</td><td class='r'>{c}</td></tr>"
        for t, c in sorted(s["by_type"].items(), key=lambda kv: -kv[1])
    ) or "<tr><td>—</td><td class='r'>0</td></tr>"

    note = ""
    if s["violations_in_non_negative"]:
        note = (
            f'<p class="note">Hinweis: zusätzlich {s["violations_in_non_negative"]} '
            "Verstoß/Verstöße in nicht-negativen Reviews (Verstöße sind unabhängig von der Bewertung).</p>"
        )

    cards = "\n".join(
        _card(r) for r in sorted(s["rows"], key=lambda x: (not x["is_violation"], -(x["confidence"] or 0)))
    ) or "<p>Keine Reviews.</p>"

    return (
        _TEMPLATE
        .replace("{{THRESHOLD}}", str(s["threshold"]))
        .replace("{{STATCARDS}}", statcards_html)
        .replace("{{NOTE}}", note)
        .replace("{{CATROWS}}", catrows)
        .replace("{{TOTAL}}", str(s["total"]))
        .replace("{{CARDS}}", cards)
    )


def run_dashboard(config: Config) -> dict[str, Any]:
    stats = compute_stats(config)
    out_path = config.path("dashboard")
    Path(out_path).write_text(render_html(stats), encoding="utf-8")
    stats["dashboard_path"] = out_path
    return stats
