import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/spotify-user";

// Erstellt eine private Spotify-Playlist aus den gespielten Songs des Events.
// DJ kann den URL danach mit dem Gastgeber (Angie etc.) teilen.
//
// Reihenfolge: chronologisch nach played_at — die echte Setlist-Reihenfolge.
// Duplikate werden entfernt (selber Spotify-Track-ID erscheint nur einmal).

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface SpotifyMe {
  id: string;
  display_name?: string;
}

interface SpotifyPlaylist {
  id: string;
  external_urls: { spotify: string };
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: eventId } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
  }

  // Event muss dem DJ gehoeren
  const { data: event } = await supabase
    .from("events")
    .select("id, name, event_date, owner_id, memory_playlist_url")
    .eq("id", eventId)
    .eq("owner_id", user.id)
    .single();
  if (!event) {
    return NextResponse.json({ ok: false, error: "Event nicht gefunden" }, { status: 404 });
  }

  // Spotify-Token holen
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_token",
        message: "Spotify ist nicht verbunden. Verbinde dein Konto im DJ-Dashboard."
      },
      { status: 400 }
    );
  }

  // Alle gespielten Songs des Events laden (chronologisch)
  const { data: plays } = await supabase
    .from("event_plays")
    .select("spotify_track_id, title, played_at")
    .eq("event_id", eventId)
    .order("played_at", { ascending: true });

  if (!plays || plays.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_plays",
        message:
          "Keine gespielten Songs gefunden. Sobald du Songs spielst werden sie automatisch gesammelt."
      },
      { status: 400 }
    );
  }

  // Duplikate entfernen, Reihenfolge beibehalten
  const seen = new Set<string>();
  const uniqueTrackIds: string[] = [];
  for (const p of plays as Array<{ spotify_track_id: string }>) {
    if (!seen.has(p.spotify_track_id)) {
      seen.add(p.spotify_track_id);
      uniqueTrackIds.push(p.spotify_track_id);
    }
  }

  // 1) Spotify-User-ID holen
  const meRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  if (!meRes.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "spotify_me_failed",
        message: `Spotify /me fehlgeschlagen (${meRes.status}). Verbinde Spotify ggf. neu.`
      },
      { status: 500 }
    );
  }
  const me = (await meRes.json()) as SpotifyMe;

  // 2) Playlist erstellen
  const dateLabel = new Date(event.event_date).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
  const playlistName = `${event.name} — Memory Playlist`;
  const description = `Setlist von ${dateLabel} — alle ${uniqueTrackIds.length} gespielten Songs, in der Reihenfolge wie sie liefen. Erstellt von wishbeat.`;

  const createRes = await fetch(
    `https://api.spotify.com/v1/users/${encodeURIComponent(me.id)}/playlists`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: playlistName,
        description,
        public: false
      }),
      cache: "no-store"
    }
  );
  if (!createRes.ok) {
    const txt = await createRes.text().catch(() => "");
    const isScope = txt.includes("Insufficient client scope") || createRes.status === 403;
    return NextResponse.json(
      {
        ok: false,
        error: isScope ? "missing_scope" : "playlist_create_failed",
        message: isScope
          ? "Spotify-Berechtigung fehlt. Bitte trenne Spotify und verbinde neu — der erweiterte Playlist-Zugriff wird dann angefragt."
          : `Playlist-Erstellung fehlgeschlagen (${createRes.status}). ${txt.slice(0, 200)}`
      },
      { status: 400 }
    );
  }
  const playlist = (await createRes.json()) as SpotifyPlaylist;

  // 3) Tracks hinzufuegen — Spotify-Limit 100 pro Request
  const trackUris = uniqueTrackIds.map((id) => `spotify:track:${id}`);
  const chunks: string[][] = [];
  for (let i = 0; i < trackUris.length; i += 100) {
    chunks.push(trackUris.slice(i, i + 100));
  }
  for (const chunk of chunks) {
    const addRes = await fetch(
      `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ uris: chunk }),
        cache: "no-store"
      }
    );
    if (!addRes.ok) {
      const txt = await addRes.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          error: "tracks_add_failed",
          message: `Tracks hinzufuegen fehlgeschlagen (${addRes.status}). ${txt.slice(0, 200)}`,
          playlist_url: playlist.external_urls.spotify
        },
        { status: 500 }
      );
    }
  }

  // 4) URL speichern in events
  await supabase
    .from("events")
    .update({
      memory_playlist_url: playlist.external_urls.spotify,
      memory_playlist_created_at: new Date().toISOString()
    })
    .eq("id", eventId);

  return NextResponse.json({
    ok: true,
    playlist_url: playlist.external_urls.spotify,
    track_count: uniqueTrackIds.length,
    playlist_id: playlist.id
  });
}

// GET — gibt die existierende Playlist-URL zurueck (falls schon erstellt)
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id: eventId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("memory_playlist_url, memory_playlist_created_at")
    .eq("id", eventId)
    .eq("owner_id", user.id)
    .single();

  return NextResponse.json({
    ok: true,
    playlist_url: event?.memory_playlist_url ?? null,
    created_at: event?.memory_playlist_created_at ?? null
  });
}
