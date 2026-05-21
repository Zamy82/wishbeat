# CLAUDE.md — wishbeat

Diese Datei enthält die Workflow-Regeln für Claude in diesem Projekt.

---

## Projekt

**wishbeat** — Web-App, mit der Gäste auf Events (Hochzeiten, Geburtstage) per QR-Code
Wunschsongs an den DJ schicken können. Der DJ sieht alle Wünsche live in einem Dashboard
und kann sie annehmen, ablehnen oder sortieren.

**Phase 1 (MVP):** Wunschsong-Funktion ohne Bezahlung, Spotify-Songsuche, Event-Verwaltung
mit eigenem QR-Code pro Event.

**Phase 2 (geplant):** Bezahlung (50 ct Queue / 1 € Sofort), QR-Codes pro Tisch.

**Phase 3 (geplant):** DJ-Assistent — erkennt den aktuell auf Spotify Premium laufenden
Song und schlägt passende Folgesongs nach BPM/Stimmung vor.

---

## Tech Stack

- **Next.js 15** mit App Router
- **TypeScript** (strikt)
- **Tailwind CSS** für Styling
- **Supabase** (PostgreSQL + Auth) für Events, Wunschsongs, Nutzer
- **Spotify Web API** für Songsuche und (später) Playback-Status
- **Vercel** für Hosting
- **GitHub** für Versionierung und Deployment-Trigger

---

## Arbeitsweise

### Plan zuerst, bauen zweitens
Bei jeder nicht-trivialen Aufgabe **zuerst kurz den Plan in Worten beschreiben**,
dann erst Code schreiben. Bei einfachen Änderungen (Tippfehler, Farbe anpassen)
direkt umsetzen.

### Kleine, nachvollziehbare Schritte
- Eine Sache pro Commit
- Nach jedem fertigen Feature: `tasks/todo.md` aktualisieren
- Bei Erkenntnissen oder Fehlern: `tasks/lessons.md` ergänzen

### Sprache
- **Code und Variablen:** Englisch
- **Code-Kommentare:** Englisch, sparsam (nur wenn das WARUM nicht offensichtlich ist)
- **README, Dokumentation, Commit-Messages:** Deutsch
- **Kommunikation mit Zamy:** Deutsch, ohne Fachjargon-ohne-Erklärung

### Sicherheit
- API-Keys gehören **nur** in `.env.local` (lokal) bzw. Vercel Environment Variables
- Niemals Secrets in den Code oder ins Repo committen
- Spotify-Tokens und Supabase-Service-Keys serverseitig halten (nicht im Browser-Code)

---

## Wichtige Konventionen

### Datenmodell (Supabase)
- `events` — pro DJ-Event ein Eintrag (Name, Datum, QR-Code-Slug, aktiv ja/nein)
- `song_requests` — Wunschsongs pro Event (Spotify-Track-ID, Titel, Künstler, Status)
- Status-Werte für Wünsche: `pending`, `approved`, `played`, `rejected`

### Routing
- `/` — Landing-Page (kurze Erklärung, Login für DJ)
- `/event/[slug]` — Gäste-Ansicht für ein Event (Songsuche + Wunsch absenden)
- `/dj` — DJ-Dashboard (geschützt, Liste aller Events)
- `/dj/event/[id]` — Live-Liste der Wünsche für ein laufendes Event

### Design-Prinzipien
- Modern, dunkel, Party-Vibe (Neon-Akzente: Pink/Lila/Cyan)
- Mobile-first für Gäste-Ansicht (große Tap-Targets)
- Desktop-optimiert für DJ-Dashboard

---

## Was Claude NICHT tun soll

- Keine Bezahl-Logik bauen, solange MVP nicht steht
- Keine native iOS/Android-App-Code anlegen — wir bleiben bei Web
- Keine neuen Abhängigkeiten installieren ohne kurz zu fragen warum
- Keine Refactorings, die nicht von Zamy angefragt wurden
- Nicht ungefragt Test-Frameworks, Storybook, Linter-Konfigs etc. dazustellen — erst wenn Bedarf da ist

---

## Wenn du nicht weiterkommst

Frage. Lieber eine Frage zu viel als eine falsche Annahme. Zamy ist kein
Profi-Entwickler — wenn etwas erklärt werden muss, erkläre es kurz und klar.
