import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotify-user";

// Steuert Spotify-Playback fuer den eingeloggten DJ.
// POST mit body: { action: "play" | "pause" | "next" | "previous" }

export async function POST(req: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ ok: false, message: "Spotify nicht verbunden." });
  }

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Ungueltiges JSON" }, { status: 400 });
  }

  const endpoints: Record<string, { method: string; path: string }> = {
    play: { method: "PUT", path: "/me/player/play" },
    pause: { method: "PUT", path: "/me/player/pause" },
    next: { method: "POST", path: "/me/player/next" },
    previous: { method: "POST", path: "/me/player/previous" }
  };
  const op = endpoints[body.action ?? ""];
  if (!op) {
    return NextResponse.json(
      { ok: false, message: "Unbekannte Action. Erlaubt: play, pause, next, previous." },
      { status: 400 }
    );
  }

  const res = await fetch(`https://api.spotify.com/v1${op.path}`, {
    method: op.method,
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.status === 204) {
    return NextResponse.json({ ok: true });
  }
  if (res.status === 403) {
    return NextResponse.json({
      ok: false,
      message: "Spotify Premium notwendig fuer diese Aktion."
    });
  }
  if (res.status === 404) {
    return NextResponse.json({
      ok: false,
      message: "Kein aktives Spotify-Geraet gefunden. Starte Spotify und spiele etwas."
    });
  }
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    return NextResponse.json({
      ok: false,
      message: `Spotify-Fehler ${res.status}: ${errorText.slice(0, 150)}`
    });
  }
  return NextResponse.json({ ok: true });
}
