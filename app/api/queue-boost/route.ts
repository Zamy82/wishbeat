import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Live-Queue-Boost — Toggle-Endpoint.
// Body: { event_id, track_id, session_id }
// Response: { ok, boosted: boolean }

interface Body {
  event_id?: string;
  track_id?: string;
  session_id?: string;
}

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const { event_id, track_id, session_id } = body;
  if (!event_id || !track_id || !session_id) {
    return NextResponse.json(
      { ok: false, message: "event_id, track_id, session_id required" },
      { status: 400 }
    );
  }

  const admin = adminClient();

  // Existierender Boost dieses Gastes auf diesen Track?
  const { data: existing } = await admin
    .from("live_queue_boosts")
    .select("id")
    .eq("event_id", event_id)
    .eq("spotify_track_id", track_id)
    .eq("session_id", session_id)
    .maybeSingle();

  if (existing) {
    // Toggle off
    const { error } = await admin
      .from("live_queue_boosts")
      .delete()
      .eq("id", existing.id);
    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, boosted: false });
  }

  // INSERT
  const { error } = await admin.from("live_queue_boosts").insert({
    event_id,
    spotify_track_id: track_id,
    session_id
  });
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, boosted: true });
}
