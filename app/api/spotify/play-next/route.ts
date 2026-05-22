import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotify-user";
import { createClient } from "@/lib/supabase/server";

// Spielt einen Track SOFORT — Spotify hat keinen "Play next"-Endpoint, daher:
//   PUT /me/player/play body: { uris: [ourTrack, ...existingQueueUris] }
// Effekt:
//   - aktueller Track wird unterbrochen
//   - unser Track laeuft sofort von Anfang
//   - bisherige Queue (max 20 items, was Spotify zurueck gibt) folgt danach

interface QueueResp {
  currently_playing: { uri: string } | null;
  queue: { uri: string }[];
}

export async function POST(req: NextRequest) {
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
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "bad_request", message: "Ungueltiges JSON" },
      { status: 400 }
    );
  }
  if (!body.spotify_track_id) {
    return NextResponse.json(
      { ok: false, code: "bad_request", message: "spotify_track_id fehlt" },
      { status: 400 }
    );
  }

  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({
      ok: false,
      code: "no_token",
      message: "Spotify ist nicht verbunden."
    });
  }

  const ourTrackUri = `spotify:track:${body.spotify_track_id}`;

  // Bisherige Queue holen — wir erhalten sie nach unserem Track
  let queueUris: string[] = [];
  try {
    const queueRes = await fetch("https://api.spotify.com/v1/me/player/queue", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    if (queueRes.ok) {
      const qData = (await queueRes.json()) as QueueResp;
      // Max 18 Queue-Tracks behalten (Spotify-API uris-Limit beachten)
      queueUris = (qData.queue ?? [])
        .slice(0, 18)
        .map((t) => t.uri)
        .filter((u) => u && u !== ourTrackUri); // unseren nicht doppeln
    }
  } catch {
    // Ohne Queue-Erhalt weiterspielen — nur unser Track
  }

  // SOFORT spielen: aktueller Track wird unterbrochen, unser Track startet
  const uris = [ourTrackUri, ...queueUris];

  const playRes = await fetch("https://api.spotify.com/v1/me/player/play", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ uris })
  });

  if (!playRes.ok) {
    const errorText = await playRes.text().catch(() => "");
    if (playRes.status === 404) {
      return NextResponse.json({
        ok: false,
        code: "no_device",
        message:
          "Spotify spielt gerade nirgends. Starte einen Song in der Spotify-App."
      });
    }
    if (playRes.status === 403) {
      return NextResponse.json({
        ok: false,
        code: "no_premium",
        message: "Diese Funktion benoetigt Spotify Premium."
      });
    }
    return NextResponse.json({
      ok: false,
      code: "unknown",
      message: `Spotify-Fehler (${playRes.status}): ${errorText.slice(0, 200)}`
    });
  }

  return NextResponse.json({
    ok: true,
    queueLengthAfter: uris.length
  });
}
