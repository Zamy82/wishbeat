"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { SongRequest, RequestStatus } from "@/lib/types";
import { matchTone } from "@/lib/vibe-match";

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
  // Gespielte + abgelehnte Wünsche standardmäßig eingeklappt — sind nach
  // langem Abend schnell viele, einfach zum Toggeln
  const [showPlayed, setShowPlayed] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  // Tracks die schon als "gespielt" automatisch markiert wurden — verhindert
  // doppelte Updates während ein langer Track läuft.
  const autoMarkedRef = useRef<Set<string>>(new Set());
  // Letzter gesehener Track für Play-Tracking — bei jedem Wechsel: INSERT in event_plays
  const lastSeenTrackRef = useRef<string | null>(null);

  // Vibe-State: aggregierte Genre-Woerter der letzten Plays
  const [vibeTokens, setVibeTokens] = useState<Record<string, number>>({});
  const [vibePlayCount, setVibePlayCount] = useState(0);
  // raw = wie viele Plays insgesamt im event_plays-Fenster, auch ohne Genre-Tags
  const [vibeRawPlayCount, setVibeRawPlayCount] = useState(0);
  // Vote-Counts pro Wunsch
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  // Match-% pro Track-ID — vom Server berechnet (funktioniert auch ohne
  // DB-Migration, da der Server Genres direkt von Spotify holt)
  const [matches, setMatches] = useState<Record<string, number>>({});
  // Debug-Info: was meldet Spotify zuletzt?
  const [nowPlayingDebug, setNowPlayingDebug] = useState<{
    title: string | null;
    reason: string | null;
    playing: boolean;
    at: number;
  } | null>(null);

  // Laptop-Benachrichtigungen: Banner + Pling + optional Desktop-Meldung bei
  // neuen Wuenschen. notifyOn steuert Pling/Desktop; das Banner kommt immer.
  const [notifyOn, setNotifyOn] = useState(false);
  const notifyOnRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Schon gemeldete Wunsch-IDs — verhindert Doppel-Pling bei Event-Replays.
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    notifyOnRef.current = notifyOn;
  }, [notifyOn]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Vibe + Matches periodisch laden (alle 20s).
  // Active Wuensche werden als track_ids mitgegeben — Server berechnet
  // Match-% pro Wunsch direkt, ohne DB-Spalte zu brauchen.
  const activeTrackIds = requests
    .filter((r) => r.status === "pending" || r.status === "approved")
    .map((r) => r.spotify_track_id)
    .join(",");

  useEffect(() => {
    let cancelled = false;
    async function loadVibe() {
      try {
        const url = activeTrackIds
          ? `/api/events/${eventId}/vibe?track_ids=${activeTrackIds}`
          : `/api/events/${eventId}/vibe`;
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        setVibeTokens(data.vibeTokens ?? {});
        setVibePlayCount(data.playCount ?? 0);
        setVibeRawPlayCount(data.rawPlayCount ?? 0);
        const mMap: Record<string, number> = {};
        const rawMatches = data.matches ?? {};
        for (const tid of Object.keys(rawMatches)) {
          mMap[tid] = rawMatches[tid].percent;
        }
        setMatches(mMap);
      } catch {}
    }
    loadVibe();
    const id = setInterval(loadVibe, 20000);
    return () => { cancelled = true; clearInterval(id); };
  }, [eventId, activeTrackIds]);

  // Auto-Mark-As-Played: pollt Spotify Now-Playing und matched gegen
  // angenommene Wünsche. Wenn der Track läuft -> setze status="played".
  useEffect(() => {
    let cancelled = false;

    async function checkNowPlaying() {
      if (cancelled) return;
      try {
        const res = await fetch("/api/spotify/now-playing", { cache: "no-store" });
        const data = await res.json();

        // Debug-Info immer aktualisieren — auch bei Fehlern
        setNowPlayingDebug({
          title: data?.track?.title ?? null,
          reason: data?.reason ?? null,
          playing: !!data?.playing,
          at: Date.now()
        });

        // Track-ID reicht — auch pausiert mitschreiben (Song war/ist geladen)
        if (!data?.track?.id) return;

        const currentSpotifyId = data.track.id as string;

        // Play-Tracking: bei jedem Track-Wechsel → server-seitiger Insert.
        // Server uebernimmt Ownership-Check + Genres + Fehler-Reporting.
        if (lastSeenTrackRef.current !== currentSpotifyId) {
          lastSeenTrackRef.current = currentSpotifyId;
          const matchingRequest = requests.find(
            (r) =>
              (r.status === "approved" || r.status === "played") &&
              r.spotify_track_id === currentSpotifyId
          );

          try {
            const trackRes = await fetch(`/api/events/${eventId}/track-play`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                spotify_track_id: currentSpotifyId,
                title: data.track.title,
                artist: data.track.artist,
                cover_url: data.track.cover_url,
                source: matchingRequest ? "wish" : "auto",
                request_id: matchingRequest?.id ?? null
              })
            });
            const trackData = await trackRes.json();
            if (!trackData.ok) {
              setToast({
                kind: "err",
                text: `Auto-Track-Fehler: ${trackData.message ?? "unbekannt"}`
              });
            }
          } catch (e) {
            setToast({
              kind: "err",
              text: `Auto-Track-Netzwerkfehler: ${(e as Error).message ?? "unbekannt"}`
            });
          }
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
            const incoming = payload.new as SongRequest;
            setRequests((prev) =>
              prev.some((r) => r.id === incoming.id) ? prev : [...prev, incoming]
            );
            notifyNewWish(incoming);
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

  // Vote-Counts: lade aggregierte Vote-Zaehlung pro Wunsch + Realtime-Updates
  useEffect(() => {
    const supabase = createClient();

    async function loadVoteCounts() {
      // Alle Wunsch-IDs in diesem Event
      const requestIds = requests.map((r) => r.id);
      if (requestIds.length === 0) {
        setVoteCounts({});
        return;
      }
      const { data } = await supabase
        .from("song_request_votes")
        .select("request_id")
        .in("request_id", requestIds);
      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as { request_id: string }[]) {
        counts[row.request_id] = (counts[row.request_id] ?? 0) + 1;
      }
      setVoteCounts(counts);
    }

    loadVoteCounts();
    const channel = supabase
      .channel(`votes-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "song_request_votes" },
        () => loadVoteCounts()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, requests]);

  // Kurzes zweistufiges "Pling" per Web Audio — kein Sound-File noetig.
  function playPling() {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") void ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1318.5, now + 0.09);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.42);
    } catch {}
  }

  function notifyNewWish(req: SongRequest) {
    if (notifiedRef.current.has(req.id)) return;
    notifiedRef.current.add(req.id);
    // Banner immer zeigen — kostet keine Browser-Berechtigung.
    setToast({
      kind: "ok",
      text: `🎵 Neuer Wunsch: ${req.title} — ${req.artist}${
        req.guest_nickname ? ` (von ${req.guest_nickname})` : ""
      }`
    });
    // Pling + Desktop-Meldung nur wenn per Knopf aktiviert.
    if (!notifyOnRef.current) return;
    playPling();
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("🎵 Neuer Wunsch", {
          body: `${req.title} — ${req.artist}${
            req.guest_nickname ? `\nvon ${req.guest_nickname}` : ""
          }`,
          icon: req.cover_url ?? undefined,
          tag: req.id
        });
      } catch {}
    }
  }

  async function toggleNotifications() {
    if (notifyOn) {
      setNotifyOn(false);
      setToast({ kind: "ok", text: "🔕 Töne & Laptop-Meldungen aus." });
      return;
    }
    try {
      // AudioContext muss durch einen Klick "entsperrt" werden (Autoplay-Schutz).
      if (!audioCtxRef.current) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        audioCtxRef.current = new Ctor();
      }
      if (audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume();
      }
      let perm: NotificationPermission = "default";
      if ("Notification" in window) perm = await Notification.requestPermission();
      setNotifyOn(true);
      notifyOnRef.current = true;
      playPling();
      setToast({
        kind: "ok",
        text:
          perm === "granted"
            ? "🔔 An — Pling + Laptop-Meldung bei jedem neuen Wunsch."
            : "🔔 Pling an. Laptop-Meldung hat der Browser blockiert — Banner + Pling laufen trotzdem."
      });
    } catch {
      setToast({ kind: "err", text: "Konnte Töne nicht aktivieren." });
    }
  }

  async function trackCurrentSongNow() {
    try {
      const npRes = await fetch("/api/spotify/now-playing", { cache: "no-store" });
      const np = await npRes.json();
      if (!np?.track?.id) {
        setToast({
          kind: "err",
          text: `Spotify meldet keinen Song. Grund: ${np?.reason ?? "unbekannt"}`
        });
        return;
      }

      const trackRes = await fetch(`/api/events/${eventId}/track-play`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotify_track_id: np.track.id,
          title: np.track.title,
          artist: np.track.artist,
          cover_url: np.track.cover_url,
          source: "auto",
          request_id: null
        })
      });
      const trackData = await trackRes.json();
      if (!trackData.ok) {
        setToast({
          kind: "err",
          text: `DB-Fehler: ${trackData.message ?? "unbekannt"}${trackData.hint ? ` (Hinweis: ${trackData.hint})` : ""}`
        });
        return;
      }

      lastSeenTrackRef.current = np.track.id;
      if (trackData.skipped) {
        setToast({
          kind: "ok",
          text: `${np.track.title} läuft noch — wurde vor wenigen Minuten schon mitgeschrieben.`
        });
      } else {
        setToast({
          kind: "ok",
          text: `Mitgeschrieben: ${np.track.title} (${trackData.genresCount ?? 0} Genre-Tags)`
        });
      }

      // Vibe sofort neu laden
      try {
        const vRes = await fetch(`/api/events/${eventId}/vibe`, { cache: "no-store" });
        const vData = await vRes.json();
        setVibeTokens(vData.vibeTokens ?? {});
        setVibePlayCount(vData.playCount ?? 0);
        setVibeRawPlayCount(vData.rawPlayCount ?? 0);
      } catch {}
    } catch (e) {
      setToast({ kind: "err", text: `Fehler: ${(e as Error).message ?? "unbekannt"}` });
    }
  }

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

  // Top-5 Vibe-Woerter fuer die Anzeige
  const topVibeWords = Object.entries(vibeTokens)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

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

      {/* Vibe-Status: zeigt woraus der Match-Score gerade gebildet wird */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs space-y-2">
        {vibeRawPlayCount === 0 ? (
          <span className="text-white/40">
            🎚 Vibe: Noch keine Songs getrackt.
          </span>
        ) : vibePlayCount === 0 ? (
          <span className="text-yellow-300/80">
            🎚 {vibeRawPlayCount} Song{vibeRawPlayCount > 1 ? "s" : ""} getrackt, aber Spotify liefert für den/die Künstler keine Genre-Tags. Match-Score braucht Songs mit Tags (z.&nbsp;B. populäre Künstler).
          </span>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/50">🎚 Aktueller Vibe ({vibePlayCount} von {vibeRawPlayCount} Song{vibeRawPlayCount > 1 ? "s" : ""} mit Tags):</span>
            {topVibeWords.map((word) => (
              <span
                key={word}
                className="px-2 py-0.5 rounded-full bg-neon-purple/20 text-neon-purple/90 border border-neon-purple/30"
              >
                {word}
              </span>
            ))}
          </div>
        )}

        {/* Spotify Status-Zeile + Manuell-Button */}
        <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-white/5">
          <span className="text-white/40">
            {nowPlayingDebug
              ? nowPlayingDebug.title
                ? `Spotify meldet: „${nowPlayingDebug.title}" ${nowPlayingDebug.playing ? "(läuft)" : "(pausiert)"}`
                : `Spotify-Status: ${nowPlayingDebug.reason ?? "unbekannt"}`
              : "Spotify-Abfrage läuft…"}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleNotifications()}
              className={`px-3 py-1 rounded-full border text-[11px] font-medium transition ${
                notifyOn
                  ? "border-neon-pink/50 text-neon-pink bg-neon-pink/10"
                  : "border-white/20 text-white/60 hover:bg-white/10"
              }`}
              title="Bei jedem neuen Wunsch: Pling + Banner (und Laptop-Meldung, wenn der Browser sie erlaubt)"
            >
              {notifyOn ? "🔔 Meldungen an" : "🔕 Meldungen aktivieren"}
            </button>
            <button
              onClick={() => trackCurrentSongNow()}
              className="px-3 py-1 rounded-full border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10 text-[11px] font-medium transition"
            >
              Jetzt mitschreiben
            </button>
          </div>
        </div>
      </div>

      {requests.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <p className="text-white/40 text-sm">
            Noch keine Wünsche. Gäste können jetzt über den QR-Code Songs wünschen.
          </p>
        </div>
      )}

      {requests.length > 0 && (() => {
        const activeRequests = requests
          .filter((r) => r.status === "pending" || r.status === "approved")
          .sort((a, b) => {
            // Heisseste Wuensche zuerst (nach Votes), dann FIFO
            const va = voteCounts[a.id] ?? 0;
            const vb = voteCounts[b.id] ?? 0;
            if (vb !== va) return vb - va;
            return a.created_at.localeCompare(b.created_at);
          });
        const playedRequests = requests.filter((r) => r.status === "played");
        const rejectedRequests = requests.filter((r) => r.status === "rejected");

        const renderItem = (req: SongRequest) => {
          const serverMatch = matches[req.spotify_track_id];
          return (
          <li
            key={req.id}
            className={`rounded-2xl border border-white/10 bg-white/5 p-4 transition ${
              req.status === "played" ? "opacity-60" : ""
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
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLE[req.status]}`}
                >
                  {STATUS_LABEL[req.status]}
                </span>
                {(req.status === "pending" || req.status === "approved") && (() => {
                  const vc = voteCounts[req.id] ?? 0;
                  if (vc === 0) return null;
                  return (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
                        vc >= 3
                          ? "bg-neon-pink/20 text-neon-pink border-neon-pink/40"
                          : "bg-white/10 text-white/70 border-white/20"
                      }`}
                      title={`${vc} Gast${vc === 1 ? "" : "."}-Vote${vc === 1 ? "" : "s"}`}
                    >
                      {vc >= 3 ? "🔥" : "❤️"} {vc}
                    </span>
                  );
                })()}
                {vibePlayCount >= 1 && typeof serverMatch === "number" && (req.status === "pending" || req.status === "approved") && (
                  <MatchPill percent={serverMatch} />
                )}
              </div>
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
        );
        };

        const noActiveOnly =
          activeRequests.length === 0 &&
          (playedRequests.length > 0 || rejectedRequests.length > 0);

        return (
          <>
            {activeRequests.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {activeRequests.map(renderItem)}
              </ul>
            ) : noActiveOnly ? (
              <p className="text-white/40 text-sm text-center py-4">
                Keine aktiven Wünsche — siehe unten für gespielte/abgelehnte
              </p>
            ) : null}

            {playedRequests.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowPlayed(!showPlayed)}
                  className="w-full px-4 py-3 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 text-white/70 hover:text-white text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <span
                    className="transition-transform"
                    style={{ transform: showPlayed ? "rotate(180deg)" : "rotate(0deg)" }}
                  >
                    ▼
                  </span>
                  {showPlayed
                    ? "Gespielte verbergen"
                    : `${playedRequests.length} bereits gespielt anzeigen`}
                </button>
                {showPlayed && (
                  <ul className="flex flex-col gap-3 mt-3">
                    {playedRequests.map(renderItem)}
                  </ul>
                )}
              </div>
            )}

            {rejectedRequests.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setShowRejected(!showRejected)}
                  className="w-full px-4 py-3 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 text-white/70 hover:text-white text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <span
                    className="transition-transform"
                    style={{ transform: showRejected ? "rotate(180deg)" : "rotate(0deg)" }}
                  >
                    ▼
                  </span>
                  {showRejected
                    ? "Abgelehnte verbergen"
                    : `${rejectedRequests.length} abgelehnt anzeigen`}
                </button>
                {showRejected && (
                  <ul className="flex flex-col gap-3 mt-3">
                    {rejectedRequests.map(renderItem)}
                  </ul>
                )}
              </div>
            )}
          </>
        );
      })()}
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

function MatchPill({ percent }: { percent: number }) {
  const tone = matchTone(percent);
  const palette = {
    high: "bg-green-500/20 text-green-300 border-green-500/40",
    mid: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    low: "bg-red-500/20 text-red-300 border-red-500/40"
  }[tone];
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${palette}`}
      title="Wie gut der Song zur aktuellen Stimmung (letzte 10 Plays) passt"
    >
      🎚 {percent}%
    </span>
  );
}
