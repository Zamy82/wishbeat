import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Loescht ALLE doppelten event_plays-Eintraege fuer ein Event.
// Behaelt den AELTESTEN Eintrag pro spotify_track_id, loescht alle anderen.
// Drastisch — aber genau das was wir brauchen um Testphasen-Muell zu entfernen.
// Im echten Betrieb verhindert bereits die track-play Dedupe (3-Min-Window)
// neue Duplikate, deshalb hier kein Praxis-Verlust.

interface RouteContext {
  params: Promise<{ id: string }>;
}

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
  const { id: eventId } = await ctx.params;

  // Ownership-Check ueber User-Session
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Nicht eingeloggt." }, { status: 401 });
  }
  const { data: event } = await userSupabase
    .from("events")
    .select("id, owner_id")
    .eq("id", eventId)
    .eq("owner_id", user.id)
    .single();
  if (!event) {
    return NextResponse.json(
      { ok: false, message: "Event nicht gefunden oder kein Zugriff." },
      { status: 404 }
    );
  }

  // Ab hier mit Service-Role: garantiert kein RLS-Stolperdraht beim Delete
  const supabase = adminClient();

  // Alle Plays holen, sortiert nach Zeit aufsteigend
  const { data: plays, error: readError } = await supabase
    .from("event_plays")
    .select("id, spotify_track_id, played_at")
    .eq("event_id", eventId)
    .order("played_at", { ascending: true });

  if (readError) {
    return NextResponse.json(
      { ok: false, message: `Lesefehler: ${readError.message}` },
      { status: 500 }
    );
  }

  // Pro spotify_track_id: ersten Eintrag behalten, alle weiteren loeschen.
  const seen = new Set<string>();
  const toDelete: string[] = [];
  for (const p of plays ?? []) {
    if (seen.has(p.spotify_track_id)) {
      toDelete.push(p.id);
    } else {
      seen.add(p.spotify_track_id);
    }
  }

  if (toDelete.length === 0) {
    return NextResponse.json({ ok: true, removed: 0, kept: plays?.length ?? 0 });
  }

  const { error: delError, count } = await supabase
    .from("event_plays")
    .delete({ count: "exact" })
    .in("id", toDelete);

  if (delError) {
    return NextResponse.json(
      { ok: false, message: `Loeschfehler: ${delError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    removed: count ?? toDelete.length,
    kept: (plays?.length ?? 0) - toDelete.length,
    uniqueSongs: seen.size
  });
}
