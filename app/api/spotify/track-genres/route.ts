import { NextRequest, NextResponse } from "next/server";
import { getTrackArtistGenres } from "@/lib/spotify";

// Liefert die Genre-Tags des Kuenstlers fuer einen Track.
// Wird vom Gaeste-Formular (Match-Preview) und vom DJ-Tracking benutzt.
export async function GET(req: NextRequest) {
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
