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

// Spotify-Search-Limit ist seit 2025 auf 10 pro Call begrenzt.
// Für mehr Treffer machen wir mehrere parallele Calls mit unterschiedlichem offset.
const MAX_PER_CALL = 10;

interface SearchedTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover_url: string | null;
  duration_ms: number;
}

async function searchOnce(
  token: string,
  query: string,
  limit: number,
  offset: number
): Promise<SpotifyApiTrack[]> {
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("market", "DE");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 60 }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.tracks.items as SpotifyApiTrack[];
}

export async function searchTracks(
  query: string,
  totalLimit = 8,
  startOffset = 0
): Promise<SearchedTrack[]> {
  const token = await getAccessToken();

  // Wenn ≤ 10 reichen, ein Call. Sonst parallele Calls mit offsets.
  // startOffset wird genutzt für "andere Songs zeigen bei wiederholtem Klick"
  // auf Quick-Genre-Buttons.
  const calls: Promise<SpotifyApiTrack[]>[] = [];
  for (let offset = 0; offset < totalLimit; offset += MAX_PER_CALL) {
    const limit = Math.min(MAX_PER_CALL, totalLimit - offset);
    calls.push(searchOnce(token, query, limit, startOffset + offset));
  }

  const results = await Promise.all(calls);
  const all = results.flat();

  // Dedupe per Track-ID — kann passieren wenn offsets sich überlappen
  const seen = new Set<string>();
  const unique: SearchedTrack[] = [];
  for (const item of all) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push({
      id: item.id,
      title: item.name,
      artist: item.artists.map((a) => a.name).join(", "),
      album: item.album.name,
      cover_url: item.album.images[1]?.url ?? item.album.images[0]?.url ?? null,
      duration_ms: item.duration_ms
    });
  }

  return unique.slice(0, totalLimit);
}

interface SpotifyApiTrack {
  id: string;
  name: string;
  duration_ms: number;
  artists: { id: string; name: string }[];
  album: { name: string; images: { url: string }[] };
}

// Genre-Lookup pro Artist — Spotify Artist-Endpoint liefert Genre-Tags.
// Wir cachen aggressiv im Memory, da Artists sich quasi nie aendern.
interface GenresCache {
  genres: string[];
  cachedAt: number;
}
const artistGenresCache = new Map<string, GenresCache>();
const trackArtistCache = new Map<string, string[]>(); // trackId -> artistIds
const GENRES_TTL_MS = 24 * 60 * 60 * 1000; // 24h

async function fetchArtistGenres(token: string, artistId: string): Promise<string[]> {
  const cached = artistGenresCache.get(artistId);
  if (cached && Date.now() - cached.cachedAt < GENRES_TTL_MS) {
    return cached.genres;
  }
  const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 }
  });
  if (!res.ok) return [];
  const data = await res.json();
  const genres = (data.genres ?? []) as string[];
  artistGenresCache.set(artistId, { genres, cachedAt: Date.now() });
  return genres;
}

// Debug: gibt das rohe Spotify-Track + Artist-Response zurueck.
// Dient nur zum Diagnose-Endpoint, NICHT fuer Produktiv-Code.
export async function debugTrackArtists(trackId: string) {
  const token = await getAccessToken();
  const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${trackId}?market=DE`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  const trackStatus = trackRes.status;
  let trackData: unknown = null;
  try { trackData = trackRes.ok ? await trackRes.json() : await trackRes.text(); } catch {}

  if (!trackRes.ok) {
    return { trackStatus, trackData };
  }

  const td = trackData as { name?: string; artists?: { id: string; name: string }[] };
  const artists = td.artists ?? [];
  const artistsDetail = await Promise.all(
    artists.map(async (a) => {
      const r = await fetch(`https://api.spotify.com/v1/artists/${a.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      let body: unknown = null;
      try { body = r.ok ? await r.json() : await r.text(); } catch {}
      return {
        id: a.id,
        name: a.name,
        status: r.status,
        bodyKeys: r.ok && body && typeof body === "object" ? Object.keys(body as object) : null,
        genres: r.ok ? (body as { genres?: string[] })?.genres ?? null : null,
        body
      };
    })
  );

  return {
    trackStatus,
    trackName: td.name ?? null,
    trackArtists: artists.map((a) => ({ id: a.id, name: a.name })),
    artistsDetail,
    tokenPrefix: token.substring(0, 8) + "..."
  };
}

// Holt die zusammengefassten Genre-Tags ALLER beteiligten Artists eines Tracks.
// Wenn mehrere Artists: alle Genres deduppen.
export async function getTrackArtistGenres(trackId: string): Promise<string[]> {
  const token = await getAccessToken();

  // 1) Artist-IDs des Tracks holen (cached pro Track)
  let artistIds = trackArtistCache.get(trackId);
  if (!artistIds) {
    const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${trackId}?market=DE`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 }
    });
    if (!trackRes.ok) return [];
    const trackData = await trackRes.json();
    artistIds = (trackData.artists ?? [])
      .map((a: { id: string }) => a.id)
      .filter(Boolean) as string[];
    trackArtistCache.set(trackId, artistIds);
  }

  if (artistIds.length === 0) return [];

  // 2) Genres aller Artists parallel holen + zusammenfassen
  const allGenres = await Promise.all(
    artistIds.map((id) => fetchArtistGenres(token, id))
  );
  const set = new Set<string>();
  for (const list of allGenres) {
    for (const g of list) set.add(g);
  }
  return Array.from(set);
}
