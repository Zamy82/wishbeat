-- Security-Fix: oeffentliche Lese-Policy auf dj_profiles entfernen.
--
-- Problem: Die Policy "Alle duerfen Trinkgeld-Daten lesen wenn Event aktiv"
-- (aus 003_dj_profiles_and_ratings.sql) erlaubte JEDEM per oeffentlichem
-- Anon-Key, iban / iban_holder / bic / paypal_handle aller DJs mit aktivem
-- Event auszulesen — auch ohne je auf einer Event-Seite gewesen zu sein.
--
-- Fix: Die Event-Seite liest das DJ-Profil jetzt serverseitig mit Service-Role
-- (lib/supabase/admin.ts), nur fuer das konkrete Event. Die oeffentliche Policy
-- wird daher nicht mehr gebraucht und entfernt. Die eigene-Profil-Policy
-- ("DJ sieht eigenes Profil", auth.uid() = user_id) bleibt bestehen.
--
-- WICHTIG: Erst NACHDEM der neue Code deployed ist ausfuehren, damit die
-- Trinkgeld-Sektion nahtlos weiterlaeuft.

DROP POLICY IF EXISTS "Alle dürfen Trinkgeld-Daten lesen wenn Event aktiv" ON public.dj_profiles;
