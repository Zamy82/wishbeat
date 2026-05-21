# Deployment — wishbeat

> Schritt-für-Schritt-Anleitung um wishbeat live ins Internet zu bringen.
> Geschrieben für jemanden, der das zum ersten Mal macht.

---

## Was du brauchst (einmalig)

1. **Node.js** auf deinem Rechner — https://nodejs.org → "LTS" herunterladen und installieren
2. **GitHub-Account** — kostenlos auf https://github.com (falls noch nicht vorhanden)
3. **Vercel-Account** — kostenlos auf https://vercel.com (am besten gleich mit GitHub einloggen)
4. **Supabase-Account** — kostenlos auf https://supabase.com
5. **Spotify-Developer-Account** — https://developer.spotify.com (kostenlos, dein normales Spotify-Konto reicht)

---

## Schritt 1 — Projekt lokal starten

Öffne PowerShell im wishbeat-Ordner und führe aus:

```powershell
npm install
npm run dev
```

Im Browser öffnet sich `http://localhost:3000` — du solltest die wishbeat-Landing-Page sehen.

Wenn das funktioniert: **erster Meilenstein erreicht.** 🎉

---

## Schritt 2 — GitHub-Repo anlegen

1. Auf https://github.com einloggen
2. Oben rechts `+` → **New repository**
3. Eintragen:
   - **Repository name:** `wishbeat`
   - **Privacy:** Private (kann später öffentlich gemacht werden)
   - **NICHT** "Add a README" oder "Add .gitignore" anhaken (haben wir schon)
4. **Create repository** klicken

GitHub zeigt dir Befehle zum Push. Wir nehmen die unter „push an existing repository".
Führe in PowerShell im wishbeat-Ordner aus:

```powershell
git init
git add .
git commit -m "Initial commit: wishbeat Projektfundament"
git branch -M main
git remote add origin https://github.com/DEIN-USERNAME/wishbeat.git
git push -u origin main
```

(Ersetze `DEIN-USERNAME` durch deinen GitHub-Namen.)

---

## Schritt 3 — Vercel mit GitHub verbinden

1. Auf https://vercel.com einloggen (mit GitHub-Account)
2. **Add New...** → **Project**
3. Dein `wishbeat`-Repo auswählen → **Import**
4. **Framework Preset:** Next.js wird automatisch erkannt — alles auf Standard lassen
5. **Environment Variables** (kommt gleich) — erstmal leer lassen, **Deploy** klicken

Nach ~2 Minuten ist deine App live unter einer URL wie `https://wishbeat-xyz.vercel.app`.

> ⚠️ Beim ersten Deployment kommt die Seite zwar hoch, aber Features die Spotify/Supabase
> brauchen, funktionieren noch nicht. Das richten wir im nächsten Schritt ein.

---

## Schritt 4 — Supabase einrichten

1. Auf https://supabase.com einloggen → **New Project**
2. Name: `wishbeat`, Region: **Frankfurt** (oder eine andere EU-Region)
3. Datenbank-Passwort vergeben (sicher aufschreiben!)
4. Warten bis das Projekt erstellt ist (~2 Minuten)
5. Im Dashboard: **Settings** → **API**
   - **Project URL** kopieren
   - **anon public** Key kopieren

### Tabellen anlegen

Im Supabase-Dashboard: **SQL Editor** → **New Query**, dieses SQL einfügen und ausführen:

```sql
-- Events
create table events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  event_date date not null,
  slug text unique not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Wunschsongs
create table song_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  spotify_track_id text not null,
  title text not null,
  artist text not null,
  cover_url text,
  guest_nickname text,
  status text default 'pending' check (status in ('pending','approved','played','rejected')),
  created_at timestamptz default now()
);

-- Realtime für Wunschsongs einschalten
alter publication supabase_realtime add table song_requests;

-- Row Level Security einschalten
alter table events enable row level security;
alter table song_requests enable row level security;

-- Policies (wer darf was)
create policy "DJs sehen eigene Events" on events
  for select using (auth.uid() = owner_id);

create policy "DJs verwalten eigene Events" on events
  for all using (auth.uid() = owner_id);

create policy "Alle dürfen aktive Events lesen" on events
  for select using (is_active = true);

create policy "Alle dürfen Wünsche für aktive Events einreichen" on song_requests
  for insert with check (
    exists (select 1 from events where id = event_id and is_active = true)
  );

create policy "DJs sehen Wünsche eigener Events" on song_requests
  for select using (
    exists (select 1 from events where id = event_id and owner_id = auth.uid())
  );

create policy "DJs ändern Wünsche eigener Events" on song_requests
  for update using (
    exists (select 1 from events where id = event_id and owner_id = auth.uid())
  );
```

---

## Schritt 5 — Spotify Developer App anlegen

1. https://developer.spotify.com/dashboard → **Create app**
2. Eintragen:
   - **App name:** wishbeat
   - **App description:** DJ-Wunschsong-App für Events
   - **Redirect URI:** `http://localhost:3000/api/spotify/callback`
     (und später zusätzlich `https://DEIN-VERCEL-DOMAIN.vercel.app/api/spotify/callback`)
   - **Which API/SDKs:** Web API
3. **Settings** → Client-ID und Client-Secret kopieren

---

## Schritt 6 — Umgebungsvariablen in Vercel hinterlegen

Im Vercel-Dashboard: **Settings** → **Environment Variables**.

Folgende Variablen hinzufügen (Werte aus den vorherigen Schritten):

```
SPOTIFY_CLIENT_ID            = aus Spotify Developer Dashboard
SPOTIFY_CLIENT_SECRET        = aus Spotify Developer Dashboard
SPOTIFY_REDIRECT_URI         = https://DEIN-VERCEL-DOMAIN.vercel.app/api/spotify/callback
NEXT_PUBLIC_SUPABASE_URL     = aus Supabase Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY = aus Supabase Settings → API
SUPABASE_SERVICE_ROLE_KEY    = aus Supabase Settings → API (NUR Production, niemals Preview!)
```

Nach dem Speichern: Vercel-Dashboard → **Deployments** → das oberste Deployment → **Redeploy**.

---

## Schritt 7 — Lokal die gleichen Variablen setzen

Im wishbeat-Ordner:

```powershell
Copy-Item .env.example .env.local
```

Dann `.env.local` öffnen und die echten Werte eintragen (die gleichen wie in Vercel,
nur dass `SPOTIFY_REDIRECT_URI` lokal `http://localhost:3000/api/spotify/callback` ist).

`npm run dev` neu starten — alles sollte jetzt funktionieren.

---

## Was passiert bei jedem Push?

Sobald du etwas änderst und mit Git pushst:

```powershell
git add .
git commit -m "kurze Beschreibung"
git push
```

…baut Vercel automatisch eine neue Version und macht sie live (innerhalb von ~2 Minuten).

---

## Hilfe!

Wenn etwas hakt: Fehlermeldung in PowerShell oder im Vercel-Dashboard kopieren und
mit Claude besprechen. Niemals einfach im Code rumdrücken, wenn du nicht weißt was
du tust — wir haben CLAUDE.md und todo.md damit wir uns gegenseitig auf Spur halten.
