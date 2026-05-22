-- wishbeat — DJ-Profil (für Trinkgeld-Daten) + Event-Bewertungen
-- Migration für Phase 2: Trinkgeld via SEPA-QR + Amazon-Style Bewertung

-- ---------------------------------------------------------------------------
-- DJ-Profil: speichert IBAN, Empfänger-Name, später PayPal etc.
-- ---------------------------------------------------------------------------
create table if not exists public.dj_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,        -- z.B. "DJ Zamy" — Name auf den Gäste klicken
  iban_holder text,         -- echter Kontoinhaber (für Bank-Überweisung)
  iban text,                -- IBAN, formatiert oder unformatiert
  bic text,                 -- optional, nicht nötig für rein deutsche IBANs
  paypal_handle text,       -- z.B. "zamy82" → paypal.me/zamy82 (später)
  updated_at timestamptz default now()
);

alter table public.dj_profiles enable row level security;

drop policy if exists "DJ sieht eigenes Profil" on public.dj_profiles;
drop policy if exists "DJ verwaltet eigenes Profil" on public.dj_profiles;
drop policy if exists "Alle dürfen Trinkgeld-Daten lesen wenn Event aktiv" on public.dj_profiles;

create policy "DJ sieht eigenes Profil" on public.dj_profiles
  for select using (auth.uid() = user_id);

create policy "DJ verwaltet eigenes Profil" on public.dj_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Gäste dürfen Trinkgeld-Daten lesen, wenn der DJ mindestens ein aktives Event hat
-- (damit die Event-Seite den GiroCode-QR generieren kann)
create policy "Alle dürfen Trinkgeld-Daten lesen wenn Event aktiv" on public.dj_profiles
  for select using (
    exists (
      select 1 from public.events
      where owner_id = dj_profiles.user_id and is_active = true
    )
  );

-- ---------------------------------------------------------------------------
-- Event-Bewertungen (Amazon-Style: 5 Sterne + Kommentar + Nickname optional)
-- ---------------------------------------------------------------------------
create table if not exists public.event_ratings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  rating int check (rating between 1 and 5) not null,
  comment text,
  nickname text,
  created_at timestamptz default now()
);

create index if not exists idx_ratings_event on public.event_ratings(event_id);
create index if not exists idx_ratings_created on public.event_ratings(created_at desc);

alter table public.event_ratings enable row level security;

drop policy if exists "Alle dürfen für aktive Events bewerten" on public.event_ratings;
drop policy if exists "DJ sieht Bewertungen eigener Events" on public.event_ratings;

create policy "Alle dürfen für aktive Events bewerten" on public.event_ratings
  for insert with check (
    exists (
      select 1 from public.events
      where id = event_id and is_active = true
    )
  );

create policy "DJ sieht Bewertungen eigener Events" on public.event_ratings
  for select using (
    exists (
      select 1 from public.events
      where id = event_id and owner_id = auth.uid()
    )
  );

-- Realtime aktivieren für Live-Updates im DJ-Dashboard
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'event_ratings'
  ) then
    alter publication supabase_realtime add table public.event_ratings;
  end if;
end $$;
