import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import LiveQueue from "./LiveQueue";
import EventControls from "./EventControls";

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
          </div>
        </div>

        <EventControls eventId={id} isActive={event.is_active} />
      </header>

      <section>
        <h2 className="text-lg font-semibold text-white/80 mb-4">
          Wunschliste{" "}
          <span className="text-white/30 font-normal text-base">
            ({requests?.length ?? 0})
          </span>
        </h2>
        <LiveQueue eventId={id} initialRequests={requests ?? []} />
      </section>
    </main>
  );
}
