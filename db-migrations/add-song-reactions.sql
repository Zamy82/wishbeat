-- Live-Reactions / Crowd-Pulse
-- Gäste reagieren auf den aktuell laufenden Song mit 🔥 / 💃 / 😴.
-- DJ sieht aggregierte Stimmung live im Dashboard.

CREATE TABLE IF NOT EXISTS song_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  spotify_track_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  reaction TEXT NOT NULL CHECK (reaction IN ('fire', 'dance', 'meh')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Eine Reaction pro Gast pro Song. Wechsel = UPDATE der reaction-Spalte.
  UNIQUE (event_id, spotify_track_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_song_reactions_event_track
  ON song_reactions (event_id, spotify_track_id);

CREATE INDEX IF NOT EXISTS idx_song_reactions_created
  ON song_reactions (created_at DESC);

-- Row Level Security
ALTER TABLE song_reactions ENABLE ROW LEVEL SECURITY;

-- Jeder darf SELECT (für Live-Counts auf Gast-Seite)
DROP POLICY IF EXISTS "anyone_can_select_reactions" ON song_reactions;
CREATE POLICY "anyone_can_select_reactions"
  ON song_reactions FOR SELECT
  USING (true);

-- Jeder darf INSERT (Anonyme Reactions)
DROP POLICY IF EXISTS "anyone_can_insert_reactions" ON song_reactions;
CREATE POLICY "anyone_can_insert_reactions"
  ON song_reactions FOR INSERT
  WITH CHECK (true);

-- Jeder darf UPDATE seiner eigenen Reaction (Wechsel zwischen 🔥/💃/😴)
DROP POLICY IF EXISTS "anyone_can_update_reactions" ON song_reactions;
CREATE POLICY "anyone_can_update_reactions"
  ON song_reactions FOR UPDATE
  USING (true);

-- Jeder darf DELETE (Toggle-Off)
DROP POLICY IF EXISTS "anyone_can_delete_reactions" ON song_reactions;
CREATE POLICY "anyone_can_delete_reactions"
  ON song_reactions FOR DELETE
  USING (true);
