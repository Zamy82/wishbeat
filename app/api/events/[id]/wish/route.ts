import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Server-seitige Wunsch-Einreichung (statt Direct-Insert vom Browser).
// Der Server ist die Wahrheit und erzwingt:
//   - status = 'pending' (Gast kann nicht selbst 'approved' vergeben)
//   - Cooldown (Live) bzw. max. 3 Wuensche/Gast (Vorab) — nicht clientseitig umgehbar
//   - Laengen-Limits auf title/artist/nickname
//   - Event muss aktiv sein (aus der DB gelesen, nicht dem Client geglaubt)

interface Body {
  spotify_track_id?: string;
  title?: string;
  artist?: string;
  cover_url?: string | null;
  guest_nickname?: string | null;
  requester_session_id?: string;
  artist_genres?: string[] | null;
}

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const COOLDOWN_MIN = 5;
const PRE_MAX = 3;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: eventId } = await ctx.params;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Ungueltiges JSON." }, { status: 400 });
  }

  const sessionId = body.requester_session_id?.trim();
  const trackId = body.spotify_track_id?.trim();
  const title = body.title?.trim();
  const artist = body.artist?.trim();

  if (!trackId || !title || !artist || !sessionId) {
    return NextResponse.json({ ok: false, message: "Pflichtfelder fehlen." }, { status: 400 });
  }
  if (title.length > 200 || artist.length > 200) {
    return NextResponse.json({ ok: false, message: "Eingabe zu lang." }, { status: 400 });
  }

  const supabase = adminClient();

  // Event serverseitig pruefen — nicht dem Client vertrauen
  const { data: event } = await supabase
    .from("events")
    .select("id, is_active, wish_only")
    .eq("id", eventId)
    .maybeSingle();

  if (!event || !event.is_active) {
    return NextResponse.json(
      { ok: false, message: "Dieses Event nimmt gerade keine Wuensche an." },
      { status: 403 }
    );
  }

  // Rate-Limit serverseitig (nicht umgehbar)
  if (event.wish_only) {
    const { count } = await supabase
      .from("song_requests")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("requester_session_id", sessionId);
    if ((count ?? 0) >= PRE_MAX) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Du hast schon 3 Songs gewünscht — mehr als genug für einen guten Eindruck! 🎶"
        },
        { status: 429 }
      );
    }
  } else {
    const cutoffIso = new Date(Date.now() - COOLDOWN_MIN * 60_000).toISOString();
    const { data: recent } = await supabase
      .from("song_requests")
      .select("created_at")
      .eq("event_id", eventId)
      .eq("requester_session_id", sessionId)
      .gte("created_at", cutoffIso)
      .order("created_at", { ascending: false })
      .limit(1);
    if (recent && recent.length > 0) {
      const lastMs = new Date(recent[0].created_at).getTime();
      const remainingSec = Math.max(
        1,
        Math.ceil((COOLDOWN_MIN * 60_000 - (Date.now() - lastMs)) / 1000)
      );
      const min = Math.floor(remainingSec / 60);
      const sec = remainingSec % 60;
      const stamp = `${min}:${sec.toString().padStart(2, "0")}`;
      return NextResponse.json(
        {
          ok: false,
          message: `Du hast gerade erst einen Wunsch geschickt. Bitte warte noch ${stamp} Min — damit jeder mal drankommt. 🎶`
        },
        { status: 429 }
      );
    }
  }

  const baseRow = {
    event_id: eventId,
    spotify_track_id: trackId,
    title: title.slice(0, 200),
    artist: artist.slice(0, 200),
    cover_url: body.cover_url ?? null,
    guest_nickname: body.guest_nickname?.trim()?.slice(0, 40) || null,
    requester_session_id: sessionId,
    status: "pending" as const
  };

  const genres = Array.isArray(body.artist_genres) ? body.artist_genres : null;

  // Erst mit artist_genres; falls Spalte/Cache fehlt, ohne erneut versuchen.
  let inserted: { id: string } | null = null;
  let error: { message?: string; code?: string } | null = null;
  {
    const res = await supabase
      .from("song_requests")
      .insert({ ...baseRow, artist_genres: genres })
      .select("id")
      .single();
    inserted = res.data;
    error = res.error;
  }
  if (error) {
    const m = (error.message ?? "").toLowerCase();
    if (m.includes("artist_genres") || m.includes("schema cache") || error.code === "PGRST204") {
      const res = await supabase.from("song_requests").insert(baseRow).select("id").single();
      inserted = res.data;
      error = res.error;
    }
  }
  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message ?? "Speichern fehlgeschlagen." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: inserted?.id });
}
