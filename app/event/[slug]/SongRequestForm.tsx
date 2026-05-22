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
}

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

export default function SongRequestForm({ eventId }: Props) {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [selected, setSelected] = useState<SpotifyTrack | null>(null);
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Wenn Track ausgewaehlt: Genres holen
  useEffect(() => {
    if (!selected) { setSelectedGenres(null); return; }
    let cancelled = false;
    fetch(`/api/spotify/track-genres?track_id=${selected.id}`, { cache: "no-store" })
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

    // Im Hintergrund: Service Worker + Push-Subscription anlegen.
    // Fehler ignorieren — Wunsch ist abgespeichert, Push ist nur Bonus.
    subscribeForEvent({ eventId, sessionId }).catch(() => {});

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
        <button
          onClick={() => {
            setSubmitted(false);
            setSelected(null);
            setQuery("");
            setTracks([]);
            setNickname("");
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
      {/* Suchfeld */}
      <div className="relative">
        <input
          type="text"
          placeholder="Song oder Künstler suchen…"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="w-full rounded-2xl bg-white/10 border border-white/20 px-5 py-4 text-white placeholder:text-white/40 focus:outline-none focus:border-neon-purple transition text-base"
        />
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
  if (vibePlayCount < 2) {
    return (
      <div className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/50">
        🎚 Vibe-Check: Noch zu wenige Songs gespielt — der Match-Score kommt sobald die Party läuft.
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
