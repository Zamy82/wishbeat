import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Loescht doppelte event_plays-Eintraege fuer ein Event.
// Definition Duplikat: gleicher spotify_track_id innerhalb 3 Minuten.
// Behaelt den AELTESTEN Eintrag pro Gruppe.

interface RouteContext {
  params: Promise<{ id: string }>;
}

const WINDOW_MS = 3 * 60 * 1000;

export async function POST(_req: NextRequest, ctx: RouteContext) {
  const { id: eventId } = await ctx.params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Nicht eingeloggt." }, { status: 401 });
  }

  // Ownership check
  const { data: event } = await supabase
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

  // Pro Track: merken wann zuletzt gesehen. Wenn neuer Eintrag innerhalb
  // WINDOW_MS nach dem letzten kommt — fuer Loeschung markieren.
  const lastSeenAt = new Map<string, number>();
  const toDelete: string[] = [];
  for (const p of plays ?? []) {
    const t = new Date(p.played_at).getTime();
    const last = lastSeenAt.get(p.spotify_track_id);
    if (last !== undefined && t - last < WINDOW_MS) {
      toDelete.push(p.id);
      // last NICHT updaten — wir wollen alle nahen Duplikate gegen das
      // urspruengliche Original messen (sonst kann sich das Fenster
      // ueber Stunden wandern bei Songs die mehrfach laufen)
    } else {
      lastSeenAt.set(p.spotify_track_id, t);
    }
  }

  if (toDelete.length === 0) {
    return NextResponse.json({ ok: true, removed: 0, kept: plays?.length ?? 0 });
  }

  const { error: delError } = await supabase
    .from("event_plays")
    .delete()
    .in("id", toDelete);

  if (delError) {
    return NextResponse.json(
      { ok: false, message: `Loeschfehler: ${delError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    removed: toDelete.length,
    kept: (plays?.length ?? 0) - toDelete.length
  });
}
