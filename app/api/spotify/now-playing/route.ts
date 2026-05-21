import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotify-user";

interface SpotifyArtist { id: string; name: string }
interface SpotifyAlbumImage { url: string; width: number; height: number }
interface SpotifyCurrentlyPlaying {
  is_playing: boolean;
  progress_ms: number;
  item: {
    id: string;
    name: string;
    duration_ms: number;
    uri: string;
    artists: SpotifyArtist[];
    album: { name: string; images: SpotifyAlbumImage[]; release_date?: string };
  } | null;
}

interface SpotifyAudioFeatures {
  tempo: number;
  energy: number;
  valence: number;
  danceability: number;
  key: number;
  mode: number;
}

export async function GET() {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ playing: false, reason: "no_token" });
  }

  const res = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing?market=DE",
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );

  if (res.status === 204) {
    return NextResponse.json({ playing: false, reason: "nothing_playing" });
  }
  if (!res.ok) {
    return NextResponse.json({
      playing: false,
      reason: "error",
      status: res.status
    });
  }

  const data = (await res.json()) as SpotifyCurrentlyPlaying;
  if (!data.item) {
    return NextResponse.json({ playing: false, reason: "no_item" });
  }

  // Audio-Features holen (BPM, Energy etc.) — kann von Spotify gesperrt sein
  let features: SpotifyAudioFeatures | null = null;
  try {
    const fres = await fetch(
      `https://api.spotify.com/v1/audio-features/${data.item.id}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (fres.ok) features = (await fres.json()) as SpotifyAudioFeatures;
  } catch {
    // ignore — kein Beinbruch wenn Features nicht da sind
  }

  // Release-Jahr aus dem Album extrahieren — Format ist "YYYY", "YYYY-MM" oder "YYYY-MM-DD"
  const releaseYear = data.item.album.release_date
    ? parseInt(data.item.album.release_date.substring(0, 4), 10)
    : null;

  return NextResponse.json({
    playing: data.is_playing,
    progress_ms: data.progress_ms,
    track: {
      id: data.item.id,
      title: data.item.name,
      artist: data.item.artists.map((a) => a.name).join(", "),
      artist_id: data.item.artists[0]?.id ?? null,
      album: data.item.album.name,
      cover_url:
        data.item.album.images[0]?.url ?? null,
      duration_ms: data.item.duration_ms,
      uri: data.item.uri,
      release_year: releaseYear && !isNaN(releaseYear) ? releaseYear : null
    },
    features: features
      ? {
          tempo: Math.round(features.tempo),
          energy: features.energy,
          valence: features.valence,
          danceability: features.danceability,
          key: features.key,
          mode: features.mode
        }
      : null
  });
}
