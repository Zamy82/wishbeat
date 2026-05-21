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
// - Wenn artist_name übergeben: Suche nach `artist:"NAME"` → Tracks dieses Künstlers
// - Wenn query übergeben: freie Suche
// - exclude: Track-ID die aus den Ergebnissen rausfliegt (= der aktuell laufende)
export async function GET(req: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ tracks: [], source: null, reason: "no_token" });
  }

  const artistName = req.nextUrl.searchParams.get("artist_name");
  const query = req.nextUrl.searchParams.get("q");
  const excludeId = req.nextUrl.searchParams.get("exclude") ?? "";

  // Suche aufbauen
  let searchQuery: string | null = null;
  let source: "by_artist" | "by_query" | null = null;
  if (artistName) {
    searchQuery = `artist:"${artistName}"`;
    source = "by_artist";
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
    url.searchParams.set("limit", "12");
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
        // Duplikate per "title+artist" rausfiltern (kommt bei Spotify-Search häufig vor)
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
