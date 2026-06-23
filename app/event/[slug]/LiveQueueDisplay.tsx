"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { getGuestSessionId } from "@/lib/guest-session";
import LiveReactions from "./LiveReactions";

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover_url: string | null;
  duration_ms: number;
}

type QueueResp =
  | { playing: true; current: Track; next: Track[] }
  | { playing: false; reason: string };

interface OwnRequest {
  spotify_track_id: string;
  title: string;
  artist: string;
  cover_url: string | null;
}

interface Props {
  eventId: string;
}

type Toast = { kind: "ok" | "info"; text: string; cover?: string | null } | null;

interface BoostRow {
  spotify_track_id: string;
  session_id: string;
}

export default function LiveQueueDisplay({ eventId }: Props) {
  const [data, setData] = useState<QueueResp | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [ownRequests, setOwnRequests] = useState<OwnRequest[]>([]);
  const [boosts, setBoosts] = useState<BoostRow[]>([]);
  const [busyBoost, setBusyBoost] = useState<string | null>(null);
  const lastNotifiedRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string>("");

  // Session-ID ermitteln (nur client-side)
  useEffect(() => {
    sessionIdRef.current = getGuestSessionId();
  }, []);

  // Boosts auf Live-Queue-Songs laden + Realtime
  useEffect(() => {
    const supabase = createClient();
    async function loadBoosts() {
      const { data: rows } = await supabase
        .from("live_queue_boosts")
        .select("spotify_track_id, session_id")
        .eq("event_id", eventId);
      if (rows) setBoosts(rows as BoostRow[]);
    }
    loadBoosts();
    const channel = supabase
      .channel(`live-boosts-${eventId}`)
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
  }, [eventId]);

  async function toggleBoost(trackId: string) {
    const sid = sessionIdRef.current;
    if (!sid || busyBoost) return;
    setBusyBoost(trackId);

    // Optimistic
    const had = boosts.some(
      (b) => b.spotify_track_id === trackId && b.session_id === sid
    );
    if (had) {
      setBoosts((prev) =>
        prev.filter(
          (b) => !(b.spotify_track_id === trackId && b.session_id === sid)
        )
      );
    } else {
      setBoosts((prev) => [
        ...prev,
        { spotify_track_id: trackId, session_id: sid }
      ]);
    }

    try {
      const res = await fetch("/api/queue-boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          track_id: trackId,
          session_id: sid
        })
      });
      if (!res.ok) {
        // Rollback
        if (had) {
          setBoosts((prev) => [
            ...prev,
            { spotify_track_id: trackId, session_id: sid }
          ]);
        } else {
          setBoosts((prev) =>
            prev.filter(
              (b) => !(b.spotify_track_id === trackId && b.session_id === sid)
            )
          );
        }
      }
    } catch {
      // Realtime-Refetch wird auch korrigieren
    } finally {
      setBusyBoost(null);
    }
  }

  // Eigene Wünsche initial laden + per Realtime aktualisieren
  useEffect(() => {
    if (!sessionIdRef.current) return;
    const supabase = createClient();
    const sid = sessionIdRef.current;

    // Initial laden
    supabase
      .from("song_requests")
      .select("spotify_track_id, title, artist, cover_url")
      .eq("event_id", eventId)
      .eq("requester_session_id", sid)
      .then(({ data: rows }) => {
        if (rows) {
          setOwnRequests(rows as OwnRequest[]);
        }
      });

    // Live-Updates
    const channel = supabase
      .channel(`own-requests-${sid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "song_requests",
          filter: `requester_session_id=eq.${sid}`
        },
        (payload) => {
          const r = payload.new as OwnRequest & { event_id: string };
          if (r.event_id === eventId) {
            setOwnRequests((prev) => {
              if (prev.some((x) => x.spotify_track_id === r.spotify_track_id)) return prev;
              return [...prev, {
                spotify_track_id: r.spotify_track_id,
                title: r.title,
                artist: r.artist,
                cover_url: r.cover_url
              }];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // Toast nach 6s ausblenden
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/spotify/event-queue?event_id=${eventId}`,
        { cache: "no-store" }
      );
      const d: QueueResp = await res.json();
      setData(d);

      // Match-Check: läuft gerade einer meiner Wünsche?
      if (d.playing) {
        const ownMatch = ownRequests.find(
          (r) => r.spotify_track_id === d.current.id
        );
        if (ownMatch && lastNotifiedRef.current !== d.current.id) {
          lastNotifiedRef.current = d.current.id;
          fireNotification(ownMatch);
        }
      }
    } catch {}
  }, [eventId, ownRequests]);

  function fireNotification(req: OwnRequest) {
    // In-App-Toast
    setToast({
      kind: "ok",
      text: `🎵 Dein Wunsch läuft jetzt: ${req.title}!`,
      cover: req.cover_url
    });

    // Browser-Notification (wenn erlaubt)
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification("🎵 Dein Wunschsong läuft!", {
          body: `${req.title} — ${req.artist}`,
          icon: req.cover_url ?? undefined,
          tag: req.spotify_track_id,
          badge: req.cover_url ?? undefined
        });
      } catch {}
    }

    // Vibration auf Mobile (3× kurze Pulse)
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([180, 80, 180, 80, 320]);
      } catch {}
    }
  }

  useEffect(() => {
    fetchQueue();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchQueue();
    }, 8000);
    return () => clearInterval(id);
  }, [fetchQueue]);

  return (
    <>
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-2xl border bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40 backdrop-blur-xl flex items-center gap-3 max-w-[90vw]">
          {toast.cover && (
            <Image
              src={toast.cover}
              alt=""
              width={40}
              height={40}
              className="rounded-lg flex-shrink-0"
            />
          )}
          <span className="text-sm font-bold">{toast.text}</span>
        </div>
      )}

      {!data ? (
        <div className="w-full max-w-md mb-6">
          <div className="h-20 rounded-3xl bg-white/5 border border-white/10 animate-pulse" />
        </div>
      ) : !data.playing ? (
        <div className="w-full max-w-md mb-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-center">
            <div className="text-2xl mb-1">⏸️</div>
            <p className="text-white/60 text-sm font-medium">
              DJ ist gerade in der Pause
            </p>
            <p className="text-white/40 text-xs mt-1">
              Sobald wieder Musik läuft, siehst du sie hier
            </p>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md mb-6">
          {/* Jetzt läuft */}
          <div className="rounded-3xl border border-neon-purple/40 bg-gradient-to-br from-neon-purple/15 to-neon-pink/5 p-4 mb-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-pink opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-pink" />
              </span>
              <span className="text-xs uppercase tracking-widest text-neon-pink font-semibold">
                Jetzt läuft
              </span>
            </div>
            <div className="flex items-center gap-3">
              {data.current.cover_url && (
                <Image
                  src={data.current.cover_url}
                  alt={data.current.album}
                  width={56}
                  height={56}
                  className="rounded-lg flex-shrink-0 shadow-lg"
                />
              )}
              <div className="min-w-0">
                <p className="text-white font-bold truncate">
                  {data.current.title}
                </p>
                <p className="text-white/70 text-sm truncate">
                  {data.current.artist}
                </p>
              </div>
            </div>

            {/* Live-Reactions / Crowd-Pulse */}
            <LiveReactions eventId={eventId} trackId={data.current.id} />
          </div>

          {/* Als nächstes (max 8) */}
          {data.next.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">
                  Als nächstes
                </p>
                <p className="text-[10px] text-white/30">tippe ❤️ um zu pushen</p>
              </div>
              <ol className="flex flex-col gap-2">
                {data.next.map((t, i) => {
                  const isOwn = ownRequests.some(
                    (r) => r.spotify_track_id === t.id
                  );
                  const trackBoosts = boosts.filter(
                    (b) => b.spotify_track_id === t.id
                  );
                  const boostCount = trackBoosts.length;
                  const myBoost = trackBoosts.some(
                    (b) => b.session_id === sessionIdRef.current
                  );
                  return (
                    <li key={`${t.id}-${i}`} className="flex items-center gap-3">
                      <span className="text-white/30 text-xs font-mono w-4">
                        {i + 1}
                      </span>
                      {t.cover_url && (
                        <Image
                          src={t.cover_url}
                          alt={t.album}
                          width={32}
                          height={32}
                          className="rounded-md flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-white/90 text-sm font-medium truncate">
                          {t.title}
                        </p>
                        <p className="text-white/40 text-xs truncate">
                          {t.artist}
                        </p>
                      </div>
                      {isOwn && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-neon-cyan/20 text-neon-cyan font-semibold flex-shrink-0">
                          DEIN WUNSCH
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleBoost(t.id)}
                        disabled={busyBoost === t.id}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold border transition flex-shrink-0 ${
                          myBoost
                            ? "bg-neon-pink/20 text-neon-pink border-neon-pink/50"
                            : "bg-white/5 text-white/60 border-white/15 hover:bg-white/10 hover:border-white/30"
                        } ${busyBoost === t.id ? "opacity-50" : ""}`}
                        title={myBoost ? "Push zurücknehmen" : "Diesen Song pushen"}
                      >
                        <span className="text-sm leading-none">
                          {myBoost ? "❤️" : "🤍"}
                        </span>
                        {boostCount > 0 && (
                          <span className="font-mono text-[10px]">
                            {boostCount}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}
    </>
  );
}
