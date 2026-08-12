# Lessons — wishbeat

> Hier landet alles, was wir während des Projekts lernen. Fehler, Aha-Momente,
> Entscheidungen mit Begründung. Wird mit der Zeit ergänzt.

## Format
```
## YYYY-MM-DD — Kurztitel
**Was passiert ist:** ...
**Was wir gelernt haben:** ...
**Konsequenz fürs Projekt:** ...
```

---

## 2026-05-21 — Projekt gestartet
**Was passiert ist:** Zamy hatte die Idee einer Wunschsong-App für DJ-Events. Wir haben
in einem strukturierten Kickstart-Gespräch entschieden: Web-App (kein App-Store), erst
Gäste-Funktion (DJ-Assistent kommt später), Spotify-Suche statt Freitext, kostenlos
starten (Bezahlung Phase 2), eigener QR-Code pro Event.

**Was wir gelernt haben:** Es lohnt sich, vor dem ersten Code wirklich Fragen zu stellen.
Vier strategische Entscheidungen sparen später Tage an Arbeit.

**Konsequenz fürs Projekt:** MVP-Scope ist scharf abgegrenzt. Jedes Feature, das nicht
für „ein Gast wünscht sich einen Song und der DJ sieht ihn" gebraucht wird, ist Backlog.

## 2026-08-12 — Stille RLS-Löschfalle beim Wunschlisten-Reset
**Was passiert ist:** Der „Wunschliste löschen"-Button meldete Erfolg, löschte aber
nichts. Ursache: Für `song_requests` und `event_plays` gab es INSERT/SELECT/UPDATE-
Policies, aber keine DELETE-Policy. Postgres/RLS gibt bei verbotenem DELETE KEINEN
Fehler zurück — es werden einfach 0 Zeilen gelöscht. Die Route bekam `error = null`
und meldete `ok: true`.

**Was wir gelernt haben:** Fehlende RLS-Policies führen bei DELETE (und UPDATE) zu
stillem Nichtstun statt zu einer Fehlermeldung. Wenn „Löschen tut nichts" auftaucht,
zuerst prüfen, ob eine passende DELETE-Policy existiert. Neue Tabellen mit RLS immer
für ALLE nötigen Operationen (auch DELETE) mit Policies versehen.

**Konsequenz fürs Projekt:** Migration `db-migrations/add-delete-policies.sql` legt
owner-scoped DELETE-Policies für `song_requests` + `event_plays` an. Muss im Supabase
SQL-Editor ausgeführt werden (MCP-Zugriff in der Session gesperrt).
