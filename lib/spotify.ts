// Serverseitiger Spotify-Client mit Token-Caching (Client Credentials Flow)
// Kein Nutzer-Login nötig — gut für die öffentliche Songsuche.

interface TokenCache {
  access_token: string;
  expires_at: number;
}

let cache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  if (cache && Date.now() < cache.expires_at - 60_000) {
    return cache.access_token;
  }

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials",
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`Spotify token fetch failed: ${res.status}`);
  }

  const data = await res.json();
  cache = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000
  };

  return cache.access_token;
}

export async function searchTracks(query: string, limit = 8) {
  const token = await getAccessToken();

  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("market", "DE");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 60 }
  });

  if (!res.ok) {
    throw new Error(`Spotify search failed: ${res.status}`);
  }

  const data = await res.json();

  return data.tracks.items.map((item: SpotifyApiTrack) => ({
    id: item.id,
    title: item.name,
    artist: item.artists.map((a: { name: string }) => a.name).join(", "),
    album: item.album.name,
    cover_url: item.album.images[1]?.url ?? item.album.images[0]?.url ?? null,
    duration_ms: item.duration_ms
  }));
}

interface SpotifyApiTrack {
  id: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
}
