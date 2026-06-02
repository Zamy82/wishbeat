import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push";

// Echter Server-side Test-Push: schickt eine Push-Nachricht an die
// session_id + event_id im Body. Geht durch den vollen Weg
// (Web-Push -> Service Worker -> System-Notification), damit der Gast
// pruefen kann ob's auch bei gesperrtem Bildschirm + geschlossener App
// ankommt.

interface Body {
  session_id?: string;
  event_id?: string;
}

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Ungueltiges JSON." }, { status: 400 });
  }
  if (!body.session_id || !body.event_id) {
    return NextResponse.json(
      { ok: false, message: "session_id + event_id noetig." },
      { status: 400 }
    );
  }

  const admin = adminClient();

  // Alle Subscriptions dieses Gastes fuer dieses Event laden
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("session_id", body.session_id)
    .eq("event_id", body.event_id);

  if (!subs || subs.length === 0) {
    return NextResponse.json({
      ok: false,
      message: "Keine Push-Subscription gefunden. Erst Push aktivieren!",
      sent: 0
    });
  }

  const results = await Promise.all(
    subs.map((s) =>
      sendPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        {
          title: "🎵 Test: Dein Wunschsong läuft!",
          body: "Wenn du das hier siehst, klappt's auch beim echten Song. 🎉",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: "test-server-push"
        }
      )
    )
  );

  // Tote Subscriptions (404/410) aufraeumen
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
  return NextResponse.json({
    ok: sentCount > 0,
    sent: sentCount,
    total: subs.length,
    message: sentCount > 0
      ? `Push gesendet (${sentCount}/${subs.length}). Bildschirm sperren — sollte gleich kommen!`
      : "Push konnte nicht zugestellt werden."
  });
}
