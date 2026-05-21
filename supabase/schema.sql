-- wishbeat — Datenbank-Schema
-- Einmalig in der Supabase SQL-Konsole ausführen.
-- Legt Tabellen events + song_requests an, schaltet RLS und Realtime ein.

-- ---------------------------------------------------------------------------
-- Tabelle: events
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  event_date date not null,
  slug text unique not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_events_slug on public.events(slug);
create index if not exists idx_events_owner on public.events(owner_id);

-- ---------------------------------------------------------------------------
-- Tabelle: song_requests
-- ---------------------------------------------------------------------------
create table if not exists public.song_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  spotify_track_id text not null,
  title text not null,
  artist text not null,
  cover_url text,
  guest_nickname text,
  status text default 'pending' check (status in ('pending','approved','played','rejected')),
  created_at timestamptz default now()
);

create index if not exists idx_requests_event on public.song_requests(event_id);
create index if not exists idx_requests_status on public.song_requests(status);

-- ---------------------------------------------------------------------------
-- Realtime für Live-Updates im DJ-Dashboard aktivieren
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'song_requests'
  ) then
    alter publication supabase_realtime add table public.song_requests;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.song_requests enable row level security;

-- DROP existing policies (idempotent)
drop policy if exists "DJs sehen eigene Events" on public.events;
drop policy if exists "DJs verwalten eigene Events" on public.events;
drop policy if exists "Alle dürfen aktive Events lesen" on public.events;
drop policy if exists "Alle dürfen Wünsche einreichen" on public.song_requests;
drop policy if exists "DJs sehen Wünsche eigener Events" on public.song_requests;
drop policy if exists "DJs ändern Wünsche eigener Events" on public.song_requests;

-- Events: DJ sieht und verwaltet eigene Events
create policy "DJs sehen eigene Events" on public.events
  for select using (auth.uid() = owner_id);

create policy "DJs verwalten eigene Events" on public.events
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Events: Gäste dürfen aktive Events lesen (für die Event-Seite per Slug)
create policy "Alle dürfen aktive Events lesen" on public.events
  for select using (is_active = true);

-- Wünsche: Gäste dürfen für aktive Events Wünsche einreichen
create policy "Alle dürfen Wünsche einreichen" on public.song_requests
  for insert
  with check (
    exists (
      select 1 from public.events
      where id = event_id and is_active = true
    )
  );

-- Wünsche: DJ sieht und ändert Wünsche seiner Events
create policy "DJs sehen Wünsche eigener Events" on public.song_requests
  for select using (
    exists (
      select 1 from public.events
      where id = event_id and owner_id = auth.uid()
    )
  );

create policy "DJs ändern Wünsche eigener Events" on public.song_requests
  for update using (
    exists (
      select 1 from public.events
      where id = event_id and owner_id = auth.uid()
    )
  );

-- Fertig — Schema ist eingerichtet.
