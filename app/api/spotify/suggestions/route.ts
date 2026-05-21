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

// Spotify hat das Search-Limit für unsere App auf 10 reduziert — alles darüber
// gibt 400 "Invalid limit". Wir gleichen das durch mehrere parallele Queries aus.
const MAX_SEARCH_LIMIT = 10;

async function searchSpotify(
  token: string,
  query: string,
  requestedLimit = MAX_SEARCH_LIMIT
): Promise<SpotifyTrackRaw[]> {
  const limit = Math.min(requestedLimit, MAX_SEARCH_LIMIT);
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("market", "DE");

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { tracks: { items: SpotifyTrackRaw[] } };
    return data.tracks.items;
  } catch {
    return [];
  }
}

// Vorschläge via Search-API.
// Strategie:
// - artist_name: Suche nach Tracks des Künstlers, mit Fallback bei spärlichen Daten
// - year: Era-Suche mit mehreren Fallback-Queries (year allein, year+hits, year+tag:hipster, year+pop)
// - q: freie Suche
// - exclude: Track-ID die rausfliegt (= aktuell laufender Track)
// - exclude_artist: Künstler den wir rausfiltern (bei Era-Vorschlägen)
export async function GET(req: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ tracks: [], source: null, reason: "no_token" });
  }

  const artistName = req.nextUrl.searchParams.get("artist_name");
  const query = req.nextUrl.searchParams.get("q");
  const yearParam = req.nextUrl.searchParams.get("year");
  const excludeId = req.nextUrl.searchParams.get("exclude") ?? "";
  const excludeArtist =
    req.nextUrl.searchParams.get("exclude_artist")?.toLowerCase() ?? "";

  let rawTracks: SpotifyTrackRaw[] = [];
  let source: "by_artist" | "by_query" | "by_era" | null = null;

  if (artistName) {
    // 3 parallele Such-Strategien — kompensiert das niedrige Limit
    const [strict, loose, byTitle] = await Promise.all([
      searchSpotify(token, `artist:"${artistName}"`),
      searchSpotify(token, artistName),
      searchSpotify(token, `${artistName} hits`)
    ]);
    rawTracks = [...strict, ...loose, ...byTitle];
    source = "by_artist";
  } else if (yearParam) {
    const y = parseInt(yearParam, 10);
    if (!isNaN(y) && y > 1900 && y < 2100) {
      // 5 parallele Era-Suchen → genug Vielfalt trotz limit=10 pro Call
      const yMin = Math.max(1900, y - 1);
      const yMax = y + 1;
      const [base, hits, hipster, charts, pop] = await Promise.all([
        searchSpotify(token, `year:${yMin}-${yMax}`),
        searchSpotify(token, `year:${yMin}-${yMax} hits`),
        searchSpotify(token, `year:${yMin}-${yMax} tag:hipster`),
        searchSpotify(token, `year:${yMin}-${yMax} charts`),
        searchSpotify(token, `year:${yMin}-${yMax} pop`)
      ]);
      rawTracks = [...base, ...hits, ...hipster, ...charts, ...pop];
      source = "by_era";
    }
  } else if (query) {
    rawTracks = await searchSpotify(token, query);
    source = "by_query";
  }

  if (rawTracks.length === 0) {
    return NextResponse.json({
      tracks: [],
      source,
      reason: source ? "no_results" : "no_seed"
    });
  }

  // Filtern + dedupen
  const seen = new Set<string>();
  const tracks = rawTracks
    .filter((t) => t.id !== excludeId)
    .filter((t) => {
      if (excludeArtist) {
        const primary = t.artists[0]?.name?.toLowerCase() ?? "";
        if (primary === excludeArtist) return false;
      }
      // Dedupe per Track-ID UND per title+artist (Spotify hat oft Re-Releases)
      if (seen.has(t.id)) return false;
      const key = `${t.name.toLowerCase()}|${t.artists[0]?.name?.toLowerCase() ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(t.id);
      seen.add(key);
      return true;
    })
    .map(toTrack)
    .slice(0, 8);

  return NextResponse.json({ tracks, source, total_raw: rawTracks.length });
}
