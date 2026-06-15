# amazon-review-guard

Eigenständige Python-Anwendung, die **Sportstech-Amazon-Rezensionen erkennt, die
gegen Amazons Community-Richtlinien verstoßen**, pro Verstoß ein meldefertiges
Beweis-Paket erstellt und einem Menschen hilft, die Meldungen **einzeln** und
**bestätigt** einzureichen.

**Sternebewertung und Stimmung sind kein Signal.** Eine ehrliche 1-Stern-Kritik
ist *kein* Verstoß. Gemeldet wird nur, was eine konkrete Amazon-Richtlinie
verletzt — mit wörtlichem Beleg und oberhalb einer einstellbaren Konfidenz-Schwelle.
Im Zweifel: kein Verstoß.

> Es wird **niemals** direkt von Amazon-Seiten gescraped. Die agentcentral-Quelle
> ist auf **Amazon.de (Deutschland)** beschränkt.

## Verstoß-Kategorien (die einzigen Melde-Gründe)

`profanity`, `hate_harassment`, `promotional`, `off_topic`, `private_info`,
`illegal_dangerous`, `plagiarized`, `fake_incentivized`. Alles andere ist
`not_a_violation`.

## Installation

```bash
cd amazon-review-guard
pip install -e .            # Laufzeit
pip install -e ".[dev]"     # inkl. pytest für die Tests
cp config.example.yaml config.yaml   # dann ASINs und Quelle anpassen
```

Python ≥ 3.10. Abhängigkeiten: `anthropic`, `openpyxl`, `PyYAML`, `requests`.

## Umgebungsvariablen (env vars)

| Variable | Pflicht | Wofür |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Ja** (für `classify`) | Zugriff auf die Claude-API für die Verstoß-Prüfung. |
| `REVIEW_DATA_API_KEY` | Nur bei `data_source.type: api` | Schlüssel des Drittanbieter-Rezensions-Dienstes (Name änderbar über `data_source.api.key_env`). |

Die **agentcentral**-Quelle braucht keine env var: erst die agentcentral-MCP-Tools
(`get_product_reviews`, optional `get_review_trends`) pro ASIN aufrufen, das
kombinierte JSON unter `data_source.agentcentral_path` speichern, dann
`review-guard fetch --source agentcentral` laufen lassen.

## CLI

Ein Einstiegspunkt `review-guard` mit Unterbefehlen:

```bash
review-guard fetch                 # Quelle laden + normalisieren  -> data/reviews.jsonl
review-guard classify              # Verstoß-Prüfung per Claude     -> data/classifications.jsonl
review-guard report                # Audit-Log + report_queue.xlsx
# ... ein Mensch trägt "y" in die Spalte approve (y/n) ein ...
review-guard submit                # nur freigegebene Zeilen, einzeln, mit Bestätigung
review-guard submit --mode assisted   # Claude in Chrome, Bestätigung vor jedem Absenden
review-guard submit --dry-run      # nur anzeigen, was offen ist
review-guard run                   # Erkennungs-Pipeline: fetch -> classify -> report
```

Nützliche Optionen: `-c/--config <pfad>` (Standard `./config.yaml`),
`fetch --source <csv|json|agentcentral|api>`, `classify --force`, `classify --limit N`.

Alternativ ohne Installation: `python -m review_guard <befehl>`.

## Datenquellen (`config.yaml` → `data_source.type`)

- `csv` / `json` — lokaler Export (`data_source.path`).
- `agentcentral` — JSON-Dump aus den agentcentral-MCP-Tools.
- `api` — Drittanbieter-API (`base_url` + `key_env`).

Normalisiertes Schema: `review_id, asin, rating, title, body, reviewer, date,
helpful_votes, url`.

## Zeitplanung (cron)

Nur die **Erkennung** (`run`) ist idempotent und automatisierbar. Die Meldung
(`submit`) bleibt bewusst menschlich gesteuert.

```cron
# Täglich 03:00 Uhr: fetch -> classify -> report.
0 3 * * * cd /pfad/zu/amazon-review-guard && \
  ANTHROPIC_API_KEY=sk-ant-... review-guard run >> output/cron.log 2>&1
```

## Ausgaben

| Pfad | Inhalt |
|---|---|
| `data/reviews.jsonl` | normalisierte Rezensionen |
| `data/classifications.jsonl` | Entscheidung pro Rezension (idempotenter Cache) |
| `output/audit_log.jsonl` | **jede** geprüfte Rezension + Entscheidung + Zeitstempel |
| `output/report_queue.xlsx` | nur Verstöße über der Schwelle, mit `approve (y/n)` |
| `output/report_actions.jsonl` | was über `submit` gemeldet/übersprungen wurde |

## Tests

```bash
pip install -e ".[dev]"
pytest
```

Die Tests laufen **ohne** API-Schlüssel — der Claude-Client wird in den
Klassifizierungs-Tests gemockt. Abgedeckt: Normalisierung/Dedup/ASIN-Filter,
idempotente Klassifizierung, Schwellen-Filter, Audit-Log, Freigabe-Gate.

## Compliance-Hinweis

- Es wird **nur** gemeldet, was eine konkrete Amazon-Richtlinie nachweislich
  verletzt — niemals auf Basis von Bewertung oder Stimmung.
- Konservativ: bei Unsicherheit kein Verstoß (Schwelle: `confidence_threshold`).
- Vollständiges Audit-Log jeder Entscheidung.
- Amazon hat **keine** offizielle API zum Melden von Rezensionen. Einreichung
  erfolgt **menschlich bestätigt und einzeln** — niemals automatisch in Masse.
- Secrets gehören in Umgebungsvariablen, nie in den Code oder ins Repo.

## Verhältnis zum Claude-Code-Skill

Dieselbe Logik existiert auch als Claude-Code-Skill unter
`.claude/skills/amazon-review-guard/` (für die Nutzung direkt aus Claude Code).
Dieses Verzeichnis ist die eigenständige, installier- und testbare Anwendung für
CLI, cron und CI.
