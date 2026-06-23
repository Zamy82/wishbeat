"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

interface NextTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover_url: string | null;
}

interface QueueResp {
  playing: boolean;
  current?: NextTrack;
  next?: NextTrack[];
}

interface Props {
  eventId: string;
}

// Live-Queue-Top-Boosts fuer DJ:
// Welche kommenden 8 Songs sind bei den Gaesten am meisten gepushed?
// DJ kann darauf reagieren (vorziehen via Spotify-Queue).
export default function TopBoosts({ eventId }: Props) {
  const [nextTracks, setNextTracks] = useState<NextTrack[]>([]);
  const [boostCounts, setBoostCounts] = useState<Record<string, number>>({});

  // Spotify-Queue pollen
  useEffect(() => {
    let cancelled = false;
    async function fetchQueue() {
      try {
        const res = await fetch(
          `/api/spotify/event-queue?event_id=${eventId}`,
          { cache: "no-store" }
        );
        const d = (await res.json()) as QueueResp;
        if (cancelled) return;
        setNextTracks(d.playing && d.next ? d.next : []);
      } catch {
        // ignore
      }
    }
    fetchQueue();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchQueue();
    }, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [eventId]);

  // Boost-Counts laden + Realtime
  const loadBoosts = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("live_queue_boosts")
      .select("spotify_track_id")
      .eq("event_id", eventId);
    const counts: Record<string, number> = {};
    (data ?? []).forEach((b: { spotify_track_id: string }) => {
      counts[b.spotify_track_id] = (counts[b.spotify_track_id] ?? 0) + 1;
    });
    setBoostCounts(counts);
  }, [eventId]);

  useEffect(() => {
    loadBoosts();
    const supabase = createClient();
    const channel = supabase
      .channel(`dj-boosts-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_queue_boosts",
          filter: `event_id=eq.${eventId}`
        },
        () => loadBoosts()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, loadBoosts]);

  if (nextTracks.length === 0) {
    return null;
  }

  // Tracks mit Boost-Counts kombinieren + nach Boosts sortieren (desc),
  // bei Gleichstand bleibt urspruengliche Reihenfolge
  const enriched = nextTracks.map((t, originalIndex) => ({
    ...t,
    boosts: boostCounts[t.id] ?? 0,
    originalIndex
  }));
  const sorted = [...enriched].sort((a, b) => {
    if (b.boosts !== a.boosts) return b.boosts - a.boosts;
    return a.originalIndex - b.originalIndex;
  });

  const totalBoosts = enriched.reduce((sum, t) => sum + t.boosts, 0);

  return (
    <section className="mt-6 rounded-3xl border border-neon-cyan/30 bg-gradient-to-br from-neon-cyan/10 via-transparent to-transparent p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white/60 text-xs uppercase tracking-widest font-semibold">
          🎯 Kommende Songs — Crowd-Push
        </h3>
        {totalBoosts > 0 && (
          <span className="text-neon-pink text-xs font-bold">
            ❤️ {totalBoosts} {totalBoosts === 1 ? "Push" : "Pushes"}
          </span>
        )}
      </div>

      {totalBoosts === 0 ? (
        <p className="text-white/40 text-sm">
          Noch keine Gäste haben kommende Songs gepushed. Sobald welche kommen,
          siehst du hier welche Tracks die Crowd am meisten will.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {sorted.map((t) => {
            const isHot = t.boosts >= 3;
            return (
              <li
                key={t.id}
                className={`flex items-center gap-3 rounded-2xl border p-2.5 transition ${
                  isHot
                    ? "border-neon-pink/40 bg-neon-pink/5"
                    : t.boosts > 0
                    ? "border-white/15 bg-white/[0.03]"
                    : "border-white/5 bg-white/[0.02] opacity-60"
                }`}
              >
                <span className="text-white/30 text-xs font-mono w-5 text-center">
                  {t.originalIndex + 1}
                </span>
                {t.cover_url && (
                  <Image
                    src={t.cover_url}
                    alt={t.album}
                    width={36}
                    height={36}
                    className="rounded-md flex-shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-semibold truncate">
                    {t.title}
                    {isHot && <span className="ml-1.5">🔥</span>}
                  </p>
                  <p className="text-white/40 text-xs truncate">{t.artist}</p>
                </div>
                <div
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border flex-shrink-0 ${
                    isHot
                      ? "bg-neon-pink/20 text-neon-pink border-neon-pink/50"
                      : t.boosts > 0
                      ? "bg-white/10 text-white/80 border-white/20"
                      : "bg-white/5 text-white/30 border-white/10"
                  }`}
                >
                  <span className="text-sm leading-none">❤️</span>
                  <span className="font-mono">{t.boosts}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {totalBoosts > 0 && (
        <p className="text-white/30 text-[11px] mt-3 text-center">
          Songs mit 3+ Pushes sind 🔥 — Tipp: in Spotify nach vorne ziehen
        </p>
      )}
    </section>
  );
}
