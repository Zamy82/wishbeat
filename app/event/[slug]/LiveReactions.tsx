"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getGuestSessionId } from "@/lib/guest-session";

type Reaction = "fire" | "dance" | "meh";

interface Counts {
  fire: number;
  dance: number;
  meh: number;
}

interface Props {
  eventId: string;
  trackId: string;
}

const BUTTONS: {
  key: Reaction;
  emoji: string;
  label: string;
  hint: string;
  activeClasses: string;
}[] = [
  {
    key: "fire",
    emoji: "🔥",
    label: "Feuer!",
    hint: "Geiler Song!",
    activeClasses: "bg-orange-500/30 border-orange-400 text-orange-200 shadow-lg shadow-orange-500/30"
  },
  {
    key: "dance",
    emoji: "💃",
    label: "Tanze!",
    hint: "Ich tanze gerade",
    activeClasses: "bg-neon-pink/30 border-neon-pink text-neon-pink shadow-lg shadow-neon-pink/30"
  },
  {
    key: "meh",
    emoji: "😴",
    label: "Wechsel",
    hint: "Bitte was anderes",
    activeClasses: "bg-white/15 border-white/40 text-white/80 shadow-lg shadow-white/10"
  }
];

export default function LiveReactions({ eventId, trackId }: Props) {
  const [mine, setMine] = useState<Reaction | null>(null);
  const [counts, setCounts] = useState<Counts>({ fire: 0, dance: 0, meh: 0 });
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    setSessionId(getGuestSessionId());
  }, []);

  // Counts + eigene Reaction laden
  const reload = useCallback(async () => {
    if (!sessionId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("song_reactions")
      .select("session_id, reaction")
      .eq("event_id", eventId)
      .eq("spotify_track_id", trackId);

    const c: Counts = { fire: 0, dance: 0, meh: 0 };
    let own: Reaction | null = null;
    (data ?? []).forEach((r: { session_id: string; reaction: Reaction }) => {
      if (r.reaction in c) c[r.reaction]++;
      if (r.session_id === sessionId) own = r.reaction;
    });
    setCounts(c);
    setMine(own);
  }, [eventId, trackId, sessionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Realtime: jede Reaction auf diesen Track sofort sehen
  useEffect(() => {
    if (!sessionId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`reactions-${eventId}-${trackId}`)
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
  }, [eventId, trackId, sessionId, reload]);

  async function react(r: Reaction) {
    if (!sessionId || busy) return;
    setBusy(true);
    // Optimistic: lokal direkt anpassen
    const prevMine = mine;
    const prevCounts = { ...counts };

    if (mine === r) {
      // Toggle off
      setMine(null);
      setCounts((c) => ({ ...c, [r]: Math.max(0, c[r] - 1) }));
    } else if (mine === null) {
      setMine(r);
      setCounts((c) => ({ ...c, [r]: c[r] + 1 }));
    } else {
      // wechseln
      setCounts((c) => ({
        ...c,
        [mine]: Math.max(0, c[mine] - 1),
        [r]: c[r] + 1
      }));
      setMine(r);
    }

    try {
      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          track_id: trackId,
          session_id: sessionId,
          reaction: r
        })
      });
      if (!res.ok) {
        // Rollback bei Fehler
        setMine(prevMine);
        setCounts(prevCounts);
      } else {
        // Server-Truth nachladen
        reload();
      }
    } catch {
      setMine(prevMine);
      setCounts(prevCounts);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {BUTTONS.map((b) => {
        const active = mine === b.key;
        const count = counts[b.key];
        return (
          <button
            key={b.key}
            type="button"
            onClick={() => react(b.key)}
            disabled={busy || !sessionId}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 px-2 rounded-2xl border transition active:scale-95 disabled:opacity-50 ${
              active
                ? b.activeClasses
                : "bg-white/5 border-white/15 text-white/60 hover:bg-white/10 hover:border-white/30"
            }`}
            aria-pressed={active}
          >
            <span className="text-2xl leading-none">{b.emoji}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider mt-1">
              {b.label}
            </span>
            <span
              className={`text-[9px] mt-0.5 leading-tight px-1 ${
                active ? "opacity-90" : "text-white/45"
              }`}
            >
              {b.hint}
            </span>
            {count > 0 && (
              <span
                className={`text-[11px] font-mono mt-0.5 ${
                  active ? "" : "text-white/50"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
