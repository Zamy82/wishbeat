import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import LiveQueue from "./LiveQueue";
import EventControls from "./EventControls";
import TaglineEditor from "./TaglineEditor";
import RatingsPanel from "./RatingsPanel";
import StatsPanel from "./StatsPanel";
import DjPushOptIn from "./DjPushOptIn";
import ResetWishlistButton from "./ResetWishlistButton";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DjEventPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/dj/login");

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (!event) notFound();

  const { data: requests } = await supabase
    .from("song_requests")
    .select("*")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  const { data: ratings } = await supabase
    .from("event_ratings")
    .select("*")
    .eq("event_id", id)
    .order("created_at", { ascending: false });

  const { data: plays } = await supabase
    .from("event_plays")
    .select("*")
    .eq("event_id", id)
    .order("played_at", { ascending: true });

  const eventUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/event/${event.slug}`;

  return (
    <main className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      <header className="mb-8">
        <Link
          href="/dj"
          className="text-white/40 hover:text-white text-sm mb-4 inline-block transition"
        >
          ← Zurück
        </Link>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-white">{event.name}</h1>
            <TaglineEditor eventId={id} initialTagline={event.tagline} />
            <p className="text-white/40 text-sm mt-1">
              {new Date(event.event_date).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "long",
                year: "numeric"
              })}
            </p>
            <span
              className={`inline-block mt-2 text-xs px-2.5 py-1 rounded-full font-medium ${
                event.is_active
                  ? "bg-neon-cyan/20 text-neon-cyan"
                  : "bg-white/10 text-white/40"
              }`}
            >
              {event.is_active ? "Aktiv — nimmt Wünsche an" : "Beendet"}
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <QRCodeDisplay value={eventUrl} size={140} />
            <p className="text-white/30 text-xs text-center max-w-[140px] break-all">
              {eventUrl}
            </p>
            <Link
              href={`/dj/event/${id}/flyer`}
              className="mt-2 px-4 py-2 rounded-full bg-gradient-to-r from-neon-pink to-neon-purple text-white text-xs font-semibold hover:opacity-90 transition"
            >
              🖨️ Flyer drucken
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <EventControls eventId={id} isActive={event.is_active} />
          <Link
            href="/dj/assistant"
            className="px-4 py-2 rounded-full border border-white/20 text-white/80 hover:text-white hover:border-white/40 text-sm transition"
          >
            🎛️ DJ-Assistent öffnen
          </Link>
        </div>
      </header>

      <DjPushOptIn />

      <section>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-lg font-semibold text-white/80">
            Wunschliste{" "}
            <span className="text-white/30 font-normal text-base">
              ({requests?.length ?? 0})
            </span>
          </h2>
          <ResetWishlistButton
            eventId={id}
            hasData={(requests?.length ?? 0) > 0 || (plays?.length ?? 0) > 0}
          />
        </div>
        <LiveQueue eventId={id} initialRequests={requests ?? []} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-white/80 mb-4">📊 Statistik</h2>
        <StatsPanel
          eventId={id}
          initialRequests={requests ?? []}
          initialPlays={plays ?? []}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-white/80 mb-4">
          ⭐ Bewertungen{" "}
          <span className="text-white/30 font-normal text-base">
            ({ratings?.length ?? 0})
          </span>
        </h2>
        <RatingsPanel eventId={id} initialRatings={ratings ?? []} />
      </section>
    </main>
  );
}
