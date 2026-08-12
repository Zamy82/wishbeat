-- Migration: Vorab-Modus (wish_only)
-- Zweck: Ein Event kann vor der Party als "nur Wuensche sammeln" laufen.
--   wish_only = true  -> Gast-Seite zeigt nur Header + Hinweis + Wunsch-Eingabe
--                        (kein "Jetzt laeuft", keine Queue, kein Trinkgeld, keine Bewertung)
--   wish_only = false -> normale Live-Seite (Standard)
--
-- Wichtig: wish_only ist unabhaengig von is_active. Damit Gaeste ueberhaupt
-- Wuensche einreichen duerfen, muss das Event is_active = true sein (RLS-Policy).
-- Der Vorab-Modus ist also: is_active = true UND wish_only = true.
-- Am Party-Tag einfach wish_only wieder auf false stellen -> gleiche URL, gleicher QR.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS wish_only boolean DEFAULT false;
