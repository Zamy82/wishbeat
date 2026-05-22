import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTrackArtistGenres } from "@/lib/spotify";

// Server-seitiger Insert in event_plays.
// Wir machen das ueber den Server, weil:
//   1) wir Fehler richtig zurueckgeben koennen (vs. fire-and-forget am Client)
//   2) der Server zentral Genres anreichern kann
//   3) wir Ownership-Check machen (nur der DJ des Events darf tracken)

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface Body {
  spotify_track_id?: string;
  title?: string;
  artist?: string;
  cover_url?: string | null;
  source?: "wish" | "auto";
  request_id?: string | null;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: eventId } = await ctx.params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Nicht eingeloggt." }, { status: 401 });
  }

  // Ownership-Check
  const { data: event } = await supabase
    .from("events")
    .select("id, owner_id")
    .eq("id", eventId)
    .eq("owner_id", user.id)
    .single();
  if (!event) {
    return NextResponse.json(
      { ok: false, message: "Event nicht gefunden oder kein Zugriff." },
      { status: 404 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Ungueltiges JSON." }, { status: 400 });
  }
  if (!body.spotify_track_id) {
    return NextResponse.json(
      { ok: false, message: "spotify_track_id fehlt." },
      { status: 400 }
    );
  }

  // Dedup: wenn derselbe Track in den letzten 3 Min schon eingetragen
  // wurde, NICHT erneut. Vermeidet Mehrfach-Inserts durch
  // Hard-Refreshs / Doppelklicks waehrend desselben Songs.
  const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("event_plays")
    .select("id, played_at")
    .eq("event_id", eventId)
    .eq("spotify_track_id", body.spotify_track_id)
    .gte("played_at", threeMinAgo)
    .limit(1);
  if (recent && recent.length > 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "already_tracked_recently",
      existing_id: recent[0].id
    });
  }

  // Genres holen (cached)
  let genres: string[] = [];
  try {
    genres = await getTrackArtistGenres(body.spotify_track_id);
  } catch {}

  const basePlay = {
    event_id: eventId,
    spotify_track_id: body.spotify_track_id,
    title: body.title ?? "",
    artist: body.artist ?? "",
    cover_url: body.cover_url ?? null,
    source: body.source ?? "auto",
    request_id: body.request_id ?? null
  };

  // Erst mit artist_genres versuchen, sonst ohne (falls Spalte fehlt)
  let { data, error } = await supabase
    .from("event_plays")
    .insert({ ...basePlay, artist_genres: genres })
    .select("id")
    .single();

  if (error) {
    const m = (error.message ?? "").toLowerCase();
    if (m.includes("artist_genres") || m.includes("schema cache") || m.includes("column")) {
      ({ data, error } = await supabase
        .from("event_plays")
        .insert(basePlay)
        .select("id")
        .single());
    }
  }

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message,
        code: error.code,
        details: error.details ?? null,
        hint: error.hint ?? null
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: data?.id, genresCount: genres.length });
}
