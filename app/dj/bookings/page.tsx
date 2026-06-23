import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BookingsList from "./BookingsList";

interface BookingRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  event_date: string | null;
  event_type: string | null;
  guest_count: number | null;
  location: string | null;
  message: string | null;
  status: "new" | "contacted" | "booked" | "declined";
  created_at: string;
  referrer_event_id: string | null;
}

export default async function BookingsPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/dj/login");

  const { data: bookings } = await supabase
    .from("booking_requests")
    .select(
      "id, name, email, phone, event_date, event_type, guest_count, location, message, status, created_at, referrer_event_id"
    )
    .eq("dj_user_id", user.id)
    .order("created_at", { ascending: false });

  // Event-Namen fuer "kam von"-Referenz mappen
  const referrerIds = Array.from(
    new Set(
      (bookings ?? [])
        .map((b) => b.referrer_event_id)
        .filter((id): id is string => !!id)
    )
  );
  let eventMap: Record<string, string> = {};
  if (referrerIds.length > 0) {
    const { data: evs } = await supabase
      .from("events")
      .select("id, name")
      .in("id", referrerIds);
    eventMap = Object.fromEntries(
      (evs ?? []).map((e: { id: string; name: string }) => [e.id, e.name])
    );
  }

  return (
    <main className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      <Link
        href="/dj"
        className="text-white/40 hover:text-white text-sm mb-6 inline-block transition"
      >
        ← Zurück zum Dashboard
      </Link>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">📅 Buchungs-Anfragen</h1>
        <p className="text-white/40 text-sm mt-1">
          Gäste, die dich für eigene Partys engagieren wollen.
        </p>
      </header>

      <BookingsList
        initialBookings={(bookings ?? []) as BookingRow[]}
        eventNameMap={eventMap}
      />
    </main>
  );
}
