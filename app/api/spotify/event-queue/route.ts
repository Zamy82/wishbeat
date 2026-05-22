import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminSpotifyToken } from "@/lib/spotify-admin";

// Anonymer Endpunkt für die Gäste-Seite — gibt currently playing + Queue zurück.
// Limitiert auf max 5 Tracks aus der Queue (mehr braucht ein Gast nicht zu sehen).

interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  uri: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
}

interface SpotifyQueueResponse {
  currently_playing: SpotifyTrack | null;
  queue: SpotifyTrack[];
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function toTrack(t: SpotifyTrack) {
  return {
    id: t.id,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    album: t.album.name,
    cover_url: t.album.images[1]?.url ?? t.album.images[0]?.url ?? null,
    duration_ms: t.duration_ms
  };
}

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("event_id");
  if (!eventId) {
    return NextResponse.json({ error: "event_id missing" }, { status: 400 });
  }

  const supabase = adminClient();

  // Event laden — muss aktiv sein
  const { data: event } = await supabase
    .from("events")
    .select("id, owner_id, is_active")
    .eq("id", eventId)
    .single();

  if (!event || !event.is_active) {
    return NextResponse.json({ playing: false, reason: "event_inactive" });
  }

  const token = await getAdminSpotifyToken(event.owner_id);
  if (!token) {
    return NextResponse.json({ playing: false, reason: "no_token" });
  }

  const res = await fetch("https://api.spotify.com/v1/me/player/queue", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });

  if (res.status === 204 || !res.ok) {
    return NextResponse.json({ playing: false, reason: "no_playback" });
  }

  const data = (await res.json()) as SpotifyQueueResponse;
  if (!data.currently_playing) {
    return NextResponse.json({ playing: false, reason: "nothing_playing" });
  }

  return NextResponse.json({
    playing: true,
    current: toTrack(data.currently_playing),
    next: data.queue.slice(0, 5).map(toTrack)
  });
}
