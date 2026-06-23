"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

interface Props {
  initialBookings: BookingRow[];
  eventNameMap: Record<string, string>;
}

type Filter = "all" | "new" | "contacted" | "booked" | "declined";

const STATUS_LABELS: Record<BookingRow["status"], { label: string; color: string }> = {
  new: { label: "Neu", color: "bg-neon-pink/20 text-neon-pink border-neon-pink/40" },
  contacted: {
    label: "Kontaktiert",
    color: "bg-yellow-400/20 text-yellow-300 border-yellow-400/40"
  },
  booked: {
    label: "Gebucht",
    color: "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40"
  },
  declined: {
    label: "Abgelehnt",
    color: "bg-white/10 text-white/50 border-white/20"
  }
};

export default function BookingsList({ initialBookings, eventNameMap }: Props) {
  const [bookings, setBookings] = useState(initialBookings);
  const [filter, setFilter] = useState<Filter>("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const counts = {
    all: bookings.length,
    new: bookings.filter((b) => b.status === "new").length,
    contacted: bookings.filter((b) => b.status === "contacted").length,
    booked: bookings.filter((b) => b.status === "booked").length,
    declined: bookings.filter((b) => b.status === "declined").length
  };

  const filtered =
    filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  async function updateStatus(id: string, status: BookingRow["status"]) {
    setUpdating(id);
    const prev = bookings;
    setBookings((bs) => bs.map((b) => (b.id === id ? { ...b, status } : b)));
    const supabase = createClient();
    const { error } = await supabase
      .from("booking_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      // Rollback
      setBookings(prev);
      alert("Konnte Status nicht aendern: " + error.message);
    }
    setUpdating(null);
  }

  async function remove(id: string) {
    if (!confirm("Diese Anfrage wirklich loeschen?")) return;
    setUpdating(id);
    const prev = bookings;
    setBookings((bs) => bs.filter((b) => b.id !== id));
    const supabase = createClient();
    const { error } = await supabase.from("booking_requests").delete().eq("id", id);
    if (error) {
      setBookings(prev);
      alert("Konnte nicht loeschen: " + error.message);
    }
    setUpdating(null);
  }

  if (bookings.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
        <p className="text-white/50">Noch keine Buchungs-Anfragen.</p>
        <p className="text-white/30 text-xs mt-2">
          Sobald Gäste auf einer Event-Seite den Buchungs-Button drücken, erscheinen sie hier.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filter-Pills */}
      <div className="flex flex-wrap gap-2">
        {(["all", "new", "contacted", "booked", "declined"] as Filter[]).map(
          (f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                filter === f
                  ? "bg-white/15 border-white/30 text-white"
                  : "bg-white/5 border-white/10 text-white/60 hover:text-white"
              }`}
            >
              {f === "all" ? "Alle" : STATUS_LABELS[f as BookingRow["status"]].label}
              <span className="ml-1.5 text-white/40">({counts[f]})</span>
            </button>
          )
        )}
      </div>

      {/* Liste */}
      <ul className="flex flex-col gap-3">
        {filtered.map((b) => {
          const { label, color } = STATUS_LABELS[b.status];
          const referrer = b.referrer_event_id
            ? eventNameMap[b.referrer_event_id]
            : null;
          return (
            <li
              key={b.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-white font-bold text-base">{b.name}</p>
                  <p className="text-white/50 text-xs">
                    {new Date(b.created_at).toLocaleString("de-DE", {
                      dateStyle: "short",
                      timeStyle: "short"
                    })}
                    {referrer && (
                      <span className="text-white/30"> · kam von {referrer}</span>
                    )}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider flex-shrink-0 ${color}`}
                >
                  {label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                <Info label="E-Mail">
                  <a
                    href={`mailto:${b.email}?subject=Buchungs-Anfrage&body=Hallo ${encodeURIComponent(b.name)},`}
                    className="text-neon-cyan hover:text-neon-pink underline underline-offset-2 break-all"
                  >
                    {b.email}
                  </a>
                </Info>
                {b.phone && (
                  <Info label="Telefon">
                    <a
                      href={`tel:${b.phone}`}
                      className="text-neon-cyan hover:text-neon-pink"
                    >
                      {b.phone}
                    </a>
                  </Info>
                )}
                {b.event_date && (
                  <Info label="Wunschtermin">
                    {new Date(b.event_date).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric"
                    })}
                  </Info>
                )}
                {b.event_type && <Info label="Anlass">{b.event_type}</Info>}
                {b.guest_count !== null && b.guest_count !== undefined && (
                  <Info label="Gäste">{b.guest_count}</Info>
                )}
                {b.location && <Info label="Ort">{b.location}</Info>}
              </div>

              {b.message && (
                <div className="mt-3 rounded-xl bg-white/5 border border-white/10 p-3">
                  <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold mb-1">
                    Nachricht
                  </p>
                  <p className="text-white/85 text-sm leading-relaxed whitespace-pre-wrap">
                    {b.message}
                  </p>
                </div>
              )}

              {/* Status-Aktionen */}
              <div className="flex flex-wrap gap-2 mt-4">
                <StatusButton
                  onClick={() => updateStatus(b.id, "contacted")}
                  active={b.status === "contacted"}
                  disabled={updating === b.id}
                  label="📩 Kontaktiert"
                />
                <StatusButton
                  onClick={() => updateStatus(b.id, "booked")}
                  active={b.status === "booked"}
                  disabled={updating === b.id}
                  label="✅ Gebucht"
                  variant="cyan"
                />
                <StatusButton
                  onClick={() => updateStatus(b.id, "declined")}
                  active={b.status === "declined"}
                  disabled={updating === b.id}
                  label="❌ Abgelehnt"
                  variant="muted"
                />
                <StatusButton
                  onClick={() => updateStatus(b.id, "new")}
                  active={b.status === "new"}
                  disabled={updating === b.id}
                  label="🔄 Neu"
                  variant="muted"
                />
                <button
                  type="button"
                  onClick={() => remove(b.id)}
                  disabled={updating === b.id}
                  className="ml-auto px-3 py-1.5 rounded-full text-xs text-red-300/70 hover:text-red-300 hover:bg-red-500/10 transition"
                >
                  Löschen
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">
        {label}
      </p>
      <p className="text-white/85 text-sm">{children}</p>
    </div>
  );
}

function StatusButton({
  onClick,
  active,
  disabled,
  label,
  variant = "default"
}: {
  onClick: () => void;
  active: boolean;
  disabled: boolean;
  label: string;
  variant?: "default" | "cyan" | "muted";
}) {
  const activeClasses =
    variant === "cyan"
      ? "bg-neon-cyan/25 border-neon-cyan/60 text-neon-cyan"
      : variant === "muted"
      ? "bg-white/15 border-white/30 text-white"
      : "bg-yellow-400/25 border-yellow-400/60 text-yellow-300";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || active}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition disabled:opacity-50 ${
        active
          ? activeClasses
          : "bg-white/5 border-white/10 text-white/60 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
