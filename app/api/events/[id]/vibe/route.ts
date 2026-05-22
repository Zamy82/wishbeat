import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeVibeTokens } from "@/lib/vibe-match";

// Liefert die aktuelle Stimmung eines Events als gewichtete Wortliste.
// Basis: die letzten ~10 Songs aus event_plays mit ihren artist_genres.
// Anonym lesbar — der Endpoint wird auch von der Gaeste-Seite benutzt.

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VIBE_WINDOW = 10;

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: plays } = await supabase
    .from("event_plays")
    .select("artist_genres, played_at")
    .eq("event_id", id)
    .order("played_at", { ascending: false })
    .limit(VIBE_WINDOW);

  const playsGenres = (plays ?? []).map((p) => p.artist_genres as string[] | null);
  const vibeTokens = computeVibeTokens(playsGenres);

  return NextResponse.json({
    vibeTokens,
    playCount: playsGenres.filter((g) => g && g.length > 0).length
  });
}
