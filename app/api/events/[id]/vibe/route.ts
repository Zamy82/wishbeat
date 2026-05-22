import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeVibeTokens, matchPercent } from "@/lib/vibe-match";
import { getTrackArtistGenres } from "@/lib/spotify";

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
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  // Optional: track_ids=A,B,C → Server berechnet Match-% pro Track gleich mit
  const trackIdsParam = req.nextUrl.searchParams.get("track_ids");
  const trackIds = trackIdsParam
    ? trackIdsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30)
    : [];

  // spotify_track_id immer holen, artist_genres nur wenn vorhanden
  const { data: rawPlays, error } = await supabase
    .from("event_plays")
    .select("spotify_track_id, artist_genres, played_at")
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
        .select("spotify_track_id, played_at")
        .eq("event_id", id)
        .order("played_at", { ascending: false })
        .limit(VIBE_WINDOW);
      plays = (fallback ?? []) as PlayRow[];
    }
  }

  // Genres pro Play auffuellen: erst DB, sonst Spotify (cached)
  const playsGenres = await Promise.all(
    plays.map(async (p) => {
      if (Array.isArray(p.artist_genres) && p.artist_genres.length > 0) {
        return p.artist_genres;
      }
      try {
        return await getTrackArtistGenres(p.spotify_track_id);
      } catch {
        return [];
      }
    })
  );

  const vibeTokens = computeVibeTokens(playsGenres);

  // Wenn track_ids mitgegeben: pro Track Genres holen + Match-% berechnen
  const matches: Record<string, { percent: number; matchedWords: string[] }> = {};
  if (trackIds.length > 0) {
    await Promise.all(
      trackIds.map(async (tid) => {
        try {
          const genres = await getTrackArtistGenres(tid);
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
