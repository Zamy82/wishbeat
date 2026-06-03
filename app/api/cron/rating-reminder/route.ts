import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push";

// Vercel-Cron Endpoint — taeglich um 11:00 UTC.
// Schickt einen Push-Reminder an alle Gaeste, die gestern einen Wunsch
// gesendet haben und Push aktiv haben. "Wie war die Party? Tap fuer
// Bewertung." Klick auf die Notification oeffnet /event/[slug]#rating.

interface EventRow {
  id: string;
  slug: string;
  name: string;
}

interface RequestRow {
  requester_session_id: string | null;
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  session_id: string;
  event_id: string;
}

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function yesterdayIsoDate(): string {
  // Gestern in UTC als YYYY-MM-DD (event_date in DB ist DATE).
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  // Auth: Vercel setzt automatisch Authorization: Bearer ${CRON_SECRET}
  // bei Cron-Aufrufen, wenn CRON_SECRET als Env-Var existiert.
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const got = req.headers.get("authorization");
    if (got !== `Bearer ${expected}`) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = adminClient();
  const yesterday = yesterdayIsoDate();

  // 1) Events, deren Datum genau gestern war
  const { data: events, error: evErr } = await admin
    .from("events")
    .select("id, slug, name")
    .eq("event_date", yesterday);

  if (evErr) {
    return NextResponse.json(
      { ok: false, message: `events query failed: ${evErr.message}` },
      { status: 500 }
    );
  }
  if (!events || events.length === 0) {
    return NextResponse.json({ ok: true, message: "Keine Events von gestern.", events: 0 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://wishbeat-zamy82-s-projects.vercel.app";

  let totalSent = 0;
  let totalFailed = 0;
  const deadEndpoints: string[] = [];
  const perEvent: Array<{
    event: string;
    candidates: number;
    sent: number;
    failed: number;
  }> = [];

  for (const ev of events as EventRow[]) {
    // 2) Alle distincten session_ids die fuer dieses Event einen Wunsch hatten
    const { data: reqs } = await admin
      .from("song_requests")
      .select("requester_session_id")
      .eq("event_id", ev.id)
      .not("requester_session_id", "is", null);

    const sessionIds = Array.from(
      new Set(
        (reqs ?? [])
          .map((r) => (r as RequestRow).requester_session_id)
          .filter((s): s is string => !!s)
      )
    );

    if (sessionIds.length === 0) {
      perEvent.push({ event: ev.name, candidates: 0, sent: 0, failed: 0 });
      continue;
    }

    // 3) Push-Subscriptions dieser Sessions
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, session_id, event_id")
      .eq("event_id", ev.id)
      .in("session_id", sessionIds);

    if (!subs || subs.length === 0) {
      perEvent.push({ event: ev.name, candidates: sessionIds.length, sent: 0, failed: 0 });
      continue;
    }

    // 4) Pro Subscription Push senden
    const url = `${baseUrl}/event/${ev.slug}#rating`;
    let sent = 0;
    let failed = 0;
    for (const sub of subs as SubRow[]) {
      const result = await sendPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        {
          title: `⭐ Wie war ${ev.name}?`,
          body: "Tap, um deine Bewertung abzugeben — der DJ freut sich!",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: `rating-reminder-${ev.id}`,
          url
        }
      );
      if (result.ok) {
        sent++;
      } else {
        failed++;
        if (result.statusCode === 404 || result.statusCode === 410) {
          deadEndpoints.push(sub.endpoint);
        }
      }
    }
    totalSent += sent;
    totalFailed += failed;
    perEvent.push({ event: ev.name, candidates: subs.length, sent, failed });
  }

  // 5) Tote Subscriptions aufraeumen
  if (deadEndpoints.length > 0) {
    await admin.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
  }

  return NextResponse.json({
    ok: true,
    yesterday,
    events: events.length,
    totalSent,
    totalFailed,
    deadCleaned: deadEndpoints.length,
    perEvent
  });
}
