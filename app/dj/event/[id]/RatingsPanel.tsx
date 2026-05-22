"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EventRating } from "@/lib/types";

interface Props {
  eventId: string;
  initialRatings: EventRating[];
}

export default function RatingsPanel({ eventId, initialRatings }: Props) {
  const [ratings, setRatings] = useState<EventRating[]>(initialRatings);

  // Realtime: neue Bewertungen erscheinen sofort
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`ratings-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_ratings",
          filter: `event_id=eq.${eventId}`
        },
        (payload) => {
          setRatings((prev) => [payload.new as EventRating, ...prev]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  if (ratings.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-white/40 text-sm">
          Noch keine Bewertungen. Gäste können den Abend auf der Event-Seite
          bewerten (1-5 Sterne + Kommentar).
        </p>
      </div>
    );
  }

  const count = ratings.length;
  const average = ratings.reduce((sum, r) => sum + r.rating, 0) / count;

  // Verteilung berechnen
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ratings) distribution[r.rating]++;

  return (
    <div className="flex flex-col gap-6">
      {/* Zusammenfassung */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-6">
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-stretch">
          {/* Durchschnitt links */}
          <div className="flex flex-col items-center md:border-r md:border-white/10 md:pr-6 md:min-w-[140px]">
            <div className="text-5xl font-bold text-white">
              {average.toFixed(1)}
            </div>
            <div className="flex gap-0.5 mt-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={
                    average >= n - 0.25
                      ? "text-yellow-400 text-lg"
                      : average >= n - 0.75
                      ? "text-yellow-400/60 text-lg"
                      : "text-white/15 text-lg"
                  }
                >
                  {average >= n - 0.25 ? "★" : average >= n - 0.75 ? "⯨" : "☆"}
                </span>
              ))}
            </div>
            <div className="text-white/50 text-xs mt-1">
              {count} {count === 1 ? "Bewertung" : "Bewertungen"}
            </div>
          </div>

          {/* Verteilung rechts */}
          <div className="flex-1 flex flex-col gap-1.5 w-full">
            {[5, 4, 3, 2, 1].map((stars) => {
              const c = distribution[stars];
              const pct = count > 0 ? (c / count) * 100 : 0;
              return (
                <div key={stars} className="flex items-center gap-2 text-xs">
                  <span className="text-white/60 w-10 flex items-center gap-0.5">
                    {stars} <span className="text-yellow-400">★</span>
                  </span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400/80 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-white/50 w-8 text-right">{c}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Einzelne Bewertungen */}
      <ul className="flex flex-col gap-3">
        {ratings.map((r) => (
          <li
            key={r.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className={
                        r.rating >= n
                          ? "text-yellow-400 text-sm"
                          : "text-white/15 text-sm"
                      }
                    >
                      ★
                    </span>
                  ))}
                </div>
                <span className="text-white/70 font-medium text-sm">
                  {r.nickname?.trim() || "Anonym"}
                </span>
              </div>
              <span className="text-white/30 text-xs">
                {new Date(r.created_at).toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </span>
            </div>
            {r.comment && (
              <p className="text-white/70 text-sm leading-snug">{r.comment}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
