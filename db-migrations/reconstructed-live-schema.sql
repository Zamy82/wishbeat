-- ============================================================================
-- Rekonstruiertes Live-Schema — aus dem Code abgeleitet (Stand 2026-08-14)
-- ============================================================================
-- Diese Tabellen/Spalten/Policies existierten bisher NUR live in Supabase und
-- fehlten im Repo (Schema-Drift, Audit-Finding H1). Damit ist das Repo wieder
-- reproduzierbar (wichtig fuer Rebuild / Verkauf / Audit).
--
-- HINWEIS: Diese Datei dokumentiert den Ist-Zustand fuer einen sauberen Rebuild.
-- Gegen die BESTEHENDE Live-DB muss sie NICHT ausgefuehrt werden — die Objekte
-- existieren dort bereits. Alles ist idempotent (if not exists / drop-if-exists),
-- ein Lauf gegen live waere also gefahrlos. Gold-Standard zur exakten
-- Verifikation: pg_dump --schema-only der Live-DB.

-- ---------------------------------------------------------------------------
-- event_plays — gespielte Songs (Statistik, Setlist, Vibe-Bildung)
-- ---------------------------------------------------------------------------
create table if not exists public.event_plays (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  spotify_track_id text not null,
  title text not null,
  artist text not null,
  cover_url text,
  source text not null default 'auto' check (source in ('wish', 'auto')),
  request_id uuid references public.song_requests(id) on delete set null,
  played_at timestamptz default now(),
  artist_genres text[]
);
create index if not exists event_plays_event_id_played_at_idx
  on public.event_plays (event_id, played_at desc);

alter table public.event_plays enable row level security;

drop policy if exists "DJ sieht Plays eigener Events" on public.event_plays;
create policy "DJ sieht Plays eigener Events" on public.event_plays
  for select using (
    exists (select 1 from public.events where id = event_id and owner_id = auth.uid())
  );

drop policy if exists "DJ traegt Plays eigener Events ein" on public.event_plays;
create policy "DJ traegt Plays eigener Events ein" on public.event_plays
  for insert with check (
    exists (select 1 from public.events where id = event_id and owner_id = auth.uid())
  );
-- DELETE-Policy siehe db-migrations/add-delete-policies.sql

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'event_plays'
  ) then
    alter publication supabase_realtime add table public.event_plays;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- push_subscriptions — Web-Push-Abos (Gast + DJ)
-- Zugriff ausschliesslich ueber Service-Role (push/*-Routen) -> keine anon-Policy.
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  session_id text,
  event_id uuid references public.events(id) on delete cascade,
  user_agent text,
  created_at timestamptz default now()
);
create index if not exists idx_push_event on public.push_subscriptions(event_id);

alter table public.push_subscriptions enable row level security;

-- ---------------------------------------------------------------------------
-- booking_requests — Buchungsanfragen von Gaesten an den DJ
-- Insert ueber Service-Role (booking-request-Route). DJ liest/aendert eigene.
-- ---------------------------------------------------------------------------
create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  dj_user_id uuid references auth.users(id) on delete cascade not null,
  referrer_event_id uuid references public.events(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  event_date date,
  event_type text,
  guest_count int,
  location text,
  message text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'booked', 'declined')),
  created_at timestamptz default now()
);
create index if not exists idx_bookings_dj on public.booking_requests(dj_user_id);

alter table public.booking_requests enable row level security;

drop policy if exists "DJ sieht eigene Buchungsanfragen" on public.booking_requests;
create policy "DJ sieht eigene Buchungsanfragen" on public.booking_requests
  for select using (auth.uid() = dj_user_id);

drop policy if exists "DJ aendert eigene Buchungsanfragen" on public.booking_requests;
create policy "DJ aendert eigene Buchungsanfragen" on public.booking_requests
  for update using (auth.uid() = dj_user_id);

-- ---------------------------------------------------------------------------
-- Fehlende Spalten (im Code genutzt, aber ohne Migration im Repo)
-- ---------------------------------------------------------------------------
-- Gast-Session pro Wunsch (Cooldown / Wunsch-Limit / Dedup):
alter table public.song_requests add column if not exists requester_session_id text;
create index if not exists idx_requests_session
  on public.song_requests(event_id, requester_session_id);

-- Setlist-/Erinnerungs-Playlist-URL am Event:
alter table public.events add column if not exists memory_playlist_url text;

-- ---------------------------------------------------------------------------
-- Oeffentliche Lese-Policies (im Code benoetigt, fehlten im Repo)
-- ---------------------------------------------------------------------------
-- Gaeste sehen die Wunschliste eines AKTIVEN Events (Voting-Liste):
drop policy if exists "Alle lesen Wuensche aktiver Events" on public.song_requests;
create policy "Alle lesen Wuensche aktiver Events" on public.song_requests
  for select using (
    exists (select 1 from public.events where id = event_id and is_active = true)
  );

-- Bewertungen sind oeffentlich lesbar (oeffentliche DJ-Reviews auf der Gast-Seite):
drop policy if exists "Alle lesen Bewertungen" on public.event_ratings;
create policy "Alle lesen Bewertungen" on public.event_ratings
  for select using (true);
