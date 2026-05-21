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

  try {
    const tracks = await searchTracks(q, limit);
    return NextResponse.json({ tracks });
  } catch (err) {
    console.error("Spotify search error:", err);
    return NextResponse.json(
      { error: "Songsuche nicht verfügbar" },
      { status: 503 }
    );
  }
}
