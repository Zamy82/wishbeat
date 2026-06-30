"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface RatingItem {
  event_id: string;
  rating: number;
  comment: string | null;
  nickname: string | null;
  created_at: string;
  event_name: string;
}

interface Props {
  ownerId: string;
  currentEventId: string;
  djDisplayName: string;
}

// Öffentliche Bewertungs-Schau für Gäste:
// Zeigt was vorherige Gäste über den DJ bei anderen Events gesagt haben.
// Nur Bewertungen MIT Kommentar oder mit ≥4 Sternen werden gezeigt.
export default function PublicDjReviews({
  ownerId,
  currentEventId,
  djDisplayName
}: Props) {
  const [reviews, setReviews] = useState<RatingItem[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      // Alle Events des DJs holen (auch das aktuelle — Gaeste sollen die
      // komplette Bewertungs-Historie sehen, inkl. der neuesten von heute)
      const { data: evs } = await supabase
        .from("events")
        .select("id, name")
        .eq("owner_id", ownerId);
      if (!evs || evs.length === 0) {
        if (!cancelled) setReviews([]);
        return;
      }
      const evMap = new Map(evs.map((e: { id: string; name: string }) => [e.id, e.name]));
      const evIds = evs.map((e: { id: string }) => e.id);

      const { data: rs } = await supabase
        .from("event_ratings")
        .select("event_id, rating, comment, nickname, created_at")
        .in("event_id", evIds)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      const items: RatingItem[] = (rs ?? []).map(
        (r: {
          event_id: string;
          rating: number;
          comment: string | null;
          nickname: string | null;
          created_at: string;
        }) => ({
          ...r,
          event_name: evMap.get(r.event_id) ?? "—"
        })
      );
      setReviews(items);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [ownerId, currentEventId]);

  if (reviews === null) {
    return (
      <section className="w-full max-w-md mt-6 mb-4">
        <div className="h-24 rounded-3xl bg-white/5 border border-white/10 animate-pulse" />
      </section>
    );
  }

  if (reviews.length === 0) {
    return null; // Keine Bewertungen aus anderen Events — nicht zeigen
  }

  const avg =
    Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) /
    10;
  const showable = reviews.filter(
    (r) => (r.comment && r.comment.trim().length > 0) || r.rating >= 4
  );
  const visible = expanded ? showable : showable.slice(0, 3);

  return (
    <section className="w-full max-w-md mt-6 mb-4">
      <div className="rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/5 to-amber-500/5 p-5">
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-2xl">⭐</span>
            <h3 className="text-xl font-bold text-white">
              Bewertungen für {djDisplayName}
            </h3>
          </div>
          <p className="text-yellow-300 text-sm font-semibold">
            {avg} / 5 · {reviews.length}{" "}
            {reviews.length === 1 ? "Bewertung" : "Bewertungen"} insgesamt
          </p>
        </div>

        {visible.length === 0 ? (
          <p className="text-white/50 text-sm text-center">
            Bewertungen ohne Kommentar — Durchschnitt {avg}/5
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visible.map((r, i) => (
              <li
                key={`${r.event_id}-${r.created_at}-${i}`}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-yellow-300 text-sm font-bold">
                    {"★".repeat(r.rating)}
                    <span className="text-white/15">
                      {"★".repeat(5 - r.rating)}
                    </span>
                  </span>
                  <span className="text-white/40 text-[10px]">
                    {r.nickname?.trim() || "Anonym"} · {r.event_name}
                  </span>
                </div>
                {r.comment && r.comment.trim() && (
                  <p className="text-white/80 text-sm leading-relaxed">
                    „{r.comment}"
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {showable.length > 3 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-4 w-full py-2 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm transition border border-white/10"
          >
            {expanded
              ? "Weniger anzeigen"
              : `Alle ${showable.length} Bewertungen anzeigen`}
          </button>
        )}
      </div>
    </section>
  );
}
