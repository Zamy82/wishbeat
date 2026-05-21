import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAuthorizeUrl } from "@/lib/spotify-user";
import { randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/dj/login", request.url));
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${new URL(request.url).origin}/api/spotify/callback`;
  const authorizeUrl = buildAuthorizeUrl(state, redirectUri);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("spotify_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/"
  });
  return response;
}
