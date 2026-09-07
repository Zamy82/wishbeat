import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Oeffentliche Bewertungs-Historie eines DJs (fuer die Gaeste-Schau auf der
// Event-Seite). Nutzt den Service-Role-Zugang, damit auch Bewertungen aus
// BEENDETEN Events sichtbar bleiben — die anon-RLS zeigt nur aktive Events und
// laesst so einen Teil der Historie verschwinden.
//
// Gibt bewusst NUR oeffentliche Felder zurueck (rating, comment, nickname,
// event_name, created_at) — nichts Sensibles.

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

interface RouteContext {
  params: Promise<{ ownerId: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { ownerId } = await ctx.params;
  const supabase = adminClient();

  const { data: evs } = await supabase
    .from("events")
    .select("id, name")
    .eq("owner_id", ownerId);

  if (!evs || evs.length === 0) {
    return NextResponse.json({ reviews: [], count: 0, avg: 0 });
  }

  const evMap = new Map(
    evs.map((e: { id: string; name: string }) => [e.id, e.name])
  );
  const evIds = evs.map((e: { id: string }) => e.id);

  const { data: rs } = await supabase
    .from("event_ratings")
    .select("event_id, rating, comment, nickname, created_at")
    .in("event_id", evIds)
    .order("created_at", { ascending: false });

  const reviews = (rs ?? []).map(
    (r: {
      event_id: string;
      rating: number;
      comment: string | null;
      nickname: string | null;
      created_at: string;
    }) => ({
      rating: r.rating,
      comment: r.comment,
      nickname: r.nickname,
      created_at: r.created_at,
      event_name: evMap.get(r.event_id) ?? "—"
    })
  );

  const count = reviews.length;
  const avg =
    count > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
      : 0;

  return NextResponse.json({ reviews, count, avg });
}
