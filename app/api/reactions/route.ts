import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Live-Reactions Endpoint.
// Toggle-Logik:
//  - keine bestehende Reaction von dieser Session/Track  -> INSERT
//  - bestehende Reaction gleich neuer (Toggle off)        -> DELETE
//  - bestehende Reaction anders (Wechsel)                 -> UPDATE
//
// Body: { event_id, track_id, session_id, reaction: 'fire'|'dance'|'meh' }
// Response: { ok, action: 'inserted'|'updated'|'removed', reaction: 'fire'|'dance'|'meh'|null }

type Reaction = "fire" | "dance" | "meh";

interface Body {
  event_id?: string;
  track_id?: string;
  session_id?: string;
  reaction?: Reaction;
}

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const ALLOWED: Reaction[] = ["fire", "dance", "meh"];

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const { event_id, track_id, session_id, reaction } = body;
  if (!event_id || !track_id || !session_id || !reaction) {
    return NextResponse.json(
      { ok: false, message: "event_id, track_id, session_id, reaction required" },
      { status: 400 }
    );
  }
  if (!ALLOWED.includes(reaction)) {
    return NextResponse.json({ ok: false, message: "Invalid reaction" }, { status: 400 });
  }

  const admin = adminClient();

  // Existierende Reaction von diesem Gast fuer diesen Track?
  const { data: existing } = await admin
    .from("song_reactions")
    .select("id, reaction")
    .eq("event_id", event_id)
    .eq("spotify_track_id", track_id)
    .eq("session_id", session_id)
    .maybeSingle();

  if (!existing) {
    // INSERT
    const { error } = await admin.from("song_reactions").insert({
      event_id,
      spotify_track_id: track_id,
      session_id,
      reaction
    });
    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action: "inserted", reaction });
  }

  if (existing.reaction === reaction) {
    // Toggle off — DELETE
    const { error } = await admin
      .from("song_reactions")
      .delete()
      .eq("id", existing.id);
    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action: "removed", reaction: null });
  }

  // UPDATE — wechselt Reaction
  const { error } = await admin
    .from("song_reactions")
    .update({ reaction })
    .eq("id", existing.id);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, action: "updated", reaction });
}
