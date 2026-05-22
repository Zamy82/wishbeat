import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotify-user";
import { createClient } from "@/lib/supabase/server";

// Platziert einen Track als naechsten Spotify-Song (= Position 2 in der Queue).
// Da Spotify keine direkte "Play Next"-API hat, nutzen wir folgenden Trick:
//
// 1. Aktuelle Wiedergabe + Queue auslesen
// 2. PUT /me/player/play mit uris = [currentTrack, ourTrack, ...existingQueue]
//    und position_ms = aktuelle Position
//
// Effekt: aktueller Track laeuft an seiner Position weiter, unser Track ist
// als naechster eingereiht, bisherige Queue bleibt dahinter.

interface PlayerStateResp {
  is_playing?: boolean;
  progress_ms?: number;
  item?: { uri: string } | null;
}

interface QueueResp {
  currently_playing: { uri: string } | null;
  queue: { uri: string }[];
}

export async function POST(req: NextRequest) {
  // Auth-Check
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

  // 1. Player-Status + Queue holen
  const [playerRes, queueRes] = await Promise.all([
    fetch("https://api.spotify.com/v1/me/player", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    }),
    fetch("https://api.spotify.com/v1/me/player/queue", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    })
  ]);

  // Wenn nichts laeuft: einfach unseren Track abspielen
  if (playerRes.status === 204 || !playerRes.ok) {
    const playRes = await fetch("https://api.spotify.com/v1/me/player/play", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ uris: [ourTrackUri] })
    });
    if (!playRes.ok) {
      return NextResponse.json({
        ok: false,
        code: "no_device",
        message:
          "Spotify spielt gerade nirgends. Starte einen Song in der Spotify-App."
      });
    }
    return NextResponse.json({ ok: true, mode: "started" });
  }

  const playerData = (await playerRes.json()) as PlayerStateResp;
  const positionMs = playerData.progress_ms ?? 0;

  let currentUri: string | null = playerData.item?.uri ?? null;
  let queueUris: string[] = [];

  if (queueRes.ok) {
    const qData = (await queueRes.json()) as QueueResp;
    currentUri = qData.currently_playing?.uri ?? currentUri;
    // Limitiere auf max. 18 Queue-Tracks damit wir nicht ueber das Spotify-
    // PUT-Limit kommen (max 100 uris pro play-Request)
    queueUris = (qData.queue ?? []).slice(0, 18).map((t) => t.uri);
  }

  if (!currentUri) {
    // Kein aktueller Track erkannt → Track normal abspielen
    const playRes = await fetch("https://api.spotify.com/v1/me/player/play", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ uris: [ourTrackUri] })
    });
    if (!playRes.ok) {
      return NextResponse.json({
        ok: false,
        code: "no_device",
        message: "Spotify konnte den Track nicht starten."
      });
    }
    return NextResponse.json({ ok: true, mode: "started" });
  }

  // 2. Neue Queue: current → ourTrack → bisherige Queue
  const newUris = [currentUri, ourTrackUri, ...queueUris];

  const playRes = await fetch("https://api.spotify.com/v1/me/player/play", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      uris: newUris,
      position_ms: positionMs
    })
  });

  if (!playRes.ok) {
    const errorText = await playRes.text().catch(() => "");
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
    mode: "inserted",
    queueLengthAfter: newUris.length
  });
}
