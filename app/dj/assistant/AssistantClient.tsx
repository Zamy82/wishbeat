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

interface NowPlayingTrack extends Track {
  release_year: number | null;
}

type NowPlayingResp =
  | { playing: true; progress_ms: number; track: NowPlayingTrack; features: null }
  | { playing: false; reason: string };

type SuggestionsResp = {
  tracks: Track[];
  source: "by_artist" | "by_query" | "by_era" | null;
  reason?: string;
};

type Toast = { kind: "ok" | "err"; text: string } | null;

const QUICK_GENRES = [
  { label: "🎤 Schlager", q: "schlager party hits" },
  { label: "🪩 80er", q: "80s hits party" },
  { label: "🎶 90er", q: "90s hits party" },
  { label: "💎 2000er", q: "2000s party hits" },
  { label: "🔥 Charts 2025", q: "top hits 2025" },
  { label: "🎧 House", q: "house party dance" },
  { label: "🎵 Hip-Hop", q: "hip hop party hits" },
  { label: "🍻 Mallorca", q: "ballermann hits" }
];

export default function AssistantClient() {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingResp | null>(null);
  const [nowPlayingFetchedAt, setNowPlayingFetchedAt] = useState<number>(Date.now());
  const [moreByArtist, setMoreByArtist] = useState<SuggestionsResp | null>(null);
  const [moreByArtistLoading, setMoreByArtistLoading] = useState(false);
  const [eraSuggestions, setEraSuggestions] = useState<SuggestionsResp | null>(null);
  const [eraLoading, setEraLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [queueBusy, setQueueBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const lastTrackIdRef = useRef<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestionsForTrack = useCallback(async (track: NowPlayingTrack) => {
    const firstArtist = track.artist.split(",")[0]?.trim() ?? "";

    setMoreByArtistLoading(true);
    if (track.release_year) setEraLoading(true);

    const artistParams = new URLSearchParams({ exclude: track.id });
    if (firstArtist) artistParams.set("artist_name", firstArtist);

    const eraParams = new URLSearchParams({ exclude: track.id });
    if (track.release_year) eraParams.set("year", String(track.release_year));
    if (firstArtist) eraParams.set("exclude_artist", firstArtist);

    const [artistRes, eraRes] = await Promise.all([
      fetch(`/api/spotify/suggestions?${artistParams.toString()}`)
        .then((r) => r.json())
        .catch(() => null),
      track.release_year
        ? fetch(`/api/spotify/suggestions?${eraParams.toString()}`)
            .then((r) => r.json())
            .catch(() => null)
        : Promise.resolve(null)
    ]);

    setMoreByArtist(artistRes ?? { tracks: [], source: null });
    setMoreByArtistLoading(false);
    if (track.release_year) {
      setEraSuggestions(eraRes ?? { tracks: [], source: null });
      setEraLoading(false);
    }
  }, []);

  const fetchNowPlaying = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/now-playing");
      const data: NowPlayingResp = await res.json();
      setNowPlaying(data);
      setNowPlayingFetchedAt(Date.now());
      if (data.playing && data.track.id !== lastTrackIdRef.current) {
        lastTrackIdRef.current = data.track.id;
        fetchSuggestionsForTrack(data.track);
      }
    } catch {}
  }, [fetchSuggestionsForTrack]);

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

  async function runSearch(q: string, randomize = false) {
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      // Bei Quick-Genre-Klicks: zufaelliger Offset (0-180), damit andere Songs
      // erscheinen. Spotify-Search ist sonst deterministisch.
      const offset = randomize ? Math.floor(Math.random() * 180) : 0;
      const res = await fetch(
        `/api/spotify/search?q=${encodeURIComponent(q)}&offset=${offset}`
      );
      const data = await res.json();
      setSearchResults(data.tracks ?? []);
    } finally {
      setSearching(false);
    }
  }

  function onSearchChange(v: string) {
    setSearchQuery(v);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => runSearch(v, false), 350);
  }

  function applyQuickGenre(q: string) {
    setSearchQuery(q);
    runSearch(q, true);
  }

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

  async function playNextTrack(track: Track) {
    setQueueBusy(track.id);
    try {
      const res = await fetch("/api/spotify/play-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotify_track_id: track.id })
      });
      const data = await res.json();
      const okText =
        data.mode === "queued_fallback"
          ? `In Queue (am Ende): ${track.title}`
          : `🔝 Als nächster: ${track.title}`;
      setToast(
        data.ok
          ? { kind: "ok", text: okText }
          : { kind: "err", text: data.message ?? "Konnte Track nicht platzieren" }
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Now Playing */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-white/40 mb-3">
            Jetzt läuft
          </h2>
          {!nowPlaying ? (
            <div className="rounded-3xl bg-white/5 border border-white/10 p-6 h-44 animate-pulse" />
          ) : !playing ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center h-44 flex flex-col justify-center">
              <div className="text-4xl mb-2">⏸️</div>
              <p className="text-white/70 font-medium">Spotify spielt gerade nichts</p>
              <p className="text-white/40 text-xs mt-1">
                {notPlayingReason === "nothing_playing"
                  ? "Starte einen Song in Spotify"
                  : `Status: ${notPlayingReason ?? "unbekannt"}`}
              </p>
            </div>
          ) : (
            <NowPlayingCard playing={playing} fetchedAt={nowPlayingFetchedAt} />
          )}
        </section>

        {/* Mehr vom Künstler */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-white/40 mb-3">
            {playing
              ? `Mehr von ${playing.track.artist.split(",")[0]}`
              : "Mehr vom Künstler"}
          </h2>
          {!playing ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center h-44 flex items-center justify-center">
              <p className="text-white/40 text-sm">
                Wenn Spotify spielt, erscheinen hier Songs vom gleichen Künstler.
              </p>
            </div>
          ) : moreByArtistLoading ? (
            <div className="rounded-3xl bg-white/5 border border-white/10 p-6 h-44 animate-pulse" />
          ) : !moreByArtist || moreByArtist.tracks.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center h-44 flex items-center justify-center">
              <p className="text-white/40 text-sm">
                Wenig Tracks von {playing.track.artist.split(",")[0]} verfügbar. Nutz unten die Suche oder Era-Vorschläge.
              </p>
            </div>
          ) : (
            <TrackList
              tracks={moreByArtist.tracks.slice(0, 5)}
              onQueue={queueTrack}
              onPlayNext={playNextTrack}
              queueBusy={queueBusy}
            />
          )}
        </section>
      </div>

      {/* Aus der gleichen Era — passende Songs aus dem Release-Jahr */}
      {playing && playing.track.release_year && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-widest text-white/40 mb-3 flex items-center gap-2">
            <span className="text-base">🎶</span>
            Passende Songs aus {playing.track.release_year - 1}–{playing.track.release_year + 1}
            <span className="text-white/30 normal-case tracking-normal font-normal">
              (gleiche Era wie „{playing.track.title}")
            </span>
          </h2>

          {eraLoading ? (
            <div className="rounded-3xl bg-white/5 border border-white/10 p-6 animate-pulse">
              <div className="h-16 bg-white/5 rounded-xl" />
            </div>
          ) : !eraSuggestions || eraSuggestions.tracks.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
              <p className="text-white/40 text-sm">
                Keine Era-Treffer für {playing.track.release_year}. Probier die Quick-Genre-Buttons unten.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {eraSuggestions.tracks.map((track) => (
                <li
                  key={track.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 hover:border-neon-purple/40 hover:bg-white/[0.07] p-3 transition"
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
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate text-sm">
                      {track.title}
                    </p>
                    <p className="text-white/50 text-xs truncate">{track.artist}</p>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => queueTrack(track)}
                      disabled={queueBusy === track.id}
                      className="px-3 py-1 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-wait transition"
                    >
                      {queueBusy === track.id ? "…" : "+ Queue"}
                    </button>
                    <button
                      onClick={() => playNextTrack(track)}
                      disabled={queueBusy === track.id}
                      className="px-3 py-1 rounded-full bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-wait transition"
                      title="Als nächster Song nach dem aktuellen platzieren (Platz 1 in der Queue)"
                    >
                      🔝 #1 in Queue
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Suche */}
      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-widest text-white/40 mb-3">
          Song suchen & in Queue schieben
        </h2>

        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_GENRES.map((g) => (
            <button
              key={g.q}
              onClick={() => applyQuickGenre(g.q)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10 hover:border-neon-purple/40 text-white/70 hover:text-white transition"
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="relative mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Titel, Künstler oder Album…"
            className="w-full rounded-2xl bg-white/10 border border-white/20 px-5 py-4 text-white placeholder:text-white/40 focus:outline-none focus:border-neon-purple transition"
          />
          {searching && (
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 text-sm">
              …
            </span>
          )}
        </div>

        {searchResults.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {searchResults.map((track) => (
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
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => queueTrack(track)}
                    disabled={queueBusy === track.id}
                    className="px-3 py-1.5 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-wait transition"
                  >
                    {queueBusy === track.id ? "…" : "+ Queue"}
                  </button>
                  <button
                    onClick={() => playNextTrack(track)}
                    disabled={queueBusy === track.id}
                    className="px-3 py-1.5 rounded-full bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-wait transition"
                    title="Als nächster Song nach dem aktuellen platzieren (Platz 1 in der Queue)"
                  >
                    🔝 #1 in Queue
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
          <p className="text-white/40 text-sm text-center py-6">Keine Treffer</p>
        )}
      </section>
    </>
  );
}

function NowPlayingCard({
  playing,
  fetchedAt
}: {
  playing: { progress_ms: number; track: NowPlayingTrack };
  fetchedAt: number;
}) {
  const { track, progress_ms } = playing;

  // Lokale Interpolation: zwischen den 5-Sekunden-Polls laesst sich der
  // Fortschritt weich animieren basierend auf der verstrichenen Zeit seit dem
  // letzten Server-Fetch.
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const elapsedSinceFetch = Math.max(0, tick - fetchedAt);
  const displayedProgress = Math.min(
    progress_ms + elapsedSinceFetch,
    track.duration_ms
  );
  const progressPct = Math.min(100, (displayedProgress / track.duration_ms) * 100);

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
          <p className="text-white/30 text-xs truncate mt-0.5">
            {track.album}
            {track.release_year ? ` · ${track.release_year}` : ""}
          </p>

          <div className="mt-4">
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-neon-pink to-neon-purple"
                style={{ width: `${progressPct}%`, transition: "width 250ms linear" }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-white/40">
              <span>{formatDuration(displayedProgress)}</span>
              <span>{formatDuration(track.duration_ms)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackList({
  tracks,
  onQueue,
  onPlayNext,
  queueBusy
}: {
  tracks: Track[];
  onQueue: (t: Track) => void;
  onPlayNext: (t: Track) => void;
  queueBusy: string | null;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {tracks.map((track) => (
        <li
          key={track.id}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 hover:border-neon-purple/40 transition"
        >
          {track.cover_url && (
            <Image
              src={track.cover_url}
              alt={track.album}
              width={44}
              height={44}
              className="rounded-lg flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate text-sm">{track.title}</p>
            <p className="text-white/50 text-xs truncate">{track.album}</p>
          </div>
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button
              onClick={() => onQueue(track)}
              disabled={queueBusy === track.id}
              className="px-3 py-1 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-wait transition"
            >
              {queueBusy === track.id ? "…" : "+ Queue"}
            </button>
            <button
              onClick={() => onPlayNext(track)}
              disabled={queueBusy === track.id}
              className="px-3 py-1 rounded-full bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-wait transition"
              title="Als nächster Song nach dem aktuellen platzieren (Platz 1 in der Queue)"
            >
              🔝 #1 in Queue
            </button>
          </div>
        </li>
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
