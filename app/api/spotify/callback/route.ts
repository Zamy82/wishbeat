import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/spotify-user";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const storedState = request.cookies.get("spotify_oauth_state")?.value;

  if (error) {
    return NextResponse.redirect(new URL(`/dj?spotify=error&reason=${error}`, request.url));
  }
  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(new URL("/dj?spotify=error&reason=state_mismatch", request.url));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/dj/login", request.url));
  }

  try {
    const redirectUri = `${url.origin}/api/spotify/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase.from("spotify_tokens").upsert({
      user_id: user.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scope: tokens.scope,
      updated_at: new Date().toISOString()
    });

    const response = NextResponse.redirect(new URL("/dj?spotify=connected", request.url));
    response.cookies.delete("spotify_oauth_state");
    return response;
  } catch (e) {
    console.error("Spotify callback error:", e);
    return NextResponse.redirect(new URL("/dj?spotify=error&reason=exchange_failed", request.url));
  }
}
