import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Anonymer Endpunkt — Gast registriert seine Web-Push-Subscription
// für einen bestimmten Event.

interface Body {
  session_id: string;
  event_id: string;
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.session_id || !body.event_id || !body.subscription?.endpoint) {
    return NextResponse.json(
      { ok: false, error: "Missing fields" },
      { status: 400 }
    );
  }

  const userAgent = request.headers.get("user-agent") ?? null;

  const supabase = adminClient();

  // Upsert via endpoint (unique constraint)
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      session_id: body.session_id,
      event_id: body.event_id,
      endpoint: body.subscription.endpoint,
      p256dh: body.subscription.keys.p256dh,
      auth: body.subscription.keys.auth,
      user_agent: userAgent
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
