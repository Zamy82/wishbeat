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

// Genre-Lookup pro Artist.
// Spotify liefert seit 2024/2025 keine Genre-Tags mehr fuer
// Client-Credentials-Apps (Feld einfach weg aus dem Response).
// Wir benutzen daher MusicBrainz — kostenlose offene Musikdatenbank
// mit reichhaltigen Tags pro Artist. Kein API-Key noetig, nur ein
// sauberer User-Agent.
interface GenresCache {
  genres: string[];
  cachedAt: number;
}
// Cache pro Artist-Name (lowercase) — Spotify-Artist-IDs sind irrelevant
// fuer MusicBrainz, wir suchen ueber Namen.
const artistGenresCache = new Map<string, GenresCache>();
const trackArtistCache = new Map<string, { id: string; name: string }[]>();
const GENRES_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const MB_USER_AGENT = "wishbeat/1.0 (https://wishbeat-zamy82-s-projects.vercel.app)";

interface MBTag { name: string; count: number }
interface MBArtist { id: string; tags?: MBTag[]; genres?: MBTag[] }

async function fetchArtistGenresFromMusicBrainz(artistName: string): Promise<string[]> {
  const cacheKey = artistName.toLowerCase().trim();
  const cached = artistGenresCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < GENRES_TTL_MS) {
    return cached.genres;
  }

  try {
    // Schritt 1: Artist suchen — Phrase-Search mit Quotes fuer exakten Match
    const searchUrl = new URL("https://musicbrainz.org/ws/2/artist/");
    searchUrl.searchParams.set("query", `artist:"${artistName}"`);
    searchUrl.searchParams.set("fmt", "json");
    searchUrl.searchParams.set("limit", "3");
    const searchRes = await fetch(searchUrl.toString(), {
      headers: { "User-Agent": MB_USER_AGENT, Accept: "application/json" },
      next: { revalidate: 86400 }
    });
    if (!searchRes.ok) {
      artistGenresCache.set(cacheKey, { genres: [], cachedAt: Date.now() });
      return [];
    }
    const sData = (await searchRes.json()) as { artists?: MBArtist[] };
    const topMbid = sData.artists?.[0]?.id;
    if (!topMbid) {
      artistGenresCache.set(cacheKey, { genres: [], cachedAt: Date.now() });
      return [];
    }

    // Schritt 2: Tags + Genres holen
    const lookupUrl = `https://musicbrainz.org/ws/2/artist/${topMbid}?inc=tags+genres&fmt=json`;
    const lookupRes = await fetch(lookupUrl, {
      headers: { "User-Agent": MB_USER_AGENT, Accept: "application/json" },
      next: { revalidate: 86400 }
    });
    if (!lookupRes.ok) {
      artistGenresCache.set(cacheKey, { genres: [], cachedAt: Date.now() });
      return [];
    }
    const lData = (await lookupRes.json()) as MBArtist;
    const tags = [
      ...(lData.tags ?? []).map((t) => t.name),
      ...(lData.genres ?? []).map((g) => g.name)
    ];
    const unique = Array.from(new Set(tags.map((t) => t.toLowerCase().trim()))).filter(Boolean);
    artistGenresCache.set(cacheKey, { genres: unique, cachedAt: Date.now() });
    return unique;
  } catch {
    artistGenresCache.set(cacheKey, { genres: [], cachedAt: Date.now() });
    return [];
  }
}

// Debug: zeigt was Spotify + MusicBrainz fuer einen Track liefern.
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
      // MusicBrainz Search + Lookup
      const sUrl = new URL("https://musicbrainz.org/ws/2/artist/");
      sUrl.searchParams.set("query", `artist:"${a.name}"`);
      sUrl.searchParams.set("fmt", "json");
      sUrl.searchParams.set("limit", "3");
      const sRes = await fetch(sUrl.toString(), {
        headers: { "User-Agent": MB_USER_AGENT, Accept: "application/json" },
        cache: "no-store"
      });
      const sData = sRes.ok ? (await sRes.json()) as { artists?: { id: string; name: string; score: number }[] } : null;
      const top = sData?.artists?.[0];

      let lookup: unknown = null;
      if (top?.id) {
        const lRes = await fetch(
          `https://musicbrainz.org/ws/2/artist/${top.id}?inc=tags+genres&fmt=json`,
          { headers: { "User-Agent": MB_USER_AGENT, Accept: "application/json" }, cache: "no-store" }
        );
        lookup = lRes.ok ? await lRes.json() : await lRes.text();
      }
      return {
        spotifyId: a.id,
        name: a.name,
        mbSearch: { status: sRes.status, topMatch: top },
        mbLookup: lookup
      };
    })
  );

  return {
    trackStatus,
    trackName: td.name ?? null,
    artistsDetail
  };
}

// Direkter Weg: Genre-Tags fuer einen Kuenstler-Namen (ohne Spotify).
// Wird verwendet wenn der Kuenstler-Name schon bekannt ist (z. B. aus
// song_requests / event_plays). Spart einen Spotify-API-Call und vermeidet
// Rate-Limits.
export async function getGenresByArtistName(artistName: string): Promise<string[]> {
  if (!artistName) return [];
  // Nur primaerer Kuenstler (vor Komma/&/feat)
  const primary = artistName
    .split(/[,&]|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b/i)[0]
    ?.trim();
  if (!primary) return [];
  return fetchArtistGenresFromMusicBrainz(primary);
}

// Holt die zusammengefassten Genre-Tags ALLER beteiligten Artists eines Tracks.
// Spotify liefert die Artist-Namen, MusicBrainz die Tags.
// Wird nur noch als Fallback genutzt — wo es geht, getGenresByArtistName.
export async function getTrackArtistGenres(trackId: string): Promise<string[]> {
  const token = await getAccessToken();

  // 1) Artist-Namen des Tracks holen (cached pro Track)
  let artists = trackArtistCache.get(trackId);
  if (!artists) {
    const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${trackId}?market=DE`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 }
    });
    if (!trackRes.ok) return [];
    const trackData = await trackRes.json();
    artists = (trackData.artists ?? [])
      .map((a: { id: string; name: string }) => ({ id: a.id, name: a.name }))
      .filter((a: { id: string; name: string }) => a.id && a.name) as { id: string; name: string }[];
    trackArtistCache.set(trackId, artists);
  }

  if (artists.length === 0) return [];

  // 2) Genres aller Artists parallel von MusicBrainz holen
  const allGenres = await Promise.all(
    artists.map((a) => fetchArtistGenresFromMusicBrainz(a.name))
  );
  const set = new Set<string>();
  for (const list of allGenres) {
    for (const g of list) set.add(g);
  }
  return Array.from(set);
}
