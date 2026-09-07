"use client";

import { useEffect, useState } from "react";

interface RatingItem {
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
    // Serverseitige Schnittstelle: liest die komplette Bewertungs-Historie des
    // DJs ueber den sicheren Server-Zugang — auch aus beendeten Events.
    async function load() {
      try {
        const res = await fetch(`/api/dj/${ownerId}/reviews`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        setReviews((data.reviews ?? []) as RatingItem[]);
      } catch {
        if (!cancelled) setReviews([]);
      }
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
  // Alle Bewertungen zeigen (kein Filter mehr) — Gaeste sollen die komplette
  // Historie sehen.
  const showable = reviews;
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
                key={`${r.created_at}-${i}`}
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
