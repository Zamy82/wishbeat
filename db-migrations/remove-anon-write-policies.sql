-- Security (M1/M2): anonyme INSERT-Policies entfernen.
--
-- Wuensche und Bewertungen kommen jetzt ausschliesslich ueber die
-- serverseitigen Routen rein (/api/events/[id]/wish und /rating) — mit
-- Rate-Limit, status='pending' und Laengen-Limits. Die alten anon-INSERT-
-- Policies erlaubten aber weiterhin einen Direct-Insert per oeffentlichem
-- Anon-Key, was das serverseitige Rate-Limit umgehbar machte.
--
-- Nach dem Entfernen ist der einzige Schreibweg die Service-Role-Route.
--
-- WICHTIG: Erst NACH dem Deploy der Routen-Version ausfuehren (sonst koennen
-- Gaeste kurzzeitig nicht wuenschen/bewerten).

DROP POLICY IF EXISTS "Alle dürfen Wünsche einreichen" ON public.song_requests;
DROP POLICY IF EXISTS "Alle dürfen für aktive Events bewerten" ON public.event_ratings;
