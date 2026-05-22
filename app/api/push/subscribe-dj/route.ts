import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

// DJ-Variante des Subscribe-Endpunkts.
// Speichert eine Push-Subscription, die einem User (DJ) gehört —
// nicht einer Gast-Session.

interface Body {
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
}

function adminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.subscription?.endpoint) {
    return NextResponse.json(
      { ok: false, error: "Missing subscription" },
      { status: 400 }
    );
  }

  const userAgent = request.headers.get("user-agent") ?? null;
  const admin = adminClient();

  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      session_id: `dj-${user.id}`, // Placeholder, NOT NULL constraint zufrieden
      event_id: null,
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
