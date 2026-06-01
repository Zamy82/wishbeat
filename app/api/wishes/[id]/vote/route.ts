import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Toggle-Vote: wenn der Gast (per session_id) noch keinen Vote auf diesen
// Wunsch hat, wird einer angelegt. Wenn schon einer existiert, wird er
// geloescht. Idempotent.

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface Body {
  session_id?: string;
}

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: requestId } = await ctx.params;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Ungueltiges JSON." }, { status: 400 });
  }
  const sessionId = body.session_id?.trim();
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, message: "session_id fehlt." },
      { status: 400 }
    );
  }

  const supabase = adminClient();

  // Pruefen ob der Wunsch ueberhaupt existiert und in welchem Event
  const { data: wish } = await supabase
    .from("song_requests")
    .select("id, event_id, status")
    .eq("id", requestId)
    .single();
  if (!wish) {
    return NextResponse.json(
      { ok: false, message: "Wunsch nicht gefunden." },
      { status: 404 }
    );
  }
  // Nur fuer offene/angenommene Wuensche darf gevotet werden
  if (wish.status !== "pending" && wish.status !== "approved") {
    return NextResponse.json({
      ok: false,
      message: "Fuer gespielte/abgelehnte Wuensche kann nicht mehr gevotet werden."
    });
  }

  // Existiert bereits ein Vote? Wenn ja: loeschen (Toggle-Off)
  const { data: existing } = await supabase
    .from("song_request_votes")
    .select("id")
    .eq("request_id", requestId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("song_request_votes")
      .delete()
      .eq("id", existing.id);
    if (error) {
      return NextResponse.json(
        { ok: false, message: `Loeschen fehlgeschlagen: ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, voted: false });
  }

  // Sonst neuen Vote anlegen
  const { error: insError } = await supabase
    .from("song_request_votes")
    .insert({ request_id: requestId, session_id: sessionId });
  if (insError) {
    return NextResponse.json(
      { ok: false, message: `Voten fehlgeschlagen: ${insError.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, voted: true });
}
