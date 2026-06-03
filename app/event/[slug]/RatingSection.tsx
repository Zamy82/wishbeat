"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  eventId: string;
  eventName: string;
}

const RATING_LABELS: Record<number, string> = {
  1: "Schlecht",
  2: "Geht so",
  3: "OK",
  4: "Sehr gut",
  5: "Hammer!"
};

export default function RatingSection({ eventId, eventName }: Props) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const localStorageKey = `wishbeat_rated_${eventId}`;

  // Prüfen ob dieser Browser schon bewertet hat
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(localStorageKey)) {
      setSubmitted(true);
    }
  }, [localStorageKey]);

  async function submit() {
    if (rating === 0) return;
    setSaving(true);

    const supabase = createClient();
    const { error } = await supabase.from("event_ratings").insert({
      event_id: eventId,
      rating,
      comment: comment.trim() || null,
      nickname: nickname.trim() || null
    });

    setSaving(false);

    if (error) {
      alert("Bewertung konnte nicht gespeichert werden. Versuch's nochmal.");
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(localStorageKey, "1");
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <section id="rating" className="w-full max-w-md mt-6 mb-4 scroll-mt-6">
        <div className="rounded-3xl border border-neon-cyan/30 bg-neon-cyan/10 p-6 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <p className="text-white font-semibold">Danke für deine Bewertung!</p>
          <p className="text-white/60 text-sm mt-1">
            {eventName} freut sich über dein Feedback.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="rating" className="w-full max-w-md mt-6 mb-4 scroll-mt-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-center mb-5">
          <h3 className="text-xl font-bold text-white">⭐ Wie war der Abend?</h3>
          <p className="text-white/50 text-sm mt-1">
            Hilf dem DJ mit deinem Feedback.
          </p>
        </div>

        {/* Sterne */}
        <div className="flex justify-center gap-1 mb-2">
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = (hoverRating || rating) >= n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHoverRating(n)}
                onMouseLeave={() => setHoverRating(0)}
                className="text-4xl transition transform hover:scale-110 active:scale-95"
                aria-label={`${n} Sterne`}
              >
                <span
                  className={
                    filled
                      ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
                      : "text-white/15"
                  }
                >
                  {filled ? "★" : "☆"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Label */}
        <p className="text-center text-white/70 font-medium h-6 mb-4">
          {(hoverRating || rating) > 0
            ? RATING_LABELS[hoverRating || rating]
            : "Tippe einen Stern"}
        </p>

        {/* Kommentar */}
        <div className="mb-3">
          <label className="text-white/60 text-xs uppercase tracking-widest block mb-2">
            Kommentar <span className="lowercase text-white/30">(optional)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Was hat dir gefallen? Was hat gefehlt?"
            className="w-full rounded-2xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-neon-purple transition text-sm resize-none"
          />
          <p className="text-white/30 text-xs mt-1 text-right">
            {comment.length}/500
          </p>
        </div>

        {/* Nickname */}
        <div className="mb-4">
          <label className="text-white/60 text-xs uppercase tracking-widest block mb-2">
            Dein Name <span className="lowercase text-white/30">(optional)</span>
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={40}
            placeholder="z.B. Anna — oder leer für anonym"
            className="w-full rounded-2xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-neon-purple transition text-sm"
          />
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={submit}
          disabled={rating === 0 || saving}
          className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-neon-pink to-neon-purple text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition"
        >
          {saving ? "Speichere…" : "Bewertung abschicken"}
        </button>
      </div>
    </section>
  );
}
