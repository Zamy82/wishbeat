import { NextRequest, NextResponse } from "next/server";
import { searchTracks } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ tracks: [] });
  }

  // Optional ?limit= — default 20 für DJ-Suche (war 8)
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(50, Math.max(1, parseInt(limitParam, 10) || 20)) : 20;

  // Optional ?offset= — fuer Variation bei wiederholten Klicks auf Quick-Genre
  const offsetParam = request.nextUrl.searchParams.get("offset");
  const offset = offsetParam
    ? Math.min(900, Math.max(0, parseInt(offsetParam, 10) || 0))
    : 0;

  try {
    const tracks = await searchTracks(q, limit, offset);
    return NextResponse.json({ tracks });
  } catch (err) {
    console.error("Spotify search error:", err);
    return NextResponse.json(
      { error: "Songsuche nicht verfügbar" },
      { status: 503 }
    );
  }
}
