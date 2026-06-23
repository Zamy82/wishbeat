import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import InsightsDashboard from "./InsightsDashboard";

interface EventRow {
  id: string;
  name: string;
  event_date: string;
}

interface PlayRow {
  event_id: string;
  spotify_track_id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  source: string | null;
  played_at: string;
}

interface ReactionRow {
  event_id: string;
  spotify_track_id: string;
  reaction: "fire" | "dance" | "meh";
}

interface RatingRow {
  event_id: string;
  rating: number;
}

export default async function InsightsPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/dj/login");

  // Events des DJs
  const { data: events } = await supabase
    .from("events")
    .select("id, name, event_date")
    .eq("owner_id", user.id);

  const eventIds = (events ?? []).map((e: EventRow) => e.id);

  if (eventIds.length === 0) {
    return (
      <main className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
        <Link
          href="/dj"
          className="text-white/40 hover:text-white text-sm mb-6 inline-block transition"
        >
          ← Zurück zum Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-white mb-3">
          📊 Wissensdatenbank
        </h1>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <p className="text-white/50">
            Noch keine Events. Nach deiner ersten Party sammeln sich hier die
            Stats für deine Vorbereitung künftiger Events.
          </p>
        </div>
      </main>
    );
  }

  // Parallel laden: Plays, Reactions, Ratings
  const [{ data: plays }, { data: reactions }, { data: ratings }] = await Promise.all([
    supabase
      .from("event_plays")
      .select("event_id, spotify_track_id, title, artist, cover_url, source, played_at")
      .in("event_id", eventIds),
    supabase
      .from("song_reactions")
      .select("event_id, spotify_track_id, reaction")
      .in("event_id", eventIds),
    supabase
      .from("event_ratings")
      .select("event_id, rating")
      .in("event_id", eventIds)
  ]);

  return (
    <main className="min-h-screen px-4 py-10 max-w-5xl mx-auto">
      <Link
        href="/dj"
        className="text-white/40 hover:text-white text-sm mb-6 inline-block transition"
      >
        ← Zurück zum Dashboard
      </Link>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          📊 Wissensdatenbank
        </h1>
        <p className="text-white/40 text-sm mt-1">
          Was bei deinen Events funktioniert hat — für die Vorbereitung der nächsten Party.
        </p>
      </header>

      <InsightsDashboard
        events={(events ?? []) as EventRow[]}
        plays={(plays ?? []) as PlayRow[]}
        reactions={(reactions ?? []) as ReactionRow[]}
        ratings={(ratings ?? []) as RatingRow[]}
      />
    </main>
  );
}
