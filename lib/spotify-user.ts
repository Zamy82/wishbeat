// User-scoped Spotify-Helfer
// Verwendet den Authorization Code Flow, um im Namen des DJs Aktionen
// (z.B. Songs zur Queue hinzufügen) auszuführen.

import { createClient } from "@/lib/supabase/server";

export const SPOTIFY_SCOPES = [
  "user-modify-playback-state",
  "user-read-playback-state",
  "user-read-currently-playing",
  "playlist-modify-private"
].join(" ");

interface SpotifyTokenRow {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string | null;
}

export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES,
    state,
    // show_dialog=true zwingt Spotify den Berechtigungs-Dialog jedes Mal neu
    // anzuzeigen. Verhindert dass Spotify alte Berechtigungen still wieder-
    // verwendet wenn wir neue Scopes (z.B. playlist-modify-private) brauchen.
    show_dialog: "true"
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    }),
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }

  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };
}

async function refreshAccessToken(refreshToken: string) {
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    }),
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`);
  }

  return (await res.json()) as {
    access_token: string;
    refresh_token?: string; // optional — Spotify gibt manchmal einen neuen zurück
    expires_in: number;
    scope: string;
  };
}

// Liefert einen gültigen Access-Token für den aktuell eingeloggten User.
// Refreshed automatisch wenn der Token in <60s abläuft.
export async function getValidAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: row } = await supabase
    .from("spotify_tokens")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) return null;
  const token = row as SpotifyTokenRow;

  const expiresAt = new Date(token.expires_at).getTime();
  const needsRefresh = expiresAt - Date.now() < 60_000;

  if (!needsRefresh) return token.access_token;

  // Refresh
  const refreshed = await refreshAccessToken(token.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await supabase
    .from("spotify_tokens")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? token.refresh_token,
      expires_at: newExpiresAt,
      scope: refreshed.scope,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", user.id);

  return refreshed.access_token;
}

export type QueueResult =
  | { ok: true }
  | { ok: false; code: "no_token"; message: string }
  | { ok: false; code: "no_device"; message: string }
  | { ok: false; code: "no_premium"; message: string }
  | { ok: false; code: "unknown"; message: string };

export async function addTrackToQueue(spotifyTrackId: string): Promise<QueueResult> {
  const token = await getValidAccessToken();
  if (!token) {
    return {
      ok: false,
      code: "no_token",
      message: "Spotify ist nicht verbunden. Verbinde dein Konto im DJ-Dashboard."
    };
  }

  const url = new URL("https://api.spotify.com/v1/me/player/queue");
  url.searchParams.set("uri", `spotify:track:${spotifyTrackId}`);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });

  if (res.ok || res.status === 204) {
    return { ok: true };
  }

  // Spotify-typische Fehler
  if (res.status === 404) {
    return {
      ok: false,
      code: "no_device",
      message:
        "Spotify spielt gerade nirgends ab. Starte einen Song in der Spotify-App, dann nochmal annehmen."
    };
  }
  if (res.status === 403) {
    return {
      ok: false,
      code: "no_premium",
      message: "Diese Funktion benötigt Spotify Premium."
    };
  }

  let body = "";
  try { body = await res.text(); } catch {}
  return {
    ok: false,
    code: "unknown",
    message: `Spotify-Fehler (${res.status}): ${body.slice(0, 200)}`
  };
}
