"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { SpotifyTrack } from "@/lib/types";
import { getGuestSessionId } from "@/lib/guest-session";
import { subscribeForEvent } from "@/lib/push-client";
import { matchPercent, matchTone } from "@/lib/vibe-match";

interface Props {
  eventId: string;
  paypalHandle?: string | null;
  djDisplayName?: string;
}

const QUICK_TIP_AMOUNTS = [2, 4, 6];

function useDebounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(
    (...args: Parameters<T>) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), ms);
    },
    [fn, ms]
  );
}

export default function SongRequestForm({
  eventId,
  paypalHandle,
  djDisplayName
}: Props) {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [selected, setSelected] = useState<SpotifyTrack | null>(null);
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Trinkgeld-Prompt-Status nach Wunsch-Submit
  const [tipStatus, setTipStatus] = useState<"pending" | "given" | "later">(
    "pending"
  );
  // Push-Status nach Submit: ok = wird benachrichtigt, oder Grund
  const [pushStatus, setPushStatus] = useState<
    { ok: true } | { ok: false; reason: string } | null
  >(null);
  // iOS Detection (kein Push ohne PWA-Install)
  const [isIosNoPwa, setIsIosNoPwa] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    interface NavWithStandalone extends Navigator { standalone?: boolean }
    const isStandalone =
      (window.navigator as NavWithStandalone).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    setIsIosNoPwa(isIos && !isStandalone);
  }, []);

  // Vibe-Match-Gimmick: zeigt wie gut der ausgewaehlte Song zum aktuellen
  // Vibe passt. "—" wenn noch keine Songs gespielt wurden.
  const [selectedGenres, setSelectedGenres] = useState<string[] | null>(null);
  const [vibeTokens, setVibeTokens] = useState<Record<string, number>>({});
  const [vibePlayCount, setVibePlayCount] = useState(0);
  const [vibeLoaded, setVibeLoaded] = useState(false);

  // Vibe einmal beim Mount laden + alle 30s aktualisieren
  useEffect(() => {
    let cancelled = false;
    async function loadVibe() {
      try {
        const res = await fetch(`/api/events/${eventId}/vibe`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        setVibeTokens(data.vibeTokens ?? {});
        setVibePlayCount(data.playCount ?? 0);
        setVibeLoaded(true);
      } catch {
        if (!cancelled) setVibeLoaded(true);
      }
    }
    loadVibe();
    const id = setInterval(loadVibe, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [eventId]);

  // Wenn Track ausgewaehlt: Genres holen — Artist direkt mitgeben,
  // damit der Server nicht erst Spotify nach dem Artist fragen muss.
  useEffect(() => {
    if (!selected) { setSelectedGenres(null); return; }
    let cancelled = false;
    const url = `/api/spotify/track-genres?artist=${encodeURIComponent(selected.artist)}&track_id=${selected.id}`;
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setSelectedGenres(d.genres ?? []); })
      .catch(() => { if (!cancelled) setSelectedGenres([]); });
    return () => { cancelled = true; };
  }, [selected]);

  const match = selected && selectedGenres
    ? matchPercent(selectedGenres, vibeTokens)
    : null;

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setTracks([]); return; }
    // Gäste sehen 8 Treffer (mobil-freundlich, weniger Scrollen).
    const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&limit=8`);
    const data = await res.json();
    setTracks(data.tracks ?? []);
  }, []);

  const debouncedSearch = useDebounce(search, 350);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelected(null);
    debouncedSearch(value);
  }

  async function handleSubmit() {
    if (!selected) return;
    setLoading(true);
    setError(null);

    const sessionId = getGuestSessionId();
    const supabase = createClient();

    // Cooldown-Check: 5 Min zwischen Wuenschen pro Gast & Event.
    // Verhindert Spam und sorgt fuer gleichmaessigen Flow uebers Event.
    const COOLDOWN_MIN = 5;
    const cutoffIso = new Date(Date.now() - COOLDOWN_MIN * 60_000).toISOString();
    const { data: recent } = await supabase
      .from("song_requests")
      .select("created_at")
      .eq("event_id", eventId)
      .eq("requester_session_id", sessionId)
      .gte("created_at", cutoffIso)
      .order("created_at", { ascending: false })
      .limit(1);
    if (recent && recent.length > 0) {
      const lastMs = new Date(recent[0].created_at).getTime();
      const remainingMs = COOLDOWN_MIN * 60_000 - (Date.now() - lastMs);
      const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));
      const min = Math.floor(remainingSec / 60);
      const sec = remainingSec % 60;
      const stamp = `${min}:${sec.toString().padStart(2, "0")}`;
      setError(
        `Du hast gerade erst einen Wunsch geschickt. Bitte warte noch ${stamp} Min — damit jeder mal drankommt. 🎶`
      );
      setLoading(false);
      return;
    }

    const baseRow = {
      event_id: eventId,
      spotify_track_id: selected.id,
      title: selected.title,
      artist: selected.artist,
      cover_url: selected.cover_url,
      guest_nickname: nickname.trim() || null,
      requester_session_id: sessionId,
      status: "pending" as const
    };

    // Erst mit artist_genres versuchen — wenn die Spalte (noch) nicht
    // existiert oder Schema-Cache veraltet ist, ohne Genres erneut versuchen.
    let inserted: { id: string } | null = null;
    let dbError: { message?: string; code?: string } | null = null;
    {
      const res = await supabase
        .from("song_requests")
        .insert({ ...baseRow, artist_genres: selectedGenres ?? null })
        .select("id")
        .single();
      inserted = res.data;
      dbError = res.error;
    }

    if (dbError) {
      const msg = (dbError.message ?? "").toLowerCase();
      const isGenresColumnIssue =
        msg.includes("artist_genres") ||
        msg.includes("schema cache") ||
        dbError.code === "PGRST204";
      if (isGenresColumnIssue) {
        console.warn("Retry without artist_genres:", dbError);
        const res = await supabase
          .from("song_requests")
          .insert(baseRow)
          .select("id")
          .single();
        inserted = res.data;
        dbError = res.error;
      }
    }

    setLoading(false);

    if (dbError) {
      console.error("Song request insert failed:", dbError);
      setError(
        `Konnte deinen Wunsch nicht speichern (${dbError.message ?? "unbekannter Fehler"}).`
      );
      return;
    }

    setSubmitted(true);

    // Service Worker + Push-Subscription anlegen — Ergebnis sichtbar machen.
    subscribeForEvent({ eventId, sessionId })
      .then((r) => {
        if (r.ok) setPushStatus({ ok: true });
        else setPushStatus({ ok: false, reason: r.reason ?? "unknown" });
      })
      .catch(() => setPushStatus({ ok: false, reason: "exception" }));

    // Push-Notification an den DJ schicken (fire-and-forget)
    if (inserted?.id) {
      fetch("/api/push/notify-wish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: inserted.id })
      }).catch(() => {});
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-bold text-white">Wunsch angekommen!</h2>
        {selected && (
          <p className="text-white/70">
            <span className="text-white font-medium">{selected.title}</span> von{" "}
            <span className="text-white font-medium">{selected.artist}</span> ist
            beim DJ.
          </p>
        )}

        {/* Push-Status: zeigt klar ob Browser-Push aktiv ist */}
        <PushStatusBox status={pushStatus} isIosNoPwa={isIosNoPwa} />

        {/* Trinkgeld-Prompt — Impuls im emotionalen Peak. Nur wenn PayPal
            beim DJ hinterlegt und der Gast noch keine Entscheidung getroffen
            hat. */}
        {paypalHandle && tipStatus === "pending" && (
          <QuickTipPrompt
            paypalHandle={paypalHandle}
            djDisplayName={djDisplayName || "den DJ"}
            onGiven={() => setTipStatus("given")}
            onLater={() => setTipStatus("later")}
          />
        )}

        {tipStatus === "given" && (
          <div className="rounded-2xl bg-neon-pink/15 border border-neon-pink/40 px-5 py-3 text-neon-pink text-sm font-semibold flex items-center gap-2">
            <span className="text-lg">💝</span>
            Danke — {djDisplayName || "der DJ"} freut sich riesig!
          </div>
        )}

        <button
          onClick={() => {
            setSubmitted(false);
            setSelected(null);
            setQuery("");
            setTracks([]);
            setNickname("");
            setPushStatus(null);
            // tipStatus BEWUSST nicht resetten — sonst wird der Gast bei
            // jedem weiteren Wunsch erneut nach Trinkgeld gefragt (nervt)
          }}
          className="mt-4 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition"
        >
          Noch einen Wunsch schicken
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-4">
      {/* Prominenter Header — macht klar: HIER passiert was */}
      {!selected && (
        <div className="text-center mb-1">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-neon-pink via-neon-purple to-neon-cyan bg-clip-text text-transparent">
            🎵 Wünsch dir deinen Song
          </h2>
          <p className="text-white/50 text-sm mt-1">
            Suche unten — Spotify-Katalog, einfach tippen
          </p>
        </div>
      )}

      {/* Suchfeld — prominent mit Glow, Lupe-Icon, kraeftigerem Border */}
      <div className="relative">
        {/* Glow-Hintergrund hinter dem Input */}
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-neon-pink/20 via-neon-purple/20 to-neon-cyan/20 blur-md opacity-70 pointer-events-none"
          aria-hidden
        />

        <div className="relative">
          {/* Lupe-Icon links */}
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 text-neon-pink pointer-events-none"
            width={22}
            height={22}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="20" y1="20" x2="16.5" y2="16.5" />
          </svg>

          <input
            type="text"
            placeholder="Song oder Künstler eingeben…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="w-full rounded-2xl bg-white/15 border-2 border-neon-purple/50 pl-12 pr-5 py-4 text-white placeholder:text-white/55 focus:outline-none focus:border-neon-pink focus:bg-white/20 transition text-base font-medium shadow-lg shadow-neon-purple/10"
          />
        </div>

        {query.length >= 2 && tracks.length === 0 && (
          <p className="mt-2 text-sm text-white/40 text-center">Keine Treffer</p>
        )}
      </div>

      {/* Suchergebnisse */}
      {tracks.length > 0 && !selected && (
        <ul className="flex flex-col gap-2">
          {tracks.map((track) => (
            <li key={track.id}>
              <button
                onClick={() => { setSelected(track); setTracks([]); }}
                className="w-full flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 hover:border-neon-purple/60 hover:bg-white/10 p-3 transition text-left"
              >
                {track.cover_url && (
                  <Image
                    src={track.cover_url}
                    alt={track.album}
                    width={48}
                    height={48}
                    className="rounded-lg flex-shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{track.title}</p>
                  <p className="text-white/50 text-sm truncate">{track.artist}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Ausgewählter Song */}
      {selected && (
        <div className="flex flex-col gap-2 rounded-2xl border border-neon-purple/50 bg-neon-purple/10 p-4">
          <div className="flex items-center gap-3">
            {selected.cover_url && (
              <Image
                src={selected.cover_url}
                alt={selected.album}
                width={56}
                height={56}
                className="rounded-lg flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold truncate">{selected.title}</p>
              <p className="text-white/60 text-sm truncate">{selected.artist}</p>
            </div>
            <button
              onClick={() => { setSelected(null); setQuery(""); }}
              className="text-white/40 hover:text-white text-xl px-1"
            >
              ✕
            </button>
          </div>

          {/* Vibe-Match-Gimmick */}
          {vibeLoaded && (
            <VibeMatchBadge
              loading={selectedGenres === null}
              percent={match?.percent ?? null}
              vibePlayCount={vibePlayCount}
              genresKnown={(selectedGenres?.length ?? 0) > 0}
            />
          )}
        </div>
      )}

      {/* Nickname (optional) */}
      {selected && (
        <input
          type="text"
          placeholder="Dein Name (optional)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={30}
          className="w-full rounded-2xl bg-white/10 border border-white/20 px-5 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-neon-cyan transition text-sm"
        />
      )}

      {/* Absenden */}
      <button
        onClick={handleSubmit}
        disabled={!selected || loading}
        className="w-full py-4 rounded-2xl font-bold text-base tracking-wide transition bg-gradient-to-r from-neon-pink to-neon-purple text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95"
      >
        {loading ? "Wird gesendet…" : "Wunsch abschicken 🎵"}
      </button>

      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}
    </div>
  );
}

function PushStatusBox({
  status,
  isIosNoPwa
}: {
  status: { ok: true } | { ok: false; reason: string } | null;
  isIosNoPwa: boolean;
}) {
  // Status noch nicht da
  if (status === null) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white/60">
        🔔 Push wird eingerichtet…
      </div>
    );
  }

  if (status.ok) {
    return (
      <div className="rounded-2xl bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-300">
        🔔 <strong>Du wirst benachrichtigt</strong> sobald dein Song läuft — auch wenn du draußen bist oder die App geschlossen hast.
      </div>
    );
  }

  // Fehler-Erklaerung pro Reason
  const explanations: Record<string, string> = {
    unsupported: "Dein Browser unterstützt keine Push-Benachrichtigungen.",
    denied: "Du hast Benachrichtigungen abgelehnt. Du kannst es in den Browser-Einstellungen wieder erlauben.",
    no_vapid: "Push-System ist gerade nicht konfiguriert.",
    sw_failed: "Service Worker konnte nicht starten.",
    subscribe_failed: "Push-Anmeldung fehlgeschlagen.",
    store_failed: "Konnte deine Anmeldung nicht speichern.",
    exception: "Push-Anmeldung fehlgeschlagen."
  };
  const why = explanations[status.reason] ?? status.reason;

  return (
    <div className="rounded-2xl bg-yellow-500/10 border border-yellow-500/30 px-4 py-3 text-sm text-yellow-200 space-y-2">
      <p>🔕 <strong>Keine Browser-Benachrichtigung aktiv.</strong></p>
      <p className="text-yellow-200/70 text-xs">{why}</p>
      {isIosNoPwa && (
        <p className="text-yellow-100 text-xs border-t border-yellow-500/20 pt-2 mt-1">
          📲 <strong>iPhone-Tipp:</strong> Tippe unten auf das Teilen-Symbol → <em>„Zum Home-Bildschirm hinzufügen"</em>. Dann öffne wishbeat von dort und sende deinen Wunsch — danach kommen auch echte Push-Nachrichten.
        </p>
      )}
    </div>
  );
}

function VibeMatchBadge({
  loading,
  percent,
  vibePlayCount,
  genresKnown
}: {
  loading: boolean;
  percent: number | null;
  vibePlayCount: number;
  genresKnown: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/40">
        Vibe-Check läuft…
      </div>
    );
  }
  if (vibePlayCount < 1) {
    return (
      <div className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/50">
        🎚 Vibe-Check kommt, sobald die Party läuft.
      </div>
    );
  }
  if (!genresKnown || percent === null) {
    return (
      <div className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/40">
        🎚 Vibe-Check: Genre unbekannt
      </div>
    );
  }
  const tone = matchTone(percent);
  const palette = {
    high: "bg-green-500/15 text-green-300 border-green-500/30",
    mid: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    low: "bg-red-500/15 text-red-300 border-red-500/30"
  }[tone];
  const label = tone === "high"
    ? "passt zum Vibe"
    : tone === "mid"
    ? "passt teilweise"
    : "anderer Stil";
  return (
    <div className={`rounded-xl border ${palette} px-3 py-2 flex items-center justify-between gap-3 text-xs`}>
      <span className="font-medium">🎚 Vibe-Match</span>
      <span className="font-bold text-base">{percent}%</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}

function QuickTipPrompt({
  paypalHandle,
  djDisplayName,
  onGiven,
  onLater
}: {
  paypalHandle: string;
  djDisplayName: string;
  onGiven: () => void;
  onLater: () => void;
}) {
  return (
    <div className="w-full max-w-sm rounded-3xl border border-neon-pink/30 bg-gradient-to-br from-neon-pink/10 to-neon-purple/5 p-5">
      <p className="text-white font-semibold text-sm text-center">
        💝 {djDisplayName} freut sich über ein kleines Trinkgeld
      </p>
      <p className="text-white/50 text-xs mt-1 mb-4 text-center">
        Freiwillig — 2 Klicks in PayPal reichen.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {QUICK_TIP_AMOUNTS.map((amount) => (
          <a
            key={amount}
            href={`https://paypal.me/${paypalHandle}/${amount}EUR`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onGiven}
            className="py-3 rounded-2xl bg-gradient-to-r from-neon-pink to-neon-purple text-white font-bold text-sm text-center transition active:scale-95 hover:opacity-90"
          >
            {amount} €
          </a>
        ))}
      </div>
      <button
        type="button"
        onClick={onLater}
        className="w-full mt-3 py-2 text-white/40 hover:text-white/70 text-xs transition"
      >
        Später vielleicht
      </button>
      <p className="text-white/25 text-[10px] mt-2 text-center">
        Wird als Schenkung an Freund/Familie über PayPal gesendet — keine Gebühren.
      </p>
    </div>
  );
}
