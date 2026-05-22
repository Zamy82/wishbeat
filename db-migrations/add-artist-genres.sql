-- Migration: artist_genres-Spalte fuer Vibe-Match
-- Speichert die Genre-Tags des Kuenstler pro Wunsch / pro gespieltem Song.
-- Damit koennen wir berechnen, wie gut ein Wunsch zur aktuellen Stimmung passt.

ALTER TABLE song_requests
  ADD COLUMN IF NOT EXISTS artist_genres text[];

ALTER TABLE event_plays
  ADD COLUMN IF NOT EXISTS artist_genres text[];

-- Index fuer schnelles Lookup beim Vibe-Bilden (letzte N Plays eines Events)
CREATE INDEX IF NOT EXISTS event_plays_event_id_played_at_idx
  ON event_plays (event_id, played_at DESC);
