# Architektur — wishbeat

## Überblick

```
            ┌──────────────────────┐
            │  Gast am Tisch       │
            │  (Smartphone)        │
            └──────────┬───────────┘
                       │ scannt QR-Code
                       ▼
          ┌────────────────────────────┐
          │  Next.js Web-App (Vercel)  │
          │  /event/[slug]             │
          └─────┬─────────────────┬────┘
                │                 │
        Songsuche                Wunsch speichern
                │                 │
                ▼                 ▼
       ┌────────────────┐  ┌────────────────┐
       │  Spotify API   │  │   Supabase     │
       │  (Search)      │  │   (Postgres)   │
       └────────────────┘  └────────┬───────┘
                                    │
                                    │ Realtime
                                    ▼
                          ┌──────────────────────┐
                          │  DJ-Dashboard        │
                          │  (Laptop/Tablet)     │
                          │  /dj/event/[id]      │
                          └──────────────────────┘
```

## Komponenten

### Next.js App (Vercel)
Die Web-App besteht aus zwei großen Bereichen:

- **Öffentlich** — Landing-Page (`/`) und Event-Seite (`/event/[slug]`).
  Kein Login nötig, Gäste landen über QR-Code direkt auf der Event-Seite.
- **Geschützt (DJ-Bereich)** — Dashboard (`/dj`) und Event-Detail (`/dj/event/[id]`).
  Nur mit Login (Supabase Auth) erreichbar.

API-Routen liegen unter `/api/`:
- `/api/spotify/search?q=...` — Songsuche, ruft Spotify Web API mit serverseitigem Token auf
- `/api/spotify/callback` — OAuth-Callback (für Phase 3, wenn wir Playback abfragen)

### Supabase (Datenbank)

**Tabelle `events`**
| Spalte       | Typ          | Beschreibung                                     |
|--------------|--------------|--------------------------------------------------|
| id           | uuid (PK)    | eindeutige Event-ID                              |
| owner_id     | uuid (FK)    | Verweis auf den DJ (Supabase Auth-User)          |
| name         | text         | „Hochzeit Müller"                                |
| event_date   | date         | Datum des Events                                 |
| slug         | text unique  | URL-Slug für QR-Code (z.B. `mueller-2026-06-20`) |
| is_active    | boolean      | true während des Events, false danach            |
| created_at   | timestamptz  | automatisch                                      |

**Tabelle `song_requests`**
| Spalte           | Typ         | Beschreibung                                     |
|------------------|-------------|--------------------------------------------------|
| id               | uuid (PK)   |                                                  |
| event_id         | uuid (FK)   | Verweis auf das Event                            |
| spotify_track_id | text        | Spotify-Track-ID (z.B. `4iV5W9uYEdYUVa79Axb7Rh`) |
| title            | text        | Songtitel (Cache für schnelle Anzeige)           |
| artist           | text        | Künstler (Cache)                                 |
| cover_url        | text        | URL zum Album-Cover (Cache)                      |
| guest_nickname   | text null   | optional, wenn der Gast sich identifiziert       |
| status           | text        | `pending` / `approved` / `played` / `rejected`   |
| created_at       | timestamptz | automatisch                                      |

**Realtime:** Auf `song_requests` ist Supabase Realtime aktiviert, damit das
DJ-Dashboard ohne Reload neue Wünsche sieht.

**Row Level Security (RLS):**
- `events`: nur der `owner_id` darf eigene Events sehen/ändern
- `song_requests` lesen: öffentlich für die jeweilige Event-Seite (nur für aktives Event)
- `song_requests` schreiben: öffentlich, aber Rate-Limit per IP (gegen Spam)

### Spotify Web API

Wir nutzen den **Client Credentials Flow** für die Songsuche — das ist ein
serverseitiger Login, der ohne Nutzer-Konto funktioniert (für die Suche reicht das).

Für **Phase 3** (Erkennung des aktuell laufenden Songs) brauchen wir den
**Authorization Code Flow** mit Zamys Premium-Account — das richten wir später ein.

### Vercel (Hosting)

- Automatisches Deployment bei jedem Push auf den `main`-Branch
- Preview-Deployments für andere Branches (zum Testen)
- Umgebungsvariablen werden im Vercel-Dashboard hinterlegt (nicht im Code!)

## Sicherheits-Prinzipien

1. **Kein Secret im Browser** — Spotify-Secret und Supabase-Service-Key liegen
   ausschließlich serverseitig (API-Routen). Der Browser sieht nur den Supabase
   Anon-Key, der durch RLS abgesichert ist.
2. **Rate-Limiting** für die öffentliche Wunsch-Einreichung (z.B. max. 5 Wünsche
   pro IP pro Minute) — beugt Spam vor.
3. **Slugs statt IDs** in der URL — niemand kann durch Zählen fremde Events finden.
4. **`is_active`-Flag** verhindert, dass alte Events nach dem Fest noch
   Wunschsongs annehmen.

## Geplante Erweiterungen

Diese sind heute **nicht** im Scope, werden aber bei Design-Entscheidungen mitgedacht:

- **Bezahl-Tier** (Phase 2): zusätzliche Spalte `payment_tier` (`free` / `queue` / `instant`)
  und `payment_status` in `song_requests`.
- **Tisch-Codes**: optionale Spalte `table_label` in `song_requests`, plus
  Sub-Slug `/event/[slug]/t/[table]` für tischgenaue QR-Codes.
- **DJ-Assistent** (Phase 3): separate Komponente im Dashboard, ruft `/api/spotify/now-playing`
  und `/api/spotify/recommendations` auf.
