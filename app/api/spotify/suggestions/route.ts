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

// Vorschläge via Search-API (Spotify hat /recommendations für neue Apps gesperrt).
// Strategie:
// - artist_name: Suche nach `artist:"NAME"` → Tracks dieses Künstlers
// - year: Suche nach `year:Y-Y+2` → Tracks aus dieser Era (für "passende Songs aus der Zeit")
// - q: freie Suche
// - exclude: Track-ID die aus den Ergebnissen rausfliegt (= der aktuell laufende)
// - exclude_artist: Künstler-Name den wir aus den Ergebnissen rausfiltern
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

  // Suche aufbauen
  let searchQuery: string | null = null;
  let source: "by_artist" | "by_query" | "by_era" | null = null;
  if (artistName) {
    searchQuery = `artist:"${artistName}"`;
    source = "by_artist";
  } else if (yearParam) {
    const y = parseInt(yearParam, 10);
    if (!isNaN(y) && y > 1900 && y < 2100) {
      // Range von -1 bis +1 Jahr für die Era-Vibe — das fängt das Genre/Zeitgeist gut ein
      searchQuery = `year:${y - 1}-${y + 1}`;
      source = "by_era";
    }
  } else if (query) {
    searchQuery = query;
    source = "by_query";
  }

  if (!searchQuery) {
    return NextResponse.json({ tracks: [], source: null, reason: "no_seed" });
  }

  try {
    const url = new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("q", searchQuery);
    url.searchParams.set("type", "track");
    url.searchParams.set("limit", "30");
    url.searchParams.set("market", "DE");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });

    if (!res.ok) {
      return NextResponse.json({ tracks: [], source: null, reason: `search_${res.status}` });
    }

    const data = (await res.json()) as { tracks: { items: SpotifyTrackRaw[] } };
    const seen = new Set<string>();
    const tracks = data.tracks.items
      .filter((t) => t.id !== excludeId)
      .filter((t) => {
        // Künstler ausschließen (für Era-Vorschläge: aktuellen Künstler nicht zeigen)
        if (excludeArtist) {
          const primary = t.artists[0]?.name?.toLowerCase() ?? "";
          if (primary === excludeArtist || primary.includes(excludeArtist)) {
            return false;
          }
        }
        // Duplikate per "title+artist" rausfiltern
        const key = `${t.name.toLowerCase()}|${t.artists[0]?.name?.toLowerCase() ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(toTrack)
      .slice(0, 8);

    return NextResponse.json({ tracks, source });
  } catch {
    return NextResponse.json({ tracks: [], source: null, reason: "fetch_error" });
  }
}
