-- Migration: session_id an event_ratings — fuer "eine Bewertung pro Gast".
-- Wird von der Bewertungs-Server-Route (/api/events/[id]/rating) genutzt, um
-- serverseitig doppelte Bewertungen desselben Gastes zu verhindern.
-- Optional: die Route funktioniert auch ohne diese Spalte (Fallback), dann
-- greift das Dedup aber nicht. Fuer vollen Spam-Schutz einmal ausfuehren.

ALTER TABLE public.event_ratings ADD COLUMN IF NOT EXISTS session_id text;

CREATE INDEX IF NOT EXISTS idx_ratings_session
  ON public.event_ratings (event_id, session_id);
