-- wishbeat — Spotify-OAuth-Tokens pro DJ
-- Speichert Access- und Refresh-Token des Spotify-Premium-Accounts.

create table if not exists public.spotify_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  updated_at timestamptz default now()
);

alter table public.spotify_tokens enable row level security;

drop policy if exists "User sieht eigene Tokens" on public.spotify_tokens;
drop policy if exists "User verwaltet eigene Tokens" on public.spotify_tokens;

create policy "User sieht eigene Tokens" on public.spotify_tokens
  for select using (auth.uid() = user_id);

create policy "User verwaltet eigene Tokens" on public.spotify_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
