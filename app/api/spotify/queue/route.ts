import { NextRequest, NextResponse } from "next/server";
import { addTrackToQueue } from "@/lib/spotify-user";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: "unauthorized", message: "Nicht eingeloggt." },
      { status: 401 }
    );
  }

  let body: { spotify_track_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "bad_request", message: "Ungültige Anfrage." },
      { status: 400 }
    );
  }

  if (!body.spotify_track_id) {
    return NextResponse.json(
      { ok: false, code: "bad_request", message: "spotify_track_id fehlt." },
      { status: 400 }
    );
  }

  const result = await addTrackToQueue(body.spotify_track_id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
