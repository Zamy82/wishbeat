import { NextRequest, NextResponse } from "next/server";
import { getTrackArtistGenres, getGenresByArtistName } from "@/lib/spotify";

// Liefert die Genre-Tags des Kuenstlers fuer einen Track.
// Bevorzugt direkter Lookup ueber ?artist=NAME (kein Spotify-Call).
// Fallback ueber ?track_id=X (Spotify-Track-Lookup + MusicBrainz).
export async function GET(req: NextRequest) {
  const artistName = req.nextUrl.searchParams.get("artist")?.trim();
  if (artistName) {
    try {
      const genres = await getGenresByArtistName(artistName);
      return NextResponse.json({ genres });
    } catch {
      return NextResponse.json({ genres: [] });
    }
  }
  const trackId = req.nextUrl.searchParams.get("track_id")?.trim();
  if (!trackId) {
    return NextResponse.json({ genres: [] });
  }
  try {
    const genres = await getTrackArtistGenres(trackId);
    return NextResponse.json({ genres });
  } catch {
    return NextResponse.json({ genres: [] });
  }
}
