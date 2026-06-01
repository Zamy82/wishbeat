-- Migration: Voting fuer Wuensche
-- Erlaubt Gaesten andere Wuensche zu pushen ("+1"). DJ sieht die heissesten oben.
-- Pro Gast (session_id) maximal 1 Vote pro Wunsch (Unique-Constraint).

CREATE TABLE IF NOT EXISTS song_request_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES song_requests(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, session_id)
);

CREATE INDEX IF NOT EXISTS song_request_votes_request_id_idx
  ON song_request_votes (request_id);

CREATE INDEX IF NOT EXISTS song_request_votes_session_idx
  ON song_request_votes (session_id);

-- RLS aktivieren — anonyme Gaeste duerfen lesen + voten
ALTER TABLE song_request_votes ENABLE ROW LEVEL SECURITY;

-- Jeder darf alle Votes lesen (fuer Vote-Counts in UI)
DROP POLICY IF EXISTS "votes_select_all" ON song_request_votes;
CREATE POLICY "votes_select_all" ON song_request_votes
  FOR SELECT USING (true);

-- Jeder darf voten (anonym, mit eigener session_id)
DROP POLICY IF EXISTS "votes_insert_any" ON song_request_votes;
CREATE POLICY "votes_insert_any" ON song_request_votes
  FOR INSERT WITH CHECK (true);

-- Jeder darf seinen eigenen Vote loeschen (Toggle-Off)
-- session_id-Check passiert serverseitig vor dem Delete
DROP POLICY IF EXISTS "votes_delete_any" ON song_request_votes;
CREATE POLICY "votes_delete_any" ON song_request_votes
  FOR DELETE USING (true);

-- Realtime fuer Votes aktivieren (fuer Live-Updates auf Gaeste-Seite)
-- Falls die Publication noch nicht existiert: einmalig aktivieren in Supabase UI
-- (Database > Publications > supabase_realtime > Tables > song_request_votes anhaken)
