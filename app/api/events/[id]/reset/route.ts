import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Loescht alle Wuensche + Play-History fuer ein Event.
// Wird vor Event-Start verwendet, um Test-Daten zu entfernen.
// Bewertungen (event_ratings) bleiben erhalten.

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Nicht eingeloggt." },
      { status: 401 }
    );
  }

  // Ownership pruefen: Event muss dem eingeloggten DJ gehoeren
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, owner_id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (eventError || !event) {
    return NextResponse.json(
      { ok: false, message: "Event nicht gefunden oder kein Zugriff." },
      { status: 404 }
    );
  }

  // 1) Alle Wuensche fuer das Event loeschen
  const { error: reqError } = await supabase
    .from("song_requests")
    .delete()
    .eq("event_id", id);

  if (reqError) {
    return NextResponse.json(
      { ok: false, message: `Wuensche konnten nicht geloescht werden: ${reqError.message}` },
      { status: 500 }
    );
  }

  // 2) Alle Play-Eintraege fuer das Event loeschen (Statistik zuruecksetzen)
  const { error: playsError } = await supabase
    .from("event_plays")
    .delete()
    .eq("event_id", id);

  if (playsError) {
    return NextResponse.json(
      { ok: false, message: `Play-History konnte nicht geloescht werden: ${playsError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
