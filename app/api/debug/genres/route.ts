import { NextRequest, NextResponse } from "next/server";
import { debugTrackArtists, searchTracks } from "@/lib/spotify";

// DIAGNOSE-ENDPOINT — gibt das rohe Spotify-Response zurueck
// damit wir sehen, ob Spotify ueberhaupt noch Genre-Tags liefert.
//
// Aufruf:
//   /api/debug/genres?q=Atemlos+Helene+Fischer
//   /api/debug/genres?track_id=SPOTIFY_TRACK_ID

export async function GET(req: NextRequest) {
  const trackId = req.nextUrl.searchParams.get("track_id")?.trim();
  const q = req.nextUrl.searchParams.get("q")?.trim();

  try {
    if (q) {
      const tracks = await searchTracks(q, 1);
      if (tracks.length === 0) {
        return NextResponse.json({ error: "Keine Treffer fuer query", q });
      }
      const result = await debugTrackArtists(tracks[0].id);
      return NextResponse.json({ query: q, foundTrackId: tracks[0].id, ...result });
    }
    if (trackId) {
      const result = await debugTrackArtists(trackId);
      return NextResponse.json(result);
    }
    return NextResponse.json({
      usage: "?q=<search> oder ?track_id=<id>",
      example: "/api/debug/genres?q=Atemlos+Helene+Fischer"
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
