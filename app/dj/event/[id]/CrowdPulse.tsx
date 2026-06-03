"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Reaction = "fire" | "dance" | "meh";

interface Counts {
  fire: number;
  dance: number;
  meh: number;
}

interface NowPlaying {
  id: string;
  title: string;
  artist: string;
}

interface Props {
  eventId: string;
}

// Crowd-Pulse-Score: gewichtet (dance ist starker als fire — wer tanzt
// ist mehr Beweis als wer nur den Daumen hebt) und straft 'meh'.
//   score = (fire + 1.5*dance) / (fire + dance + 0.5*meh) * 100
function calcScore(c: Counts): number | null {
  const total = c.fire + c.dance + c.meh;
  if (total < 1) return null;
  const num = c.fire + 1.5 * c.dance;
  const den = c.fire + c.dance + 0.5 * c.meh;
  if (den <= 0) return null;
  return Math.min(100, Math.round((num / den) * 100));
}

function scoreLabel(score: number | null): { text: string; tone: string } {
  if (score === null) return { text: "Noch keine Reaktion", tone: "text-white/40" };
  if (score >= 90) return { text: "🔥 FEUER PUR!", tone: "text-orange-300" };
  if (score >= 75) return { text: "✨ Crowd ist heiss", tone: "text-neon-pink" };
  if (score >= 50) return { text: "💫 Stimmung gut", tone: "text-yellow-300" };
  if (score >= 30) return { text: "💤 Lauwarm", tone: "text-white/60" };
  return { text: "❄️ Crowd will Wechsel!", tone: "text-cyan-300" };
}

export default function CrowdPulse({ eventId }: Props) {
  const [now, setNow] = useState<NowPlaying | null>(null);
  const [counts, setCounts] = useState<Counts>({ fire: 0, dance: 0, meh: 0 });

  // Now-Playing alle 8 Sek pollen (gleicher Rhythmus wie Gast-Live-Queue)
  useEffect(() => {
    let cancelled = false;
    async function fetchNow() {
      try {
        const res = await fetch(
          `/api/spotify/event-queue?event_id=${eventId}`,
          { cache: "no-store" }
        );
        const d = await res.json();
        if (cancelled) return;
        if (d.playing) {
          setNow({ id: d.current.id, title: d.current.title, artist: d.current.artist });
        } else {
          setNow(null);
        }
      } catch {
        // ignore
      }
    }
    fetchNow();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchNow();
    }, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [eventId]);

  // Reactions fuer aktuellen Track laden + Realtime
  const reload = useCallback(async () => {
    if (!now) {
      setCounts({ fire: 0, dance: 0, meh: 0 });
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("song_reactions")
      .select("reaction")
      .eq("event_id", eventId)
      .eq("spotify_track_id", now.id);
    const c: Counts = { fire: 0, dance: 0, meh: 0 };
    (data ?? []).forEach((r: { reaction: Reaction }) => {
      if (r.reaction in c) c[r.reaction]++;
    });
    setCounts(c);
  }, [eventId, now]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!now) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`crowd-pulse-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "song_reactions",
          filter: `event_id=eq.${eventId}`
        },
        () => reload()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, now, reload]);

  if (!now) {
    return (
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-white/60 text-xs uppercase tracking-widest font-semibold mb-2">
          🎚 Crowd-Pulse
        </h3>
        <p className="text-white/40 text-sm">
          Sobald ein Song läuft, siehst du hier die Live-Stimmung der Gäste.
        </p>
      </section>
    );
  }

  const score = calcScore(counts);
  const { text, tone } = scoreLabel(score);
  const total = counts.fire + counts.dance + counts.meh;

  return (
    <section className="mt-6 rounded-3xl border border-neon-pink/30 bg-gradient-to-br from-neon-pink/10 via-neon-purple/5 to-transparent p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-white/60 text-xs uppercase tracking-widest font-semibold mb-1">
            🎚 Crowd-Pulse
          </h3>
          <p className="text-white text-sm font-medium truncate">{now.title}</p>
          <p className="text-white/40 text-xs truncate">{now.artist}</p>
        </div>
        <div className="text-right flex-shrink-0">
          {score !== null && (
            <div className="text-3xl font-black text-white leading-none">
              {score}%
            </div>
          )}
          <p className={`text-xs font-bold mt-1 ${tone}`}>{text}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <CountBlock
          emoji="🔥"
          label="Feuer"
          count={counts.fire}
          total={total}
          color="bg-orange-500"
        />
        <CountBlock
          emoji="💃"
          label="Tanze"
          count={counts.dance}
          total={total}
          color="bg-neon-pink"
        />
        <CountBlock
          emoji="😴"
          label="Wechsel"
          count={counts.meh}
          total={total}
          color="bg-white/50"
        />
      </div>

      {total > 0 && (
        <p className="text-white/40 text-[11px] mt-3 text-center">
          {total} {total === 1 ? "Gast hat" : "Gäste haben"} reagiert
        </p>
      )}
    </section>
  );
}

function CountBlock({
  emoji,
  label,
  count,
  total,
  color
}: {
  emoji: string;
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 flex flex-col items-center">
      <div className="text-2xl leading-none mb-1">{emoji}</div>
      <div className="text-white text-2xl font-black leading-tight">{count}</div>
      <div className="text-white/40 text-[10px] uppercase tracking-wider mt-0.5">
        {label}
      </div>
      {/* Mini-Balken */}
      <div className="mt-2 w-full h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
