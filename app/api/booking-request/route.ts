import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Buchungs-Anfrage von Gaesten — wenn jemand den DJ fuer eigene Party
// engagieren will. Geht via Service-Role (kein DJ-Login erforderlich)
// und nutzt RLS-policy "anyone_can_insert_booking".

interface Body {
  dj_user_id?: string;
  referrer_event_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  event_date?: string;
  event_type?: string;
  guest_count?: number;
  location?: string;
  message?: string;
}

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const {
    dj_user_id,
    referrer_event_id,
    name,
    email,
    phone,
    event_date,
    event_type,
    guest_count,
    location,
    message
  } = body;

  if (!dj_user_id || !name || !email) {
    return NextResponse.json(
      { ok: false, message: "Name, E-Mail und DJ-ID sind Pflichtfelder." },
      { status: 400 }
    );
  }

  if (!isEmail(email)) {
    return NextResponse.json(
      { ok: false, message: "Ungueltige E-Mail-Adresse." },
      { status: 400 }
    );
  }

  if (name.length > 100 || email.length > 200) {
    return NextResponse.json(
      { ok: false, message: "Eingaben zu lang." },
      { status: 400 }
    );
  }

  const admin = adminClient();

  const { error } = await admin.from("booking_requests").insert({
    dj_user_id,
    referrer_event_id: referrer_event_id ?? null,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone?.trim() || null,
    event_date: event_date || null,
    event_type: event_type?.trim() || null,
    guest_count: typeof guest_count === "number" ? guest_count : null,
    location: location?.trim() || null,
    message: message?.trim() || null,
    status: "new"
  });

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
