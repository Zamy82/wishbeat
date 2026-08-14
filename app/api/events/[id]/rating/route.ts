import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Server-seitige Bewertungs-Einreichung (statt Direct-Insert vom Browser).
// Erzwingt: rating 1-5, Laengen-Limits, eine Bewertung pro Gast (Session).
// Erlaubt Bewertungen auch NACH Event-Ende (fuer den Bewertungs-Aufruf) —
// das war ueber die alte is_active-RLS-Policy blockiert.

interface Body {
  rating?: number;
  comment?: string | null;
  nickname?: string | null;
  requester_session_id?: string;
}

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: eventId } = await ctx.params;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Ungueltiges JSON." }, { status: 400 });
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { ok: false, message: "Bitte 1 bis 5 Sterne vergeben." },
      { status: 400 }
    );
  }

  const sessionId = body.requester_session_id?.trim() || null;
  const comment = body.comment?.trim()?.slice(0, 500) || null;
  const nickname = body.nickname?.trim()?.slice(0, 40) || null;

  const supabase = adminClient();

  // Event muss existieren (Bewertung auch nach Ende erlaubt)
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ ok: false, message: "Event nicht gefunden." }, { status: 404 });
  }

  // Eine Bewertung pro Gast (Session) — nur wenn die session_id-Spalte existiert.
  if (sessionId) {
    const { data: existing, error: dupErr } = await supabase
      .from("event_ratings")
      .select("id")
      .eq("event_id", eventId)
      .eq("session_id", sessionId)
      .limit(1);
    if (!dupErr && existing && existing.length > 0) {
      return NextResponse.json(
        { ok: false, message: "Du hast dieses Event schon bewertet — danke dir! 🙏" },
        { status: 429 }
      );
    }
  }

  const baseRow = { event_id: eventId, rating, comment, nickname };

  // Mit session_id; falls die Spalte (noch) nicht existiert, ohne erneut.
  let inserted: { id: string } | null = null;
  let error: { message?: string; code?: string } | null = null;
  {
    const res = await supabase
      .from("event_ratings")
      .insert({ ...baseRow, session_id: sessionId })
      .select("id")
      .single();
    inserted = res.data;
    error = res.error;
  }
  if (error) {
    const m = (error.message ?? "").toLowerCase();
    if (m.includes("session_id") || m.includes("schema cache") || error.code === "PGRST204") {
      const res = await supabase.from("event_ratings").insert(baseRow).select("id").single();
      inserted = res.data;
      error = res.error;
    }
  }
  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message ?? "Speichern fehlgeschlagen." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: inserted?.id });
}
