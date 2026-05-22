import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { computeVibeTokens, matchPercent } from "@/lib/vibe-match";
import { getGenresByArtistName } from "@/lib/spotify";

// Service-Role-Client: liest event_plays auch fuer anonyme Gaeste
// (RLS-Bypass — wir geben aber NUR vibe-tokens raus, nichts sensibles).
function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Liefert die aktuelle Stimmung eines Events als gewichtete Wortliste.
// Basis: die letzten ~10 Songs aus event_plays.
// Anonym lesbar — der Endpoint wird auch von der Gaeste-Seite benutzt.
//
// Fallback: wenn artist_genres in der DB leer/fehlt (Migration nicht
// gelaufen oder alte Plays), holen wir die Genres on-the-fly von Spotify.
// Dadurch funktioniert der Vibe-Check auch ohne Migration.

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VIBE_WINDOW = 10;

interface PlayRow {
  artist_genres?: string[] | null;
  spotify_track_id: string;
  artist?: string | null;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  // Service-Role: damit auch anonyme Gaeste den Vibe sehen
  const supabase = adminClient();

  // Optional: track_ids=A,B,C → Server berechnet Match-% pro Track gleich mit
  const trackIdsParam = req.nextUrl.searchParams.get("track_ids");
  const trackIds = trackIdsParam
    ? trackIdsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30)
    : [];

  // spotify_track_id + artist + ggf. artist_genres holen
  const { data: rawPlays, error } = await supabase
    .from("event_plays")
    .select("spotify_track_id, artist, artist_genres, played_at")
    .eq("event_id", id)
    .order("played_at", { ascending: false })
    .limit(VIBE_WINDOW);

  // Falls Spalte nicht existiert (Migration fehlt), ohne artist_genres nochmal
  let plays: PlayRow[] = (rawPlays ?? []) as PlayRow[];
  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("artist_genres") || msg.includes("column")) {
      const { data: fallback } = await supabase
        .from("event_plays")
        .select("spotify_track_id, artist, played_at")
        .eq("event_id", id)
        .order("played_at", { ascending: false })
        .limit(VIBE_WINDOW);
      plays = (fallback ?? []) as PlayRow[];
    }
  }

  // Genres pro Play: erst DB-Spalte, sonst direkt via Kuenstler-Namen
  // (MusicBrainz, kein Spotify-Call mehr — vermeidet 429er).
  const playsGenres = await Promise.all(
    plays.map(async (p) => {
      if (Array.isArray(p.artist_genres) && p.artist_genres.length > 0) {
        return p.artist_genres;
      }
      if (p.artist) {
        try {
          return await getGenresByArtistName(p.artist);
        } catch {
          return [];
        }
      }
      return [];
    })
  );

  const vibeTokens = computeVibeTokens(playsGenres);

  // Wenn track_ids mitgegeben: Match-% pro Track berechnen.
  // Kuenstler-Namen kommen aus song_requests (kein Spotify-Lookup noetig).
  const matches: Record<string, { percent: number; matchedWords: string[] }> = {};
  if (trackIds.length > 0) {
    const { data: reqs } = await supabase
      .from("song_requests")
      .select("spotify_track_id, artist, artist_genres")
      .eq("event_id", id)
      .in("spotify_track_id", trackIds);

    const trackArtistMap = new Map<string, { artist: string; genres: string[] | null }>();
    for (const r of (reqs ?? []) as { spotify_track_id: string; artist: string; artist_genres?: string[] | null }[]) {
      if (!trackArtistMap.has(r.spotify_track_id)) {
        trackArtistMap.set(r.spotify_track_id, {
          artist: r.artist,
          genres: r.artist_genres ?? null
        });
      }
    }

    await Promise.all(
      trackIds.map(async (tid) => {
        try {
          const info = trackArtistMap.get(tid);
          if (!info) return;
          // Genres: erst DB, sonst MusicBrainz direkt
          let genres = info.genres ?? [];
          if (!genres.length && info.artist) {
            genres = await getGenresByArtistName(info.artist);
          }
          const m = matchPercent(genres, vibeTokens);
          if (m) {
            matches[tid] = { percent: m.percent, matchedWords: m.matchedWords };
          }
        } catch {}
      })
    );
  }

  return NextResponse.json({
    vibeTokens,
    playCount: playsGenres.filter((g) => g && g.length > 0).length,
    rawPlayCount: plays.length,
    matches
  });
}
