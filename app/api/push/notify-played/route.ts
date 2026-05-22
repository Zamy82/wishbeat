import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push";

// Trigger-Endpunkt: wird vom DJ-Dashboard aufgerufen wenn ein Wunsch
// auto-/manuell als "played" markiert wird. Sendet Web-Push an den Gast
// der den Wunsch eingereicht hat.
//
// Auth: DJ muss eingeloggt sein und Eigentümer des Events sein.

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  // DJ-Auth prüfen
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { request_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.request_id) {
    return NextResponse.json(
      { ok: false, error: "request_id missing" },
      { status: 400 }
    );
  }

  const admin = adminClient();

  // Request + Event laden
  const { data: req } = await admin
    .from("song_requests")
    .select("id, event_id, spotify_track_id, title, artist, cover_url, requester_session_id, events!inner(owner_id, name, slug)")
    .eq("id", body.request_id)
    .single();

  if (!req) {
    return NextResponse.json({ ok: false, error: "Request not found" }, { status: 404 });
  }

  // Check: DJ ist Owner des Events
  const eventOwner = (req.events as unknown as { owner_id: string; name: string; slug: string });
  if (eventOwner.owner_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // Keine Push wenn keine session_id (Wunsch aus alter Pre-Push-Zeit)
  if (!req.requester_session_id) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_session" });
  }

  // Alle Subscriptions dieser Session für dieses Event laden
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("session_id", req.requester_session_id)
    .eq("event_id", req.event_id);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_subscriptions" });
  }

  // Push an alle Subscriptions parallel
  const results = await Promise.all(
    subs.map((s) =>
      sendPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        {
          title: "🎵 Dein Wunschsong läuft jetzt!",
          body: `${req.title} — ${req.artist}`,
          icon: req.cover_url ?? undefined,
          image: req.cover_url ?? undefined,
          tag: `played-${req.spotify_track_id}`,
          url: `/event/${eventOwner.slug}`
        }
      )
    )
  );

  // Tote Subscriptions (404/410) aufräumen
  const dead = subs.filter((_, i) => {
    const r = results[i];
    return !r.ok && (r.statusCode === 404 || r.statusCode === 410);
  });
  if (dead.length > 0) {
    await admin
      .from("push_subscriptions")
      .delete()
      .in(
        "endpoint",
        dead.map((s) => s.endpoint)
      );
  }

  const sentCount = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, sent: sentCount, total: subs.length });
}
