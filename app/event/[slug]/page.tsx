import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import SongRequestForm from "./SongRequestForm";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, event_date, is_active")
    .eq("slug", slug)
    .single();

  if (!event) notFound();

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-10">
      <header className="text-center mb-8">
        <p className="text-sm uppercase tracking-widest text-neon-cyan mb-2">
          {new Date(event.event_date).toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "long",
            year: "numeric"
          })}
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white">
          {event.name}
        </h1>
        {!event.is_active && (
          <p className="mt-4 text-white/50 text-sm">
            Dieses Event ist bereits beendet.
          </p>
        )}
      </header>

      {event.is_active ? (
        <SongRequestForm eventId={event.id} />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center max-w-sm">
          <p className="text-white/60">
            Wunschsongs werden nicht mehr angenommen. Danke fürs Mitmachen!
          </p>
        </div>
      )}
    </main>
  );
}
