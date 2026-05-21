# wishbeat

> Gäste wünschen sich Songs beim DJ — über QR-Code, ohne Anstehen am DJ-Pult.

**wishbeat** ist eine Web-App für DJs auf Events (Hochzeiten, Geburtstage, Firmenfeiern).
Gäste scannen einen QR-Code am Tisch, suchen ihren Wunschsong direkt aus Spotify und
schicken ihn an den DJ. Der DJ sieht alle Wünsche live auf Laptop oder Tablet.

---

## Wie es funktioniert

1. **DJ legt ein neues Event an** (z.B. „Hochzeit Müller, 20.06.2026") — bekommt einen
   eigenen QR-Code zum Ausdrucken.
2. **Gäste scannen den QR-Code** am Tisch → die App öffnet sich im Browser.
3. **Gäste suchen einen Song** über die integrierte Spotify-Suche, sehen Cover und
   Künstler — und schicken ihren Wunsch ab.
4. **DJ sieht die Liste live** in seinem Dashboard und kann Wünsche annehmen,
   ablehnen oder in eine eigene Reihenfolge bringen.

---

## Roadmap

| Phase | Features |
|-------|----------|
| **MVP (jetzt)** | QR-Code pro Event, Spotify-Songsuche, DJ-Dashboard, Liste der Wünsche |
| **Phase 2** | Bezahl-Option: 50 ct → Wunsch landet in der Queue, 1 € → Wunsch wird sofort vorgemerkt |
| **Phase 3** | DJ-Assistent: erkennt den aktuell laufenden Spotify-Song und schlägt passende Folgesongs nach BPM und Stimmung vor |

---

## Tech Stack

- **Next.js 15** (TypeScript, App Router) — das Web-Framework
- **Tailwind CSS** — für das Styling
- **Supabase** — Datenbank und Login (für DJ-Bereich)
- **Spotify Web API** — Songsuche und später Playback-Erkennung
- **Vercel** — Hosting, automatisches Deployment aus GitHub
- **GitHub** — Code-Backup und Versionierung

---

## Lokal starten

```bash
# Abhängigkeiten installieren
npm install

# .env.local anlegen (siehe .env.example als Vorlage)
# - Spotify Client-ID und Secret eintragen
# - Supabase URL und Anon-Key eintragen

# Dev-Server starten
npm run dev
```

Die App läuft dann auf [http://localhost:3000](http://localhost:3000).

---

## Projektstruktur

```
wishbeat/
├── app/              ← Next.js App Router — alle Seiten und API-Routen
├── docs/             ← Architektur und Deployment-Anleitung
├── public/           ← statische Dateien (Bilder, Favicon)
├── tasks/            ← todo.md und lessons.md
├── CLAUDE.md         ← Workflow-Regeln für Claude
└── README.md         ← Diese Datei
```

---

## Nächste Schritte

Siehe [tasks/todo.md](tasks/todo.md) — dort steht der nächste konkrete Arbeitsschritt.
Für Deployment-Anleitung siehe [docs/deployment.md](docs/deployment.md).
