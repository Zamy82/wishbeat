"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";

interface Track {
  id: string;
  title: string;
  artist: string;
  artist_id: string | null;
  album: string;
  cover_url: string | null;
  duration_ms: number;
  uri: string;
}

interface AudioFeatures {
  tempo: number;
  energy: number;
  valence: number;
  danceability: number;
  key: number;
  mode: number;
}

type NowPlayingResp =
  | { playing: true; progress_ms: number; track: Track; features: AudioFeatures | null }
  | { playing: false; reason: string };

type SuggestionsResp = {
  tracks: Track[];
  source: "recommendations" | "artist_top_tracks" | "related_artists" | null;
  reason?: string;
};

type Toast = { kind: "ok" | "err"; text: string } | null;

const KEY_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

export default function AssistantClient() {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingResp | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionsResp | null>(null);
  const [queueBusy, setQueueBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const lastTrackIdRef = useRef<string | null>(null);

  // Now-Playing pollen — alle 5 Sekunden
  const fetchNowPlaying = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/now-playing");
      const data: NowPlayingResp = await res.json();
      setNowPlaying(data);
      if (data.playing && data.track && data.track.id !== lastTrackIdRef.current) {
        lastTrackIdRef.current = data.track.id;
        // Wenn neuer Track läuft, neue Vorschläge holen
        fetchSuggestions(data.track, data.features);
      }
    } catch {}
  }, []);

  const fetchSuggestions = useCallback(
    async (track: Track, features: AudioFeatures | null) => {
      const params = new URLSearchParams({
        seed_track: track.id,
        exclude: track.id
      });
      if (track.artist_id) params.set("seed_artist", track.artist_id);
      if (features?.tempo) params.set("tempo", String(features.tempo));
      if (features?.energy != null) params.set("energy", String(features.energy));
      try {
        const res = await fetch(`/api/spotify/suggestions?${params.toString()}`);
        const data: SuggestionsResp = await res.json();
        setSuggestions(data);
      } catch {}
    },
    []
  );

  useEffect(() => {
    fetchNowPlaying();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchNowPlaying();
    }, 5000);
    return () => clearInterval(id);
  }, [fetchNowPlaying]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function queueTrack(track: Track) {
    setQueueBusy(track.id);
    try {
      const res = await fetch("/api/spotify/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotify_track_id: track.id })
      });
      const data = await res.json();
      setToast(
        data.ok
          ? { kind: "ok", text: `In Queue: ${track.title}` }
          : { kind: "err", text: data.message ?? "Queue-Fehler" }
      );
    } finally {
      setQueueBusy(null);
    }
  }

  const playing = nowPlaying?.playing === true && "track" in nowPlaying ? nowPlaying : null;
  const notPlayingReason =
    nowPlaying && !nowPlaying.playing ? (nowPlaying as { reason: string }).reason : null;

  return (
    <>
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-medium shadow-2xl border backdrop-blur ${
            toast.kind === "ok"
              ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40"
              : "bg-red-500/20 text-red-300 border-red-500/40"
          }`}
        >
          {toast.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Now Playing */}
        <section className="lg:col-span-2">
          <h2 className="text-xs uppercase tracking-widest text-white/40 mb-3">
            Jetzt läuft
          </h2>
          {!nowPlaying ? (
            <div className="rounded-3xl bg-white/5 border border-white/10 p-6 h-80 animate-pulse" />
          ) : !playing ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
              <div className="text-5xl mb-3">⏸️</div>
              <p className="text-white/70 font-medium">Spotify spielt gerade nichts</p>
              <p className="text-white/40 text-sm mt-2">
                {notPlayingReason === "nothing_playing"
                  ? "Starte einen Song in der Spotify-App, dann erscheinen hier Cover und Vorschläge."
                  : `Status: ${notPlayingReason ?? "unbekannt"}`}
              </p>
            </div>
          ) : (
            <NowPlayingCard playing={playing} />
          )}
        </section>

        {/* Suggestions */}
        <section className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-widest text-white/40">
              Vorschläge — passend zum aktuellen Song
            </h2>
            {suggestions?.source && (
              <span className="text-xs text-white/30">
                {sourceLabel(suggestions.source)}
              </span>
            )}
          </div>

          {!suggestions ? (
            <SuggestionSkeleton />
          ) : suggestions.tracks.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
              <p className="text-white/50 text-sm">
                Keine Vorschläge — Spotify gibt zu diesem Track gerade nichts zurück.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {suggestions.tracks.map((track) => (
                <li
                  key={track.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 hover:border-neon-purple/40 hover:bg-white/[0.07] transition"
                >
                  {track.cover_url && (
                    <Image
                      src={track.cover_url}
                      alt={track.album}
                      width={56}
                      height={56}
                      className="rounded-lg flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate text-sm">
                      {track.title}
                    </p>
                    <p className="text-white/50 text-xs truncate">{track.artist}</p>
                    <p className="text-white/30 text-xs mt-0.5">
                      {formatDuration(track.duration_ms)}
                    </p>
                  </div>
                  <button
                    onClick={() => queueTrack(track)}
                    disabled={queueBusy === track.id}
                    className="flex-shrink-0 px-3 py-2 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-wait transition"
                  >
                    {queueBusy === track.id ? "…" : "+ Queue"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function NowPlayingCard({
  playing
}: {
  playing: { progress_ms: number; track: Track; features: AudioFeatures | null };
}) {
  const { track, features, progress_ms } = playing;
  const progressPct = Math.min(100, (progress_ms / track.duration_ms) * 100);

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5">
      <div className="flex gap-4">
        {track.cover_url && (
          <Image
            src={track.cover_url}
            alt={track.album}
            width={120}
            height={120}
            className="rounded-2xl flex-shrink-0 shadow-2xl"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-lg leading-tight truncate">
            {track.title}
          </p>
          <p className="text-white/60 text-sm truncate mt-0.5">{track.artist}</p>
          <p className="text-white/30 text-xs truncate mt-0.5">{track.album}</p>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-neon-pink to-neon-purple transition-all duration-1000"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-white/40">
              <span>{formatDuration(progress_ms)}</span>
              <span>{formatDuration(track.duration_ms)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Audio Features */}
      {features ? (
        <div className="grid grid-cols-2 gap-2 mt-5">
          <FeaturePill
            label="BPM"
            value={String(features.tempo)}
            color="bg-neon-pink/15 text-neon-pink border-neon-pink/30"
          />
          <FeaturePill
            label="Energy"
            value={`${Math.round(features.energy * 100)}%`}
            color="bg-orange-400/15 text-orange-300 border-orange-400/30"
          />
          <FeaturePill
            label="Stimmung"
            value={moodLabel(features.valence)}
            color="bg-neon-cyan/15 text-neon-cyan border-neon-cyan/30"
          />
          <FeaturePill
            label="Tonart"
            value={`${KEY_NAMES[features.key] ?? "?"} ${features.mode === 1 ? "Dur" : "Moll"}`}
            color="bg-neon-purple/15 text-neon-purple border-neon-purple/30"
          />
        </div>
      ) : (
        <p className="mt-5 text-xs text-white/30 text-center">
          Audio-Features (BPM/Stimmung) für diesen Track nicht verfügbar
        </p>
      )}
    </div>
  );
}

function FeaturePill({
  label,
  value,
  color
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${color}`}>
      <div className="text-[10px] uppercase tracking-widest opacity-70">{label}</div>
      <div className="text-base font-bold">{value}</div>
    </div>
  );
}

function SuggestionSkeleton() {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="h-20 rounded-2xl border border-white/10 bg-white/5 animate-pulse"
        />
      ))}
    </ul>
  );
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function moodLabel(valence: number): string {
  if (valence < 0.25) return "Melancholisch";
  if (valence < 0.5) return "Ruhig";
  if (valence < 0.75) return "Positiv";
  return "Euphorisch";
}

function sourceLabel(source: string): string {
  if (source === "recommendations") return "🎯 BPM-passend";
  if (source === "artist_top_tracks") return "🎤 Vom gleichen Künstler";
  if (source === "related_artists") return "🔗 Ähnliche Künstler";
  return "";
}
