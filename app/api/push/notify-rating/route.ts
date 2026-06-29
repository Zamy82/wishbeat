import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push";

// Anonymer Endpunkt — wird vom Gast aufgerufen nachdem er eine Bewertung
// abgeschickt hat. Schickt Push-Notification an den DJ.
//
// Validierung: rating_id muss existieren — verhindert Spam-Pushes ohne
// echte Bewertung in der DB.

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  let body: { rating_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.rating_id) {
    return NextResponse.json(
      { ok: false, error: "rating_id missing" },
      { status: 400 }
    );
  }

  const admin = adminClient();

  // Bewertung + Event + DJ-Owner in einem Query laden
  const { data: rating } = await admin
    .from("event_ratings")
    .select(
      "id, rating, comment, nickname, event_id, events!inner(id, name, owner_id, slug)"
    )
    .eq("id", body.rating_id)
    .single();

  if (!rating) {
    return NextResponse.json(
      { ok: false, error: "Bewertung nicht gefunden" },
      { status: 404 }
    );
  }

  const event = rating.events as unknown as {
    id: string;
    name: string;
    owner_id: string;
    slug: string;
  };

  // DJ-Subscriptions laden
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", event.owner_id)
    .not("user_id", "is", null);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_subscriptions" });
  }

  const fromName = rating.nickname?.trim() || "Anonym";
  const stars = "★".repeat(rating.rating);
  const ratingText = rating.comment?.trim()
    ? `"${rating.comment.trim().slice(0, 120)}"`
    : `${rating.rating}/5 Sterne`;

  const results = await Promise.all(
    subs.map((s) =>
      sendPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        {
          title: `${stars} Neue Bewertung von ${fromName}`,
          body: ratingText,
          tag: `rating-${rating.id}`,
          url: `/dj/event/${event.id}`
        }
      )
    )
  );

  // Tote Subscriptions aufräumen
  const dead = subs.filter((_, i) => {
    const r = results[i];
    return !r.ok && (r.statusCode === 404 || r.statusCode === 410);
  });
  if (dead.length > 0) {
    await admin
      .from("push_subscriptions")
      .delete()
      .in("endpoint", dead.map((s) => s.endpoint));
  }

  const sentCount = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, sent: sentCount, total: subs.length });
}
