-- Migration: Loesch-Regeln (DELETE-Policies) fuer Reset
--
-- Problem: Der "Wunschliste loeschen"-Button ruft /api/events/[id]/reset auf,
-- die Route loescht mit der DJ-Login-Sitzung aus song_requests + event_plays.
-- Es gab dafuer aber keine DELETE-Policy -> RLS blockt still, es werden 0 Zeilen
-- geloescht, KEIN Fehler kommt zurueck. Der Button meldet Erfolg, nichts passiert.
--
-- Fix: DJ darf Wuensche + Play-History SEINER eigenen Events loeschen.
-- Ownership laeuft ueber events.owner_id = auth.uid().

-- song_requests: DJ loescht Wuensche eigener Events
DROP POLICY IF EXISTS "DJs loeschen Wuensche eigener Events" ON public.song_requests;
CREATE POLICY "DJs loeschen Wuensche eigener Events" ON public.song_requests
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_id AND owner_id = auth.uid()
    )
  );

-- event_plays: DJ loescht Play-History eigener Events
DROP POLICY IF EXISTS "DJs loeschen Plays eigener Events" ON public.event_plays;
CREATE POLICY "DJs loeschen Plays eigener Events" ON public.event_plays
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_id AND owner_id = auth.uid()
    )
  );
