import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import SongRequestForm from "./SongRequestForm";
import TipSection from "./TipSection";
import RatingSection from "./RatingSection";
import LiveQueueDisplay from "./LiveQueueDisplay";
import WishesVotingList from "./WishesVotingList";
import LastEventTracker from "./LastEventTracker";
import PublicDjReviews from "./PublicDjReviews";
import BookingRequestButton from "./BookingRequestButton";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, tagline, event_date, is_active, owner_id")
    .eq("slug", slug)
    .single();

  if (!event) notFound();

  // DJ-Profil laden (für Trinkgeld) — RLS-Policy erlaubt das für aktive Events
  const { data: djProfile } = await supabase
    .from("dj_profiles")
    .select("display_name, iban_holder, iban, bic, paypal_handle")
    .eq("user_id", event.owner_id)
    .maybeSingle();

  const hasBank = !!(
    djProfile?.iban &&
    djProfile?.iban_holder &&
    djProfile.iban.length > 0 &&
    djProfile.iban_holder.length > 0
  );
  const hasPaypal = !!(djProfile?.paypal_handle && djProfile.paypal_handle.length > 0);
  const canTip = hasBank || hasPaypal;

  const djDisplayName =
    djProfile?.display_name?.trim() ||
    djProfile?.iban_holder?.trim() ||
    "den DJ";

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-10">
      <LastEventTracker slug={slug} name={event.name} />
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
        {event.tagline && (
          <p className="text-white/60 italic mt-2 text-lg">{event.tagline}</p>
        )}
        {!event.is_active && (
          <p className="mt-4 text-white/50 text-sm">
            Dieses Event ist bereits beendet.
          </p>
        )}
      </header>

      {event.is_active ? (
        <>
          {/* Live-Queue mit Suche direkt darin — Reihenfolge:
              Jetzt läuft → Suche → Geplant. So kommt der Gast in
              max. 5-10 Sekunden zum Wunsch, statt hinter langer Queue. */}
          <LiveQueueDisplay eventId={event.id}>
            <SongRequestForm eventId={event.id} />
          </LiveQueueDisplay>
          <div className="mt-8 w-full max-w-md">
            <WishesVotingList eventId={event.id} />
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center max-w-sm">
          <p className="text-white/60">
            Wunschsongs werden nicht mehr angenommen. Danke fürs Mitmachen!
          </p>
        </div>
      )}

      {/* Bewertung — auch bei beendeten Events erlaubt (Feedback nachträglich) */}
      <RatingSection eventId={event.id} eventName={event.name} />

      {/* Oeffentliche Bewertungen aus anderen Events fuer denselben DJ */}
      <PublicDjReviews
        ownerId={event.owner_id}
        currentEventId={event.id}
        djDisplayName={djDisplayName}
      />

      {/* Buchungs-Anfrage — fuer begeisterte Gaeste die eigene Party planen */}
      <BookingRequestButton
        djUserId={event.owner_id}
        djDisplayName={djDisplayName}
        referrerEventId={event.id}
      />

      {/* Trinkgeld — wenn DJ IBAN oder PayPal eingetragen hat */}
      {canTip && djProfile && (
        <TipSection
          djDisplayName={djDisplayName}
          ibanHolder={djProfile.iban_holder ?? ""}
          iban={djProfile.iban ?? ""}
          bic={djProfile.bic}
          paypalHandle={djProfile.paypal_handle}
          eventName={event.name}
          hasBank={hasBank}
          hasPaypal={hasPaypal}
        />
      )}
    </main>
  );
}
