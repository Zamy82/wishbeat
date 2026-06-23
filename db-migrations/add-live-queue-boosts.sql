-- Live-Queue-Boosts
-- Gäste können kommende Spotify-Queue-Songs „pushen" — der DJ sieht
-- welche zukünftigen Tracks die Crowd antizipiert und kann vorziehen.

CREATE TABLE IF NOT EXISTS live_queue_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  spotify_track_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ein Boost pro Gast pro Track (Toggle on/off)
  UNIQUE (event_id, spotify_track_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_live_queue_boosts_event_track
  ON live_queue_boosts (event_id, spotify_track_id);

ALTER TABLE live_queue_boosts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_select_boosts" ON live_queue_boosts;
CREATE POLICY "anyone_can_select_boosts"
  ON live_queue_boosts FOR SELECT USING (true);

DROP POLICY IF EXISTS "anyone_can_insert_boosts" ON live_queue_boosts;
CREATE POLICY "anyone_can_insert_boosts"
  ON live_queue_boosts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anyone_can_delete_boosts" ON live_queue_boosts;
CREATE POLICY "anyone_can_delete_boosts"
  ON live_queue_boosts FOR DELETE USING (true);
