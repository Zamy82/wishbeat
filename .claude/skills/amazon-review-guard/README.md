# amazon-review-guard

Findet Sportstech-Amazon-Rezensionen, die **gegen Amazons Community-Richtlinien
verstoßen**, erstellt für jeden Verstoß ein melde­fertiges Beweis-Paket und hilft
einem Menschen, die Meldungen einzeln einzureichen.

**Wichtig:** Sternebewertung und Stimmung (positiv/negativ) sind **kein** Signal.
Eine ehrliche 1-Stern-Kritik ist *kein* Verstoß. Gemeldet wird nur, was eine
konkrete Amazon-Richtlinie verletzt — mit wörtlichem Beleg und oberhalb einer
einstellbaren Konfidenz-Schwelle. Im Zweifel: kein Verstoß.

## Ablauf (Workflow)

```
fetch_reviews  →  classify  →  build_report  →  [Mensch markiert Zeilen]  →  report_helper
```

1. `fetch_reviews.py` lädt Rezensionen aus der konfigurierten Quelle und
   normalisiert sie nach `data/reviews.jsonl`.
2. `classify.py` prüft jede Rezension per Claude gegen die Richtlinien-Kategorien.
3. `build_report.py` schreibt das vollständige Audit-Log und die Melde-Warteschlange
   (`output/report_queue.xlsx`) — nur echte Verstöße über der Schwelle.
4. Ein Mensch öffnet `report_queue.xlsx` und trägt in der Spalte `approve (y/n)`
   ein `y` für jede Zeile ein, die gemeldet werden soll.
5. `report_helper.py` arbeitet nur die freigegebenen Zeilen ab — einzeln, mit
   Bestätigung. Es gibt **keine** Massen-Einreichung.

## Installation

```bash
cd .claude/skills/amazon-review-guard
pip install -r requirements.txt   # anthropic, openpyxl, PyYAML, requests
```

## Umgebungsvariablen (env vars)

| Variable | Pflicht | Wofür |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Ja** (für `classify.py`) | Zugriff auf die Claude-API für die Verstoß-Prüfung. |
| `REVIEW_DATA_API_KEY` | Nur bei `data_source.type: api` | API-Schlüssel des Drittanbieter-Rezensions-Dienstes. Name ist über `data_source.api.key_env` änderbar. |

Die **agentcentral**-Quelle braucht keine env var im Skript — sie nutzt den in
Claude Code konfigurierten agentcentral-MCP-Server (aktuell auf **Amazon.de /
Deutschland** beschränkt).

## Quelle wählen (`config.yaml` → `data_source.type`)

- `csv` — lokale CSV-Datei (`data_source.path`).
- `json` — lokale JSON-Datei (Liste oder `{"reviews": [...]}`).
- `agentcentral` — JSON-Dump, den die agentcentral-MCP-Tools erzeugt haben.
  Vorgehen: pro ASIN `mcp__agentcentral__get_product_reviews` (optional auch
  `mcp__agentcentral__get_review_trends`) aufrufen, das kombinierte JSON unter
  `data_source.agentcentral_path` speichern, dann `fetch_reviews.py` mit
  `type: agentcentral` ausführen.
- `api` — Drittanbieter-Rezensions-API (`base_url` + `key_env`). **Es wird
  niemals direkt von Amazon-Seiten gescraped.**

Normalisiertes Schema: `review_id, asin, rating, title, body, reviewer, date,
helpful_votes, url`.

## Ausführen

```bash
export ANTHROPIC_API_KEY=sk-ant-...

python scripts/fetch_reviews.py              # → data/reviews.jsonl
python scripts/classify.py                   # → data/classifications.jsonl
python scripts/build_report.py               # → output/report_queue.xlsx + audit_log.jsonl

# Mensch bearbeitet report_queue.xlsx (Spalte approve (y/n) = "y")

python scripts/report_helper.py              # manuell (Standard)
python scripts/report_helper.py --mode assisted   # Claude in Chrome, mit Bestätigung pro Meldung
python scripts/report_helper.py --dry-run    # nur anzeigen, was freigegeben/offen ist
```

Nützliche Flags:
- `fetch_reviews.py --source <csv|json|agentcentral|api>` überschreibt die Quelle.
- `classify.py --force` prüft alles neu; `--limit N` begrenzt einen Lauf.

## Zeitplanung (cron)

Nur die **Erkennung** (Schritte 1–3) ist idempotent und automatisierbar. Die
Meldung (Schritte 4–5) bleibt bewusst menschlich gesteuert.

```cron
# Täglich 03:00 Uhr: Rezensionen holen, prüfen, Warteschlange + Audit-Log bauen.
0 3 * * * cd /pfad/zu/.claude/skills/amazon-review-guard && \
  ANTHROPIC_API_KEY=sk-ant-... \
  python scripts/fetch_reviews.py && \
  python scripts/classify.py && \
  python scripts/build_report.py >> output/cron.log 2>&1
```

Danach prüft ein Mensch `report_queue.xlsx` und führt `report_helper.py` aus.

## Dateien & Ausgaben

| Pfad | Inhalt |
|---|---|
| `data/reviews.jsonl` | normalisierte Rezensionen |
| `data/classifications.jsonl` | Entscheidung pro Rezension (idempotenter Cache) |
| `output/audit_log.jsonl` | **jede** geprüfte Rezension + Entscheidung + Zeitstempel |
| `output/report_queue.xlsx` | nur Verstöße über der Schwelle, mit `approve (y/n)` |
| `output/report_actions.jsonl` | was über `report_helper.py` gemeldet/übersprungen wurde |

## Compliance-Hinweis

- Es wird **nur** gemeldet, was eine bestimmte Amazon-Richtlinie nachweislich
  verletzt — niemals auf Basis von Bewertung oder Stimmung.
- Konservativ: bei Unsicherheit kein Verstoß. Schwelle in `config.yaml`
  (`confidence_threshold`).
- Vollständiges Audit-Log jeder Entscheidung.
- Amazon hat **keine** offizielle API zum Melden von Rezensionen. Einreichung
  erfolgt daher **menschlich bestätigt und einzeln** — niemals automatisch in
  Masse.
- Secrets gehören in Umgebungsvariablen, nie in den Code oder ins Repo.
