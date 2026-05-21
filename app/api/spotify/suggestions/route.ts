import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotify-user";

interface SpotifyTrackRaw {
  id: string;
  name: string;
  duration_ms: number;
  uri: string;
  artists: { id: string; name: string }[];
  album: { name: string; images: { url: string }[] };
}

function toTrack(t: SpotifyTrackRaw) {
  return {
    id: t.id,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    artist_id: t.artists[0]?.id ?? null,
    album: t.album.name,
    cover_url: t.album.images[1]?.url ?? t.album.images[0]?.url ?? null,
    duration_ms: t.duration_ms,
    uri: t.uri
  };
}

export async function GET(req: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ tracks: [], source: null, reason: "no_token" });
  }

  const trackId = req.nextUrl.searchParams.get("seed_track");
  const artistId = req.nextUrl.searchParams.get("seed_artist");
  const tempo = req.nextUrl.searchParams.get("tempo");
  const energy = req.nextUrl.searchParams.get("energy");
  const excludeId = req.nextUrl.searchParams.get("exclude") ?? "";

  // 1) Erst: Spotify-Recommendations (BPM-/Energy-gewichtet)
  if (trackId) {
    try {
      const url = new URL("https://api.spotify.com/v1/recommendations");
      url.searchParams.set("seed_tracks", trackId);
      url.searchParams.set("limit", "10");
      url.searchParams.set("market", "DE");
      if (tempo) {
        const t = Number(tempo);
        url.searchParams.set("target_tempo", String(t));
        url.searchParams.set("min_tempo", String(Math.max(60, t - 8)));
        url.searchParams.set("max_tempo", String(t + 8));
      }
      if (energy) {
        const e = Number(energy);
        url.searchParams.set("target_energy", String(e));
        url.searchParams.set("min_energy", String(Math.max(0, e - 0.15)));
        url.searchParams.set("max_energy", String(Math.min(1, e + 0.15)));
      }
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      if (res.ok) {
        const data = (await res.json()) as { tracks: SpotifyTrackRaw[] };
        const tracks = data.tracks
          .filter((t) => t.id !== excludeId)
          .map(toTrack)
          .slice(0, 8);
        if (tracks.length > 0) {
          return NextResponse.json({ tracks, source: "recommendations" });
        }
      }
    } catch {}
  }

  // 2) Fallback: Top-Tracks des aktuellen Künstlers
  if (artistId) {
    try {
      const res = await fetch(
        `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=DE`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      if (res.ok) {
        const data = (await res.json()) as { tracks: SpotifyTrackRaw[] };
        const tracks = data.tracks
          .filter((t) => t.id !== excludeId)
          .map(toTrack)
          .slice(0, 8);
        if (tracks.length > 0) {
          return NextResponse.json({ tracks, source: "artist_top_tracks" });
        }
      }
    } catch {}
  }

  // 3) Letzter Fallback: Related Artists → ihre Top-Tracks
  if (artistId) {
    try {
      const relRes = await fetch(
        `https://api.spotify.com/v1/artists/${artistId}/related-artists`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      if (relRes.ok) {
        const rel = (await relRes.json()) as { artists: { id: string; name: string }[] };
        const collected: SpotifyTrackRaw[] = [];
        for (const a of rel.artists.slice(0, 4)) {
          const tRes = await fetch(
            `https://api.spotify.com/v1/artists/${a.id}/top-tracks?market=DE`,
            { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
          );
          if (tRes.ok) {
            const tData = (await tRes.json()) as { tracks: SpotifyTrackRaw[] };
            collected.push(...tData.tracks.slice(0, 2));
          }
        }
        const tracks = collected
          .filter((t) => t.id !== excludeId)
          .map(toTrack)
          .slice(0, 8);
        if (tracks.length > 0) {
          return NextResponse.json({ tracks, source: "related_artists" });
        }
      }
    } catch {}
  }

  return NextResponse.json({ tracks: [], source: null, reason: "no_data" });
}
