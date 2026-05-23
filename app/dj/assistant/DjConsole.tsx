"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { SongRequest, RequestStatus } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────────────

interface ActiveEvent {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  event_date?: string;
}

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover_url: string | null;
  duration_ms: number;
}

interface NowPlayingTrack extends Track {
  artist_id: string | null;
  uri: string;
  release_year: number | null;
}

type NowPlayingResp =
  | { playing: true; progress_ms: number; track: NowPlayingTrack }
  | { playing: false; reason: string };

interface AiSuggestion {
  title: string;
  artist: string;
  reason: string;
  spotify_track_id: string;
  cover_url: string | null;
  album: string | null;
}

type Toast = { kind: "ok" | "err"; text: string } | null;

interface Props {
  userEmail: string;
  activeEvent: ActiveEvent | null;
}

// ─── Main Component ────────────────────────────────────────────────

export default function DjConsole({ userEmail, activeEvent }: Props) {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingResp | null>(null);
  const [nowPlayingFetchedAt, setNowPlayingFetchedAt] = useState(Date.now());
  const [queueTracks, setQueueTracks] = useState<Track[]>([]);
  const [wishes, setWishes] = useState<SongRequest[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [queueBusy, setQueueBusy] = useState<string | null>(null);
  const [wishBusy, setWishBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  // Mixer-States (alle visual-only, Spotify Web API erlaubt diese Controls nicht)
  const [crossfader, setCrossfader] = useState(50); // 0 = full A, 100 = full B
  const [masterVol, setMasterVol] = useState(75);
  const [eqA, setEqA] = useState({ high: 50, mid: 50, low: 50 });
  const [eqB, setEqB] = useState({ high: 50, mid: 50, low: 50 });
  const [activeDeck, setActiveDeck] = useState<"A" | "B">("A");

  const eventId = activeEvent?.id;

  // ─── Polling: Now-Playing + Queue ─────────────────────────────────

  const fetchNowPlaying = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/now-playing", { cache: "no-store" });
      const data: NowPlayingResp = await res.json();
      setNowPlaying(data);
      setNowPlayingFetchedAt(Date.now());
    } catch {}
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/my-queue", { cache: "no-store" });
      const data = await res.json();
      setQueueTracks(data.queue ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNowPlaying();
    fetchQueue();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchNowPlaying();
        fetchQueue();
      }
    }, 5000);
    return () => clearInterval(id);
  }, [fetchNowPlaying, fetchQueue]);

  // ─── Realtime Wishes ──────────────────────────────────────────────

  useEffect(() => {
    if (!eventId) return;
    const supabase = createClient();

    async function loadWishes() {
      const { data } = await supabase
        .from("song_requests")
        .select("*")
        .eq("event_id", eventId)
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: true });
      if (data) setWishes(data as SongRequest[]);
    }

    loadWishes();
    const channel = supabase
      .channel(`console-wishes-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "song_requests", filter: `event_id=eq.${eventId}` },
        () => loadWishes()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  // ─── Toast Auto-Dismiss ──────────────────────────────────────────

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ─── Actions ──────────────────────────────────────────────────────

  async function playPause(action: "play" | "pause" | "next" | "previous") {
    try {
      const res = await fetch("/api/spotify/playback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!data.ok) {
        setToast({ kind: "err", text: data.message ?? "Playback-Fehler" });
        return;
      }
      // Sofort neu fetchen damit UI synchron ist
      setTimeout(fetchNowPlaying, 400);
    } catch (e) {
      setToast({ kind: "err", text: `Fehler: ${(e as Error).message}` });
    }
  }

  async function queueTrack(track: { id: string; title: string }) {
    setQueueBusy(track.id);
    try {
      const res = await fetch("/api/spotify/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotify_track_id: track.id })
      });
      const data = await res.json();
      setToast(data.ok
        ? { kind: "ok", text: `In Queue: ${track.title}` }
        : { kind: "err", text: data.message ?? "Queue-Fehler" });
      if (data.ok) setTimeout(fetchQueue, 600);
    } finally {
      setQueueBusy(null);
    }
  }

  async function updateWishStatus(req: SongRequest, status: RequestStatus, andQueue = false) {
    setWishBusy(req.id);
    try {
      const supabase = createClient();
      await supabase.from("song_requests").update({ status }).eq("id", req.id);
      if (andQueue) {
        const r = await fetch("/api/spotify/queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spotify_track_id: req.spotify_track_id })
        });
        const d = await r.json();
        setToast(d.ok
          ? { kind: "ok", text: `In Spotify-Queue: ${req.title}` }
          : { kind: "err", text: d.message ?? "Queue-Fehler" });
        if (d.ok) setTimeout(fetchQueue, 600);
      } else {
        setToast({ kind: "ok", text: `Status: ${STATUS_LABEL[status]}` });
      }
      if (status === "played") {
        fetch("/api/push/notify-played", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_id: req.id })
        }).catch(() => {});
      }
    } finally {
      setWishBusy(null);
    }
  }

  async function askAi() {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/suggest-next", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setAiError(data.message ?? "KI-Fehler");
        setAiSuggestions(null);
      } else {
        const valid = (data.suggestions ?? []).filter(
          (s: { spotify_track_id: string | null }) => s.spotify_track_id
        );
        setAiSuggestions(valid);
      }
    } catch (e) {
      setAiError(`Netzwerk: ${(e as Error).message}`);
    } finally {
      setAiLoading(false);
    }
  }

  // ─── Derived State ───────────────────────────────────────────────

  const playing = nowPlaying?.playing === true && "track" in nowPlaying ? nowPlaying : null;
  const isPlaying = !!playing;
  const deckATrack = playing?.track ?? null;
  const deckBTrack = queueTracks[0] ?? null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-purple-950/30 text-white">
      {/* ═══ HEADER ═══ */}
      <Header
        userEmail={userEmail}
        activeEvent={activeEvent}
        isPlaying={isPlaying}
      />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* ═══ DECKS + MIXER ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px_1fr] gap-4">
          <DeckCard
            label="A"
            track={deckATrack
              ? {
                  id: deckATrack.id,
                  title: deckATrack.title,
                  artist: deckATrack.artist,
                  album: deckATrack.album,
                  cover_url: deckATrack.cover_url,
                  duration_ms: deckATrack.duration_ms
                }
              : null}
            progress_ms={playing?.progress_ms ?? 0}
            progressFetchedAt={nowPlayingFetchedAt}
            isLive={true}
            isPlaying={isPlaying}
            isActive={activeDeck === "A"}
            onActivate={() => setActiveDeck("A")}
            onPlayPause={() => playPause(isPlaying ? "pause" : "play")}
            onPrev={() => playPause("previous")}
            onNext={() => playPause("next")}
            colorAccent="cyan"
          />

          <Mixer
            crossfader={crossfader}
            setCrossfader={setCrossfader}
            masterVol={masterVol}
            setMasterVol={setMasterVol}
            eqA={eqA}
            setEqA={setEqA}
            eqB={eqB}
            setEqB={setEqB}
            isPlaying={isPlaying}
          />

          <DeckCard
            label="B"
            track={deckBTrack}
            progress_ms={0}
            progressFetchedAt={Date.now()}
            isLive={false}
            isPlaying={false}
            isActive={activeDeck === "B"}
            onActivate={() => setActiveDeck("B")}
            onPlayPause={() => setToast({
              kind: "err",
              text: "Deck B ist eine Vorschau der Spotify-Queue. Steuere Wiedergabe über Deck A."
            })}
            onPrev={() => {}}
            onNext={() => {}}
            colorAccent="pink"
          />
        </div>

        {/* ═══ LIVE-WÜNSCHE / QUEUE / AI ═══ */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <WishesPanel
            wishes={wishes}
            busyId={wishBusy}
            hasEvent={!!activeEvent}
            onAcceptQueue={(r) => updateWishStatus(r, "approved", true)}
            onReject={(r) => updateWishStatus(r, "rejected")}
            onPlayed={(r) => updateWishStatus(r, "played")}
          />

          <QueuePanel tracks={queueTracks} />

          <AiPanel
            suggestions={aiSuggestions}
            loading={aiLoading}
            error={aiError}
            hasNowPlaying={isPlaying}
            onAsk={askAi}
            onQueue={queueTrack}
            queueBusy={queueBusy}
          />
        </div>

        {/* ═══ INFO-FOOTER ═══ */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/40">
          <p>
            💡 <strong className="text-white/60">Hinweis:</strong> Crossfader, EQ-Knöpfe, Volume-Fader, BPM/Key,
            Cue/Sync/Loop und VU-Meter sind <strong className="text-white/60">visuell</strong> — Spotify Web API erlaubt
            kein Audio-Mixing. Real funktionieren: Play/Pause, Next/Previous, Spotify-Queue,
            Live-Wünsche, KI-Vorschläge.
          </p>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-medium shadow-2xl border backdrop-blur ${
          toast.kind === "ok"
            ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40"
            : "bg-red-500/20 text-red-300 border-red-500/40"
        }`}>
          {toast.text}
        </div>
      )}
    </main>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Header
// ═════════════════════════════════════════════════════════════════════

function Header({
  userEmail,
  activeEvent,
  isPlaying
}: {
  userEmail: string;
  activeEvent: ActiveEvent | null;
  isPlaying: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/60 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dj"
            className="text-2xl drop-shadow-[0_0_15px_rgba(168,85,247,0.6)]"
            title="Zurück zum Dashboard"
          >
            🎚
          </Link>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-white truncate">
              WishBeat <span className="text-neon-purple">DJ Console</span>
            </h1>
            <p className="text-[11px] text-white/40 truncate">
              {activeEvent
                ? <>Event: <span className="text-white/70">{activeEvent.name}</span></>
                : "Kein aktives Event"}
              {" · "}
              <span className="text-white/40">{userEmail}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status-Pill */}
          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
            isPlaying
              ? "bg-red-500/20 text-red-300 border-red-500/40 animate-pulse"
              : "bg-white/5 text-white/60 border-white/20"
          }`}>
            <span className={`w-2 h-2 rounded-full ${isPlaying ? "bg-red-400" : "bg-white/40"}`} />
            {isPlaying ? "🔴 LIVE" : "READY"}
          </span>

          <Link
            href="/dj/settings"
            className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs font-medium transition"
          >
            ⚙ Settings
          </Link>
          {activeEvent && (
            <Link
              href={`/dj/event/${activeEvent.id}`}
              className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs font-medium transition"
            >
              📋 Event
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Deck Card
// ═════════════════════════════════════════════════════════════════════

function DeckCard({
  label,
  track,
  progress_ms,
  progressFetchedAt,
  isLive,
  isPlaying,
  isActive,
  onActivate,
  onPlayPause,
  onPrev,
  onNext,
  colorAccent
}: {
  label: "A" | "B";
  track: Track | null;
  progress_ms: number;
  progressFetchedAt: number;
  isLive: boolean;
  isPlaying: boolean;
  isActive: boolean;
  onActivate: () => void;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  colorAccent: "cyan" | "pink";
}) {
  // Lokale Interpolation des Progress fuer fluessigen Anzeige zwischen Polls
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => setTick(Date.now()), 250);
    return () => clearInterval(id);
  }, [isPlaying]);

  const elapsed = isPlaying ? tick - progressFetchedAt : 0;
  const displayProgress = track
    ? Math.min(progress_ms + elapsed, track.duration_ms)
    : 0;
  const percent = track && track.duration_ms > 0
    ? (displayProgress / track.duration_ms) * 100
    : 0;
  const remaining = track ? track.duration_ms - displayProgress : 0;

  const accentClass = colorAccent === "cyan"
    ? "border-neon-cyan/30 shadow-[0_0_30px_rgba(34,211,238,0.15)]"
    : "border-neon-pink/30 shadow-[0_0_30px_rgba(236,72,153,0.15)]";
  const labelGradient = colorAccent === "cyan"
    ? "from-neon-cyan to-blue-500"
    : "from-neon-pink to-rose-500";

  return (
    <div
      onClick={onActivate}
      className={`rounded-3xl border-2 ${
        isActive ? accentClass : "border-white/10"
      } bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-black/80 p-4 cursor-pointer transition-all backdrop-blur-sm`}
    >
      {/* Deck-Header */}
      <div className="flex items-center justify-between mb-3">
        <div className={`text-3xl font-black bg-gradient-to-br ${labelGradient} bg-clip-text text-transparent`}>
          DECK {label}
        </div>
        {isLive && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            LIVE
          </span>
        )}
        {!isLive && track && (
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Up Next</span>
        )}
      </div>

      {!track ? (
        <DeckEmpty label={label} />
      ) : (
        <>
          {/* Cover + Info */}
          <div className="flex gap-3 mb-4">
            <div className="relative">
              {track.cover_url ? (
                <Image
                  src={track.cover_url}
                  alt={track.album}
                  width={96}
                  height={96}
                  className={`rounded-xl shadow-2xl ${isPlaying ? "animate-spin-slow" : ""}`}
                  style={isPlaying ? { animation: "spin 8s linear infinite" } : undefined}
                />
              ) : (
                <div className="w-24 h-24 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl">
                  🎵
                </div>
              )}
              {/* Spinning-Vinyl-Effekt-Overlay */}
              {isPlaying && (
                <div className="absolute inset-0 rounded-xl ring-2 ring-white/10" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-bold truncate text-base leading-tight">
                {track.title}
              </p>
              <p className="text-white/60 text-sm truncate mt-0.5">{track.artist}</p>
              <p className="text-white/30 text-xs truncate mt-0.5">{track.album}</p>
              {/* BPM/Key — visuell, da Spotify keine Audio-Features liefert */}
              <div className="flex gap-2 mt-2">
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-white/40">
                  BPM —
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-white/40">
                  KEY —
                </span>
              </div>
            </div>
          </div>

          {/* Waveform-Placeholder */}
          <Waveform percent={percent} isPlaying={isPlaying} colorAccent={colorAccent} />

          {/* Time */}
          <div className="flex justify-between mt-2 text-[11px] font-mono">
            <span className={colorAccent === "cyan" ? "text-neon-cyan" : "text-neon-pink"}>
              {formatTime(displayProgress)}
            </span>
            <span className="text-white/40">-{formatTime(remaining)}</span>
          </div>

          {/* Control Buttons */}
          <div className="grid grid-cols-5 gap-1.5 mt-3">
            <DeckBtn onClick={onPrev} title="Previous" disabled={!isLive}>⏮</DeckBtn>
            <DeckBtn onClick={() => {}} title="Cue (visual)" disabled>CUE</DeckBtn>
            <DeckBtn onClick={onPlayPause} primary title={isPlaying ? "Pause" : "Play"}>
              {isPlaying && isLive ? "⏸" : "▶"}
            </DeckBtn>
            <DeckBtn onClick={() => {}} title="Loop (visual)" disabled>⟳</DeckBtn>
            <DeckBtn onClick={onNext} title="Next" disabled={!isLive}>⏭</DeckBtn>
          </div>

          {/* Hot-Cue Pads (visual) */}
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                className={`h-8 rounded-md text-[10px] font-bold bg-gradient-to-br ${labelGradient} opacity-30 hover:opacity-60 transition cursor-default`}
                title="Hot-Cue (visuell)"
              >
                {n}
              </button>
            ))}
          </div>

          {/* Pitch-Slider (visual) */}
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Pitch (visual)</p>
            <input
              type="range"
              min={-8}
              max={8}
              step={0.1}
              defaultValue={0}
              className="w-full accent-purple-500 opacity-60"
            />
          </div>
        </>
      )}
    </div>
  );
}

function DeckEmpty({ label }: { label: string }) {
  return (
    <div className="text-center py-10 text-white/40">
      <div className="text-5xl mb-3 opacity-30">💿</div>
      <p className="text-sm">Kein Track auf Deck {label} geladen</p>
      <p className="text-xs mt-1 text-white/30">
        {label === "A"
          ? "Spiele etwas in Spotify ab"
          : "Der nächste Song in der Spotify-Queue erscheint hier"}
      </p>
    </div>
  );
}

function DeckBtn({
  children,
  onClick,
  primary,
  disabled,
  title
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick(); }}
      disabled={disabled}
      title={title}
      className={`h-10 rounded-md text-sm font-bold transition ${
        primary
          ? "bg-gradient-to-br from-neon-pink to-neon-purple text-white shadow-lg hover:brightness-110"
          : "bg-white/5 hover:bg-white/10 text-white/70 border border-white/10"
      } ${disabled ? "opacity-30 cursor-not-allowed" : "active:scale-95"}`}
    >
      {children}
    </button>
  );
}

// ─── Waveform (Pure CSS-Animation) ───────────────────────────────

function Waveform({
  percent,
  isPlaying,
  colorAccent
}: {
  percent: number;
  isPlaying: boolean;
  colorAccent: "cyan" | "pink";
}) {
  // Pseudo-Waveform: 64 vertikale Bars mit deterministischer Hoehe
  const bars = useMemo(() => Array.from({ length: 64 }, (_, i) => {
    // Pseudo-random aber stabil
    const seed = Math.sin(i * 13.37) * 1000;
    const h = 20 + (Math.abs(seed) % 80);
    return h;
  }), []);

  const accent = colorAccent === "cyan" ? "bg-neon-cyan" : "bg-neon-pink";
  const accentDim = colorAccent === "cyan" ? "bg-neon-cyan/30" : "bg-neon-pink/30";

  return (
    <div className="relative h-12 rounded-lg bg-black/40 border border-white/5 overflow-hidden">
      <div className="absolute inset-0 flex items-center gap-[1px] px-1">
        {bars.map((h, i) => {
          const pct = (i / bars.length) * 100;
          const played = pct < percent;
          return (
            <div
              key={i}
              className={`flex-1 rounded-sm transition-colors ${
                played ? accent : accentDim
              } ${isPlaying && i === Math.floor(percent / 1.5625) ? "animate-pulse" : ""}`}
              style={{ height: `${h}%` }}
            />
          );
        })}
      </div>
      {/* Playhead */}
      <div
        className={`absolute top-0 bottom-0 w-0.5 ${accent} shadow-[0_0_8px_currentColor]`}
        style={{ left: `${percent}%` }}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Mixer
// ═════════════════════════════════════════════════════════════════════

function Mixer({
  crossfader,
  setCrossfader,
  masterVol,
  setMasterVol,
  eqA,
  setEqA,
  eqB,
  setEqB,
  isPlaying
}: {
  crossfader: number;
  setCrossfader: (v: number) => void;
  masterVol: number;
  setMasterVol: (v: number) => void;
  eqA: { high: number; mid: number; low: number };
  setEqA: (v: { high: number; mid: number; low: number }) => void;
  eqB: { high: number; mid: number; low: number };
  setEqB: (v: { high: number; mid: number; low: number }) => void;
  isPlaying: boolean;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-950 via-black to-zinc-950 p-4 backdrop-blur-sm">
      <div className="text-center mb-3">
        <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-bold">MIXER</div>
        <div className="text-[9px] text-white/30 italic mt-0.5">(visuell)</div>
      </div>

      {/* VU-Meter */}
      <div className="flex justify-center gap-2 mb-4">
        <VuMeter isPlaying={isPlaying} side="L" />
        <VuMeter isPlaying={isPlaying} side="R" />
      </div>

      {/* EQ-Knobs */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-center text-[10px] text-neon-cyan font-bold mb-1">EQ-A</p>
          <div className="flex justify-around">
            <Knob label="HI" value={eqA.high} onChange={(v) => setEqA({ ...eqA, high: v })} />
            <Knob label="MID" value={eqA.mid} onChange={(v) => setEqA({ ...eqA, mid: v })} />
            <Knob label="LO" value={eqA.low} onChange={(v) => setEqA({ ...eqA, low: v })} />
          </div>
        </div>
        <div>
          <p className="text-center text-[10px] text-neon-pink font-bold mb-1">EQ-B</p>
          <div className="flex justify-around">
            <Knob label="HI" value={eqB.high} onChange={(v) => setEqB({ ...eqB, high: v })} color="pink" />
            <Knob label="MID" value={eqB.mid} onChange={(v) => setEqB({ ...eqB, mid: v })} color="pink" />
            <Knob label="LO" value={eqB.low} onChange={(v) => setEqB({ ...eqB, low: v })} color="pink" />
          </div>
        </div>
      </div>

      {/* Crossfader */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] font-bold mb-1">
          <span className="text-neon-cyan">A</span>
          <span className="text-white/40">CROSSFADER</span>
          <span className="text-neon-pink">B</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={crossfader}
          onChange={(e) => setCrossfader(Number(e.target.value))}
          className="w-full h-3 rounded-full appearance-none bg-gradient-to-r from-neon-cyan via-white/20 to-neon-pink cursor-pointer accent-white"
        />
      </div>

      {/* Master Volume */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] font-bold text-white/60 mb-1">
          <span>MASTER</span>
          <span className="font-mono">{masterVol}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={masterVol}
          onChange={(e) => setMasterVol(Number(e.target.value))}
          className="w-full accent-purple-500"
        />
      </div>

      {/* Auto-Mix Toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          className="py-2 rounded-md text-[10px] font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 transition"
          title="Auto-Mix (visuell — Spotify Web API hat keinen Mix-Modus)"
        >
          🎚 AUTO-MIX
        </button>
        <select
          className="py-2 rounded-md text-[10px] font-bold bg-white/5 border border-white/10 text-white/60 text-center cursor-pointer"
          defaultValue="fade"
          title="Übergangs-Modus (visuell)"
        >
          <option value="cut">CUT</option>
          <option value="fade">FADE</option>
          <option value="smooth">SMOOTH</option>
          <option value="energy">ENERGY+</option>
        </select>
      </div>

      {/* Cue-Buttons */}
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button className="py-2 rounded-md text-[10px] font-bold bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/30 text-neon-cyan transition" title="Vorhören A (visuell)">
          🎧 A
        </button>
        <button className="py-2 rounded-md text-[10px] font-bold bg-neon-pink/10 hover:bg-neon-pink/20 border border-neon-pink/30 text-neon-pink transition" title="Vorhören B (visuell)">
          🎧 B
        </button>
      </div>
    </div>
  );
}

// ─── Knob Component ─────────────────────────────────────────────

function Knob({
  label,
  value,
  onChange,
  color = "cyan"
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color?: "cyan" | "pink";
}) {
  // Mapping 0..100 → -135deg..135deg (270deg-Drehung um die 12-Uhr-Position)
  const rotation = -135 + (value / 100) * 270;
  const colorClass = color === "cyan" ? "stroke-neon-cyan" : "stroke-neon-pink";

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 5 : -5;
    onChange(Math.max(0, Math.min(100, value + delta)));
  };

  return (
    <div className="flex flex-col items-center gap-0.5 select-none">
      <div
        className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/10 relative cursor-pointer"
        style={{ transform: `rotate(${rotation}deg)` }}
        onWheel={handleWheel}
        onDoubleClick={() => onChange(50)}
        title={`${label}: ${value} (Doppelklick = Mitte, Mausrad = ändern)`}
      >
        <div className={`absolute top-1 left-1/2 -translate-x-1/2 w-0.5 h-3 ${color === "cyan" ? "bg-neon-cyan" : "bg-neon-pink"} rounded-full shadow-[0_0_6px_currentColor]`} />
      </div>
      <span className={`text-[8px] font-bold ${color === "cyan" ? "text-neon-cyan/70" : "text-neon-pink/70"} ${colorClass}`}>
        {label}
      </span>
    </div>
  );
}

// ─── VU-Meter ────────────────────────────────────────────────────

function VuMeter({ isPlaying, side }: { isPlaying: boolean; side: string }) {
  const [levels, setLevels] = useState<number[]>(Array(8).fill(0));
  useEffect(() => {
    if (!isPlaying) {
      setLevels(Array(8).fill(0));
      return;
    }
    const id = setInterval(() => {
      // Pseudo-VU: hoehere Wahrscheinlichkeit fuer mittlere Levels, gelegentliche Peaks
      setLevels(Array.from({ length: 8 }, (_, i) => {
        const base = Math.random();
        return base * (1 - i * 0.05);
      }));
    }, 120);
    return () => clearInterval(id);
  }, [isPlaying]);
  return (
    <div className="flex flex-col-reverse gap-[2px] w-2.5">
      {levels.map((l, i) => {
        const color = i >= 6 ? "bg-red-500" : i >= 4 ? "bg-yellow-400" : "bg-green-500";
        const active = l > (i / 8);
        return (
          <div
            key={`${side}-${i}`}
            className={`h-1.5 rounded-sm transition-opacity ${active ? `${color} opacity-90` : "bg-white/5 opacity-100"}`}
          />
        );
      })}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Wishes Panel
// ═════════════════════════════════════════════════════════════════════

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Offen",
  approved: "Angenommen",
  played: "Gespielt",
  rejected: "Abgelehnt"
};

function WishesPanel({
  wishes,
  busyId,
  hasEvent,
  onAcceptQueue,
  onReject,
  onPlayed
}: {
  wishes: SongRequest[];
  busyId: string | null;
  hasEvent: boolean;
  onAcceptQueue: (r: SongRequest) => void;
  onReject: (r: SongRequest) => void;
  onPlayed: (r: SongRequest) => void;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-white uppercase tracking-widest">
          🎤 Live-Wünsche
        </h2>
        <span className="text-[10px] text-white/40 font-mono">{wishes.length}</span>
      </div>
      {!hasEvent ? (
        <EmptyState text="Kein aktives Event — Wünsche erscheinen, sobald ein Event aktiv ist." />
      ) : wishes.length === 0 ? (
        <EmptyState text="Noch keine Songwünsche eingegangen." />
      ) : (
        <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {wishes.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 p-3 transition"
            >
              <div className="flex gap-2">
                {r.cover_url && (
                  <Image
                    src={r.cover_url}
                    alt={r.title}
                    width={40}
                    height={40}
                    className="rounded-md flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{r.title}</p>
                  <p className="text-white/50 text-xs truncate">{r.artist}</p>
                  <p className="text-white/30 text-[10px] truncate">
                    {r.guest_nickname ? `von ${r.guest_nickname}` : "anonym"}
                    {" · "}
                    <span className={
                      r.status === "approved" ? "text-neon-cyan" :
                      r.status === "pending" ? "text-yellow-400" :
                      r.status === "played" ? "text-white/30" : "text-red-400"
                    }>{STATUS_LABEL[r.status]}</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-1 mt-2 flex-wrap">
                {r.status === "pending" && (
                  <>
                    <ActionBtn onClick={() => onAcceptQueue(r)} disabled={busyId === r.id} variant="ok">
                      ✓ Queue
                    </ActionBtn>
                    <ActionBtn onClick={() => onReject(r)} disabled={busyId === r.id} variant="bad">
                      ✕
                    </ActionBtn>
                  </>
                )}
                {r.status === "approved" && (
                  <>
                    <ActionBtn onClick={() => onPlayed(r)} disabled={busyId === r.id} variant="ok">
                      🎵 Gespielt
                    </ActionBtn>
                    <ActionBtn onClick={() => onAcceptQueue(r)} disabled={busyId === r.id} variant="neutral">
                      ↻ Nochmal queuen
                    </ActionBtn>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  variant
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant: "ok" | "bad" | "neutral";
}) {
  const cls = variant === "ok"
    ? "border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10"
    : variant === "bad"
    ? "border-red-500/40 text-red-400 hover:bg-red-500/10"
    : "border-white/20 text-white/60 hover:bg-white/10";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2 py-1 rounded-full text-[10px] font-medium border transition disabled:opacity-50 disabled:cursor-wait ${cls}`}
    >
      {children}
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Queue Panel
// ═════════════════════════════════════════════════════════════════════

function QueuePanel({ tracks }: { tracks: Track[] }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-white uppercase tracking-widest">
          📜 Spotify Queue
        </h2>
        <span className="text-[10px] text-white/40 font-mono">{tracks.length}</span>
      </div>
      {tracks.length === 0 ? (
        <EmptyState text="Die Warteschlange ist leer." />
      ) : (
        <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {tracks.map((t, i) => (
            <li
              key={`${t.id}-${i}`}
              className="flex items-center gap-3 rounded-2xl bg-white/[0.03] border border-white/5 p-2"
            >
              <span className="w-5 text-center text-white/30 text-xs font-mono flex-shrink-0">
                {i + 1}
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
                <p className="text-white text-sm font-medium truncate">{t.title}</p>
                <p className="text-white/40 text-xs truncate">{t.artist}</p>
              </div>
              <span className="text-[10px] text-white/30 font-mono flex-shrink-0">
                {formatTime(t.duration_ms)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════
// AI Panel
// ═════════════════════════════════════════════════════════════════════

function AiPanel({
  suggestions,
  loading,
  error,
  hasNowPlaying,
  onAsk,
  onQueue,
  queueBusy
}: {
  suggestions: AiSuggestion[] | null;
  loading: boolean;
  error: string | null;
  hasNowPlaying: boolean;
  onAsk: () => void;
  onQueue: (t: { id: string; title: string }) => void;
  queueBusy: string | null;
}) {
  return (
    <section className="rounded-3xl border border-neon-purple/20 bg-gradient-to-br from-purple-950/30 via-zinc-950/60 to-black/60 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="text-xs font-bold text-white uppercase tracking-widest">
          🤖 AI DJ Assistant
        </h2>
        <button
          onClick={onAsk}
          disabled={loading || !hasNowPlaying}
          className="px-3 py-1.5 rounded-full bg-gradient-to-r from-neon-purple to-neon-pink text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
        >
          {loading ? "Denkt…" : "🪄 Fragen"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300 mb-2">
          {error}
        </div>
      )}

      {!hasNowPlaying && !suggestions && (
        <EmptyState text="Starte einen Song in Spotify, dann frag den Assistant nach passenden nächsten Tracks." />
      )}

      {hasNowPlaying && !suggestions && !loading && !error && (
        <EmptyState text="Klick auf '🪄 Fragen' für 5-8 KI-Vorschläge basierend auf dem aktuellen Track + Vibe." />
      )}

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <ul className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {suggestions.map((s) => (
            <li
              key={s.spotify_track_id}
              className="flex items-start gap-2 rounded-2xl border border-neon-purple/20 bg-white/[0.02] p-2 hover:border-neon-purple/40 transition"
            >
              {s.cover_url && (
                <Image
                  src={s.cover_url}
                  alt={s.album ?? s.title}
                  width={40}
                  height={40}
                  className="rounded-md flex-shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-semibold truncate">{s.title}</p>
                <p className="text-white/50 text-xs truncate">{s.artist}</p>
                <p className="text-neon-purple/80 text-[10px] italic mt-1 line-clamp-2">
                  💡 {s.reason}
                </p>
              </div>
              <button
                onClick={() => onQueue({ id: s.spotify_track_id, title: s.title })}
                disabled={queueBusy === s.spotify_track_id}
                className="flex-shrink-0 px-2 py-1 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-white text-[10px] font-bold disabled:opacity-50 transition"
              >
                {queueBusy === s.spotify_track_id ? "…" : "+ Queue"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {suggestions && suggestions.length === 0 && !loading && (
        <EmptyState text="Keine verwendbaren Vorschläge — versuch's nochmal." />
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════════

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-8 px-4">
      <p className="text-white/40 text-xs leading-relaxed">{text}</p>
    </div>
  );
}

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
