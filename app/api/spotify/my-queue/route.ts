import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotify-user";

// Liest die aktuelle Warteschlange des DJs aus Spotify.
// Liefert: currentlyPlaying (kann null sein) + queue[] (naechste Tracks).
// Wird in der DJ-Konsole fuer Deck B + Queue-Panel verwendet.

interface SpotifyQueueItem {
  id: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
}

interface SpotifyQueueResp {
  currently_playing: SpotifyQueueItem | null;
  queue: SpotifyQueueItem[];
}

function mapTrack(t: SpotifyQueueItem) {
  return {
    id: t.id,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    album: t.album.name,
    cover_url: t.album.images[1]?.url ?? t.album.images[0]?.url ?? null,
    duration_ms: t.duration_ms
  };
}

export async function GET() {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ playing: null, queue: [], reason: "no_token" });
  }

  const res = await fetch("https://api.spotify.com/v1/me/player/queue", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });

  if (!res.ok) {
    return NextResponse.json({
      playing: null,
      queue: [],
      reason: "error",
      status: res.status
    });
  }

  const data = (await res.json()) as SpotifyQueueResp;
  return NextResponse.json({
    playing: data.currently_playing ? mapTrack(data.currently_playing) : null,
    queue: (data.queue ?? []).slice(0, 12).map(mapTrack)
  });
}
