"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { SongRequest, RequestStatus } from "@/lib/types";

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Offen",
  approved: "Angenommen",
  played: "Gespielt",
  rejected: "Abgelehnt"
};

const STATUS_STYLE: Record<RequestStatus, string> = {
  pending: "bg-yellow-400/20 text-yellow-300",
  approved: "bg-neon-cyan/20 text-neon-cyan",
  played: "bg-white/10 text-white/30",
  rejected: "bg-red-500/20 text-red-400"
};

interface Props {
  eventId: string;
  initialRequests: SongRequest[];
}

type Toast = { kind: "ok" | "err"; text: string } | null;

export default function LiveQueue({ eventId, initialRequests }: Props) {
  const [requests, setRequests] = useState<SongRequest[]>(initialRequests);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  // Tracks die schon als "gespielt" automatisch markiert wurden — verhindert
  // doppelte Updates während ein langer Track läuft.
  const autoMarkedRef = useRef<Set<string>>(new Set());
  // Letzter gesehener Track für Play-Tracking — bei jedem Wechsel: INSERT in event_plays
  const lastSeenTrackRef = useRef<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Auto-Mark-As-Played: pollt Spotify Now-Playing und matched gegen
  // angenommene Wünsche. Wenn der Track läuft -> setze status="played".
  useEffect(() => {
    let cancelled = false;

    async function checkNowPlaying() {
      if (cancelled) return;
      try {
        const res = await fetch("/api/spotify/now-playing", { cache: "no-store" });
        const data = await res.json();
        if (!data?.playing || !data?.track?.id) return;

        const currentSpotifyId = data.track.id as string;

        // Play-Tracking: bei jedem Track-Wechsel → INSERT in event_plays.
        // Damit haben wir eine vollstaendige History aller gespielten Songs
        // (auch DJ-Playlist-Songs ohne Wunsch).
        if (lastSeenTrackRef.current !== currentSpotifyId) {
          lastSeenTrackRef.current = currentSpotifyId;
          const matchingRequest = requests.find(
            (r) =>
              (r.status === "approved" || r.status === "played") &&
              r.spotify_track_id === currentSpotifyId
          );
          const supabase = createClient();
          supabase
            .from("event_plays")
            .insert({
              event_id: eventId,
              spotify_track_id: currentSpotifyId,
              title: data.track.title,
              artist: data.track.artist,
              cover_url: data.track.cover_url,
              source: matchingRequest ? "wish" : "auto",
              request_id: matchingRequest?.id ?? null
            })
            .then(() => {});
        }

        // Schon mal auto-marked? Skip.
        if (autoMarkedRef.current.has(currentSpotifyId)) return;

        // Suche angenommenen Wunsch mit dieser Spotify-ID
        const match = requests.find(
          (r) =>
            r.status === "approved" &&
            r.spotify_track_id === currentSpotifyId
        );
        if (!match) return;

        // Markiere als "played"
        autoMarkedRef.current.add(currentSpotifyId);
        const supabase = createClient();
        await supabase
          .from("song_requests")
          .update({ status: "played" })
          .eq("id", match.id);
        setToast({
          kind: "ok",
          text: `Automatisch als gespielt markiert: ${match.title}`
        });

        // Push-Notification an den Gast schicken (im Hintergrund)
        fetch("/api/push/notify-played", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_id: match.id })
        }).catch(() => {});
      } catch {}
    }

    checkNowPlaying();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") checkNowPlaying();
    }, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [requests]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`event-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "song_requests",
          filter: `event_id=eq.${eventId}`
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setRequests((prev) => [...prev, payload.new as SongRequest]);
          } else if (payload.eventType === "UPDATE") {
            setRequests((prev) =>
              prev.map((r) =>
                r.id === payload.new.id ? (payload.new as SongRequest) : r
              )
            );
          } else if (payload.eventType === "DELETE") {
            setRequests((prev) =>
              prev.filter((r) => r.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  async function updateStatus(requestId: string, status: RequestStatus) {
    const supabase = createClient();
    await supabase.from("song_requests").update({ status }).eq("id", requestId);

    // Bei manuellem "Als gespielt markieren": Push an Gast
    if (status === "played") {
      fetch("/api/push/notify-played", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId })
      }).catch(() => {});
    }
  }

  async function approveAndQueue(req: SongRequest) {
    setBusy(req.id);
    try {
      // 1) Status in DB auf approved setzen
      await updateStatus(req.id, "approved");

      // 2) Song in Spotify-Queue schieben
      const res = await fetch("/api/spotify/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotify_track_id: req.spotify_track_id })
      });
      const data = await res.json();

      if (data.ok) {
        setToast({
          kind: "ok",
          text: `In Spotify-Queue: ${req.title} — ${req.artist}`
        });
      } else {
        setToast({ kind: "err", text: data.message ?? "Fehler beim Queue-Push" });
      }
    } finally {
      setBusy(null);
    }
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
        <p className="text-white/40 text-sm">
          Noch keine Wünsche. Gäste können jetzt über den QR-Code Songs wünschen.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-medium shadow-2xl border ${
            toast.kind === "ok"
              ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40 backdrop-blur"
              : "bg-red-500/20 text-red-300 border-red-500/40 backdrop-blur"
          }`}
        >
          {toast.text}
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {requests.map((req) => (
          <li
            key={req.id}
            className={`rounded-2xl border border-white/10 bg-white/5 p-4 transition ${
              req.status === "played" ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              {req.cover_url && (
                <Image
                  src={req.cover_url}
                  alt={req.title}
                  width={48}
                  height={48}
                  className="rounded-lg flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{req.title}</p>
                <p className="text-white/50 text-sm truncate">{req.artist}</p>
                {req.guest_nickname && (
                  <p className="text-white/30 text-xs mt-0.5">
                    von {req.guest_nickname}
                  </p>
                )}
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_STYLE[req.status]}`}
              >
                {STATUS_LABEL[req.status]}
              </span>
            </div>

            {/* Aktions-Buttons */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {req.status === "pending" && (
                <>
                  <ActionButton
                    label={busy === req.id ? "Schiebe in Queue…" : "✓ Annehmen & queuen"}
                    style="text-neon-cyan border-neon-cyan/40 hover:bg-neon-cyan/10"
                    onClick={() => approveAndQueue(req)}
                    disabled={busy === req.id}
                  />
                  <ActionButton
                    label="✕ Ablehnen"
                    style="text-red-400 border-red-500/40 hover:bg-red-500/10"
                    onClick={() => updateStatus(req.id, "rejected")}
                  />
                </>
              )}
              {req.status === "approved" && (
                <>
                  <ActionButton
                    label="🎵 Als gespielt markieren"
                    style="text-white/60 border-white/20 hover:bg-white/10"
                    onClick={() => updateStatus(req.id, "played")}
                  />
                  <ActionButton
                    label={busy === req.id ? "…" : "↻ Nochmal queuen"}
                    style="text-[#1DB954] border-[#1DB954]/40 hover:bg-[#1DB954]/10"
                    onClick={() => approveAndQueue(req)}
                    disabled={busy === req.id}
                  />
                </>
              )}
              {req.status === "played" && (
                <>
                  <ActionButton
                    label={busy === req.id ? "…" : "↻ Nochmal queuen"}
                    style="text-[#1DB954] border-[#1DB954]/40 hover:bg-[#1DB954]/10"
                    onClick={() => approveAndQueue(req)}
                    disabled={busy === req.id}
                  />
                  <ActionButton
                    label="↩ Zurücksetzen"
                    style="text-white/30 border-white/10 hover:bg-white/5"
                    onClick={() => updateStatus(req.id, "pending")}
                  />
                </>
              )}
              {req.status === "rejected" && (
                <ActionButton
                  label="↩ Zurücksetzen"
                  style="text-white/30 border-white/10 hover:bg-white/5"
                  onClick={() => updateStatus(req.id, "pending")}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function ActionButton({
  label,
  style,
  onClick,
  disabled
}: {
  label: string;
  style: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition disabled:opacity-50 disabled:cursor-wait ${style}`}
    >
      {label}
    </button>
  );
}
