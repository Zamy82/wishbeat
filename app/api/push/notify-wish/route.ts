import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push";

// Anonymer Endpunkt — wird vom Gast aufgerufen nachdem er einen Wunsch
// abgeschickt hat. Schickt Push-Notification an den DJ.
//
// Validierung: request_id muss existieren UND zum event_id gehoeren —
// verhindert spam-pushes ohne echten Wunsch.

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
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

  // Wunsch + Event + DJ-Owner laden in einem Query
  const { data: req } = await admin
    .from("song_requests")
    .select(
      "id, title, artist, cover_url, guest_nickname, event_id, events!inner(id, name, owner_id, is_active, slug)"
    )
    .eq("id", body.request_id)
    .single();

  if (!req) {
    return NextResponse.json({ ok: false, error: "Wunsch nicht gefunden" }, { status: 404 });
  }

  const event = req.events as unknown as {
    id: string;
    name: string;
    owner_id: string;
    is_active: boolean;
    slug: string;
  };

  if (!event.is_active) {
    return NextResponse.json({ ok: true, sent: 0, reason: "event_inactive" });
  }

  // DJ-Subscriptions laden
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", event.owner_id)
    .not("user_id", "is", null);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_subscriptions" });
  }

  const fromName = req.guest_nickname?.trim() || "Anonym";
  const results = await Promise.all(
    subs.map((s) =>
      sendPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        {
          title: `🎵 Neuer Wunsch von ${fromName}`,
          body: `${req.title} — ${req.artist}`,
          icon: req.cover_url ?? undefined,
          image: req.cover_url ?? undefined,
          tag: `wish-${req.id}`,
          url: `/dj/event/${event.id}`
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
