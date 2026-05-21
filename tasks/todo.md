# TODO — wishbeat

## Setup (erledigt vom Kickstart)
- [x] CLAUDE.md angelegt
- [x] Projektstruktur erstellt (app/, tasks/, docs/, public/)
- [x] README.md auf Deutsch geschrieben
- [x] Next.js Pflichtdateien (package.json, tsconfig, next.config, tailwind, layout, globals.css, page.tsx)
- [x] .gitignore und .env.example angelegt
- [x] Architektur- und Deployment-Doku in docs/

## Phase 0 — Erste Schritte
- [x] GitHub-Repo angelegt und Code gepusht (github.com/Zamy82/wishbeat)
- [x] Vercel mit GitHub verbunden
- [x] Supabase-Projekt angelegt, Schema eingespielt
- [x] Spotify Developer App angelegt
- [x] Alle Env-Vars in Vercel hinterlegt
- [x] App ist LIVE: https://wishbeat-zamy82-s-projects.vercel.app

## Phase 1 — MVP Gäste-Wunschsong-App

### Datenbank (Supabase)
- [ ] Supabase-Projekt anlegen (kostenlos)
- [ ] Tabellen `events` und `song_requests` erstellen (Schema siehe docs/architektur.md)
- [ ] URL und Anon-Key in `.env.local` eintragen
- [ ] In Vercel die gleichen Umgebungsvariablen hinterlegen

### Spotify-Anbindung
- [ ] Spotify Developer App anlegen
- [ ] Client-ID und Secret in `.env.local` eintragen
- [ ] API-Route `/api/spotify/search` bauen — sucht Songs über Spotify Web API
- [ ] Token-Caching serverseitig (Spotify-Token ist 1 Stunde gültig)

### Gäste-Ansicht (öffentlich, via QR-Code)
- [ ] Seite `/event/[slug]` anlegen — zeigt Event-Name und Suchfeld
- [ ] Spotify-Suche mit Cover-Bildern (Live-Suche während des Tippens)
- [ ] "Wunsch absenden"-Button → speichert in Supabase
- [ ] Bestätigungs-Meldung („Dein Wunsch ist beim DJ angekommen 🎉")
- [ ] Optional: Nickname-Feld, damit der DJ weiß von wem der Wunsch kommt

### DJ-Login + Dashboard
- [ ] Supabase Auth einrichten (Magic Link per Mail)
- [ ] Seite `/dj` — Liste aller eigenen Events, Button „Neues Event anlegen"
- [ ] Event-Erstellung mit Name, Datum, automatisch generiertem Slug
- [ ] Seite `/dj/event/[id]` — Live-Liste der Wünsche
  - [ ] Realtime-Updates (Supabase Realtime) — neue Wünsche poppen sofort auf
  - [ ] Buttons: Annehmen, Ablehnen, Als gespielt markieren
- [ ] QR-Code-Generierung für jedes Event (Download als PNG zum Ausdrucken)

### Polish
- [ ] Landing-Page (`/`) — kurze Erklärung + Login-Button für DJ
- [ ] Mobile-Optimierung der Gäste-Ansicht testen
- [ ] Loading-States und Fehlermeldungen einbauen
- [ ] Ein Event testweise mit Freunden laufen lassen

## Phase 2 — Bezahl-Funktion (später)
- [ ] Stripe-Integration einrichten (Stripe Account anlegen)
- [ ] Zwei Tier-Optionen: 50 ct (Queue) / 1 € (Sofort)
- [ ] Bezahlungs-Status im DJ-Dashboard anzeigen
- [ ] Auszahlung an DJ klären (Stripe Connect oder Sammelkonto)

## Phase 3 — DJ-Assistent (später)
- [ ] Spotify "Currently Playing" abrufen
- [ ] BPM und Audio-Features des aktuellen Songs holen
- [ ] Empfehlungs-Algorithmus: ähnliches BPM (+/- 5), passende Energy/Valence
- [ ] Vorschlagsliste live im Dashboard

## Backlog (Ideen für später)
- [ ] QR-Code pro Tisch (mit Tisch-Nummer im Wunsch)
- [ ] "Top-Wunsch" durch Voting (mehrere Gäste boosten denselben Song)
- [ ] Profanity-Filter / Wunsch-Limit pro Gast
- [ ] Branding pro Event (Brautpaar-Foto, Geburtstagskind-Name)
- [ ] Statistik nach dem Event: meistgespielte Genres, durchschnittliche BPM
