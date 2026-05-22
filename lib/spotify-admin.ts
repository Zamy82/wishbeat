// Server-side Spotify-Hilfsfunktionen mit Service-Role-Zugriff auf Supabase.
// Wird für anonyme Endpunkte (Gäste-Seite) gebraucht, wo die Spotify-Tokens
// eines DJs benötigt werden ohne dass der DJ selbst eingeloggt ist.

import { createClient } from "@supabase/supabase-js";

interface SpotifyTokenRow {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
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
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };
}

// Holt einen gültigen Spotify-Access-Token für einen bestimmten User.
// Wird für die Gäste-Live-Queue verwendet — der Gast ist nicht eingeloggt,
// wir brauchen aber den DJ-Token.
export async function getAdminSpotifyToken(
  djUserId: string
): Promise<string | null> {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("spotify_tokens")
    .select("*")
    .eq("user_id", djUserId)
    .maybeSingle();

  if (error || !data) return null;
  const token = data as SpotifyTokenRow;

  const expiresAt = new Date(token.expires_at).getTime();
  const needsRefresh = expiresAt - Date.now() < 60_000;

  if (!needsRefresh) return token.access_token;

  // Token läuft bald ab — refresh
  try {
    const refreshed = await refreshAccessToken(token.refresh_token);
    const newExpiresAt = new Date(
      Date.now() + refreshed.expires_in * 1000
    ).toISOString();

    await supabase
      .from("spotify_tokens")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? token.refresh_token,
        expires_at: newExpiresAt,
        scope: refreshed.scope,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", djUserId);

    return refreshed.access_token;
  } catch {
    return null;
  }
}
