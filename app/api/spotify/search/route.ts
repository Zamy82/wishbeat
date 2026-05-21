import { NextRequest, NextResponse } from "next/server";
import { searchTracks } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ tracks: [] });
  }

  try {
    const tracks = await searchTracks(q);
    return NextResponse.json({ tracks });
  } catch (err) {
    console.error("Spotify search error:", err);
    return NextResponse.json(
      { error: "Songsuche nicht verfügbar" },
      { status: 503 }
    );
  }
}
