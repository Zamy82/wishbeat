import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotify-user";
import { createClient } from "@/lib/supabase/server";

// Track auf Platz 1 in der Spotify-Queue setzen — aktueller Song laeuft weiter.
//
// Spotify hat keinen direkten "play next"-Endpoint. Wir nutzen:
//   PUT /me/player/play body: { uris: [current, our, ...queue], position_ms: progress }
// Spotify "ersetzt" damit den Player-Context: aktueller Track laeuft an seiner
// Position weiter, danach unser Track, danach die bisherige Queue.

interface PlayerState {
  is_playing?: boolean;
  progress_ms?: number;
  item?: { uri: string; id: string } | null;
}

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

  // 1. Aktuellen Player-Zustand holen (current track + progress)
  const playerRes = await fetch("https://api.spotify.com/v1/me/player", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });

  // Wenn nichts laeuft → einfach in die Queue packen, mehr geht nicht
  if (playerRes.status === 204 || !playerRes.ok) {
    const fallbackUrl = new URL("https://api.spotify.com/v1/me/player/queue");
    fallbackUrl.searchParams.set("uri", ourTrackUri);
    const r = await fetch(fallbackUrl.toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) {
      return NextResponse.json({
        ok: false,
        code: "no_device",
        message:
          "Spotify spielt gerade nirgends ab. Starte einen Song in der Spotify-App."
      });
    }
    return NextResponse.json({ ok: true, mode: "queued_only" });
  }

  const playerData = (await playerRes.json()) as PlayerState;
  if (!playerData.item) {
    return NextResponse.json({
      ok: false,
      code: "no_device",
      message: "Kein aktueller Track erkannt."
    });
  }

  const currentUri = playerData.item.uri;
  const positionMs = playerData.progress_ms ?? 0;

  // Track schon current? Skip
  if (currentUri === ourTrackUri) {
    return NextResponse.json({
      ok: false,
      code: "already_current",
      message: "Dieser Song laeuft gerade."
    });
  }

  // 2. Bisherige Queue holen
  let queueUris: string[] = [];
  try {
    const queueRes = await fetch("https://api.spotify.com/v1/me/player/queue", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    if (queueRes.ok) {
      const qData = (await queueRes.json()) as QueueResp;
      queueUris = (qData.queue ?? [])
        .map((t) => t.uri)
        .filter((u) => u && u !== ourTrackUri && u !== currentUri)
        .slice(0, 18);
    }
  } catch {}

  // 3. Neue Queue: aktuell → unser Track → bisherige Queue
  const newUris = [currentUri, ourTrackUri, ...queueUris];

  const playRes = await fetch("https://api.spotify.com/v1/me/player/play", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      uris: newUris,
      offset: { position: 0 },
      position_ms: positionMs
    })
  });

  if (!playRes.ok) {
    // Fallback: trotzdem in die Queue stecken (am Ende)
    const errorText = await playRes.text().catch(() => "");
    if (playRes.status === 403) {
      return NextResponse.json({
        ok: false,
        code: "no_premium",
        message: "Diese Funktion benoetigt Spotify Premium."
      });
    }

    const fallbackUrl = new URL("https://api.spotify.com/v1/me/player/queue");
    fallbackUrl.searchParams.set("uri", ourTrackUri);
    const fallbackRes = await fetch(fallbackUrl.toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (fallbackRes.ok) {
      return NextResponse.json({
        ok: true,
        mode: "queued_fallback",
        message: "In die Queue am Ende — Platz 1 hat Spotify abgelehnt."
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
    mode: "inserted_as_next",
    queueLengthAfter: newUris.length
  });
}
