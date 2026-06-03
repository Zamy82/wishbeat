"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { SongRequest, EventPlay } from "@/lib/types";

interface Props {
  eventId: string;
  initialRequests: SongRequest[];
  initialPlays: EventPlay[];
}

interface TrackStat {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  plays: number;
  fromWish: number;
  latestPlayedAt: string;
}

interface ArtistStat {
  name: string;
  plays: number;
}

interface PulseStat {
  trackId: string;
  title: string;
  artist: string;
  cover_url: string | null;
  fire: number;
  dance: number;
  meh: number;
  total: number;
  score: number;
}

type Reaction = "fire" | "dance" | "meh";
interface ReactionRow {
  spotify_track_id: string;
  reaction: Reaction;
}

export default function StatsPanel({
  eventId,
  initialRequests,
  initialPlays
}: Props) {
  const [tab, setTab] = useState<"songs" | "pulse">("songs");
  const [requests, setRequests] = useState<SongRequest[]>(initialRequests);
  const [plays, setPlays] = useState<EventPlay[]>(initialPlays);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);

  // Realtime + Polling-Fallback für plays UND requests UND reactions
  useEffect(() => {
    const supabase = createClient();

    async function refetchAll() {
      const [{ data: r }, { data: p }, { data: rx }] = await Promise.all([
        supabase
          .from("song_requests")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
        supabase
          .from("event_plays")
          .select("*")
          .eq("event_id", eventId)
          .order("played_at", { ascending: true }),
        supabase
          .from("song_reactions")
          .select("spotify_track_id, reaction")
          .eq("event_id", eventId)
      ]);
      if (r) setRequests(r as SongRequest[]);
      if (p) setPlays(p as EventPlay[]);
      if (rx) setReactions(rx as ReactionRow[]);
    }

    refetchAll();

    const pollId = setInterval(() => {
      if (document.visibilityState === "visible") refetchAll();
    }, 8000);

    const channelName = `stats-${eventId}-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "song_requests",
          filter: `event_id=eq.${eventId}`
        },
        () => refetchAll()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_plays",
          filter: `event_id=eq.${eventId}`
        },
        () => refetchAll()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "song_reactions",
          filter: `event_id=eq.${eventId}`
        },
        () => refetchAll()
      )
      .subscribe();

    return () => {
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const stats = useMemo(() => calculateStats(plays, requests), [plays, requests]);
  const pulseStats = useMemo(
    () => calculatePulseStats(reactions, plays, requests),
    [reactions, plays, requests]
  );

  if (plays.length === 0 && requests.length === 0 && reactions.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-white/40 text-sm">
          Noch keine Daten. Sobald Songs gespielt werden oder Wünsche eingehen,
          erscheint hier die Statistik.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tab-Switcher */}
      <div className="flex gap-1 p-1 rounded-2xl bg-white/5 border border-white/10 w-fit">
        <button
          type="button"
          onClick={() => setTab("songs")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            tab === "songs"
              ? "bg-gradient-to-r from-neon-purple/40 to-neon-pink/40 text-white shadow"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          📊 Songs
        </button>
        <button
          type="button"
          onClick={() => setTab("pulse")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            tab === "pulse"
              ? "bg-gradient-to-r from-neon-pink/40 to-orange-500/40 text-white shadow"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          🎚 Crowd-Pulse
        </button>
      </div>

      {tab === "songs" ? (
        <SongsTab stats={stats} />
      ) : (
        <PulseTab pulseStats={pulseStats} />
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────
   Tab: Songs (bisheriger Inhalt)
   ─────────────────────────────────────────────────────────── */
function SongsTab({ stats }: { stats: Stats }) {
  return (
    <>
      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Songs gespielt"
          value={stats.totalPlays}
          accent="text-neon-cyan"
          subline={`${stats.uniqueTracks} eindeutig`}
        />
        <KpiCard
          label="Wünsche"
          value={stats.totalRequests}
          accent="text-neon-pink"
          subline={`${stats.wishesPlayed} erfüllt`}
        />
        <KpiCard
          label="Annahmequote"
          value={`${stats.acceptanceRate}%`}
          accent="text-neon-purple"
        />
        <KpiCard
          label="Wunsch-Anteil"
          value={`${stats.wishShare}%`}
          accent="text-yellow-400"
          subline="der gespielten Songs"
        />
      </div>

      {/* Song des Abends */}
      {stats.topTrack && (
        <div className="rounded-3xl border border-yellow-400/30 bg-gradient-to-br from-yellow-400/10 to-amber-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🏆</span>
            <span className="text-xs uppercase tracking-widest text-yellow-300 font-bold">
              Song des Abends
            </span>
          </div>
          <div className="flex items-center gap-4">
            {stats.topTrack.cover_url && (
              <Image
                src={stats.topTrack.cover_url}
                alt={stats.topTrack.title}
                width={80}
                height={80}
                className="rounded-2xl shadow-2xl flex-shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-white font-bold text-lg truncate">
                {stats.topTrack.title}
              </p>
              <p className="text-white/70 text-sm truncate">{stats.topTrack.artist}</p>
              <p className="text-yellow-300 text-sm mt-1 font-semibold">
                {stats.topTrack.plays}× gespielt
                {stats.topTrack.fromWish > 0 && ` · ${stats.topTrack.fromWish}× aus Wunsch`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Songs + Top Künstler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Songs nach Plays */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-xs uppercase tracking-widest text-white/40 font-semibold mb-3">
            Meist gespielte Songs
          </h3>
          {stats.topTracks.length === 0 ? (
            <p className="text-white/40 text-sm">Noch keine Daten</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {stats.topTracks.map((t, i) => (
                <li key={t.id} className="flex items-center gap-3">
                  <span className="text-white/30 text-xs font-bold w-4">
                    {i + 1}
                  </span>
                  {t.cover_url && (
                    <Image
                      src={t.cover_url}
                      alt={t.title}
                      width={36}
                      height={36}
                      className="rounded-md flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-semibold truncate">
                      {t.title}
                    </p>
                    <p className="text-white/40 text-xs truncate">
                      {t.artist}
                      {t.fromWish > 0 && (
                        <span className="text-neon-pink/80 ml-1">
                          · {t.fromWish}× Wunsch
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-neon-cyan text-sm font-bold flex-shrink-0">
                    {t.plays}×
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Top Künstler */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-xs uppercase tracking-widest text-white/40 font-semibold mb-3">
            Top Künstler
          </h3>
          {stats.topArtists.length === 0 ? (
            <p className="text-white/40 text-sm">Noch keine Daten</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {stats.topArtists.map((a, i) => (
                <li key={a.name} className="flex items-center gap-3">
                  <span className="text-white/30 text-xs font-bold w-4">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-semibold truncate">
                      {a.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-neon-pink to-neon-purple"
                        style={{
                          width: `${
                            stats.topArtists[0]
                              ? (a.plays / stats.topArtists[0].plays) * 100
                              : 0
                          }%`
                        }}
                      />
                    </div>
                    <span className="text-neon-pink text-sm font-bold">
                      {a.plays}×
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Wunsch-Status-Verteilung */}
      {stats.totalRequests > 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-xs uppercase tracking-widest text-white/40 font-semibold mb-3">
            Wunsch-Status
          </h3>
          <div className="flex h-3 rounded-full overflow-hidden bg-white/5 mb-3">
            {stats.played > 0 && (
              <div
                className="bg-neon-cyan/80"
                style={{ width: `${(stats.played / stats.totalRequests) * 100}%` }}
              />
            )}
            {stats.approved > 0 && (
              <div
                className="bg-neon-purple/80"
                style={{ width: `${(stats.approved / stats.totalRequests) * 100}%` }}
              />
            )}
            {stats.pending > 0 && (
              <div
                className="bg-yellow-400/80"
                style={{ width: `${(stats.pending / stats.totalRequests) * 100}%` }}
              />
            )}
            {stats.rejected > 0 && (
              <div
                className="bg-red-500/70"
                style={{ width: `${(stats.rejected / stats.totalRequests) * 100}%` }}
              />
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <StatusItem color="bg-neon-cyan/80" label="Gespielt" count={stats.played} />
            <StatusItem color="bg-neon-purple/80" label="In Queue" count={stats.approved} />
            <StatusItem color="bg-yellow-400/80" label="Offen" count={stats.pending} />
            <StatusItem color="bg-red-500/70" label="Abgelehnt" count={stats.rejected} />
          </div>
        </div>
      )}
    </>
  );
}

/* ───────────────────────────────────────────────────────────
   Tab: Crowd-Pulse — Aggregat aller Reactions pro Song
   ─────────────────────────────────────────────────────────── */
function PulseTab({ pulseStats }: { pulseStats: PulseStat[] }) {
  if (pulseStats.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <div className="text-3xl mb-2">🎚</div>
        <p className="text-white/60 text-sm">
          Noch keine Reaktionen.
        </p>
        <p className="text-white/40 text-xs mt-2">
          Sobald Gäste auf 🔥 / 💃 / 😴 tippen, siehst du hier ihre Stimmung
          pro Song — sortiert nach Crowd-Pulse-Score.
        </p>
      </div>
    );
  }

  const totals = pulseStats.reduce(
    (acc, s) => ({
      fire: acc.fire + s.fire,
      dance: acc.dance + s.dance,
      meh: acc.meh + s.meh,
      reactions: acc.reactions + s.total
    }),
    { fire: 0, dance: 0, meh: 0, reactions: 0 }
  );

  const hottest = pulseStats[0];
  const tanzflaeche = [...pulseStats].sort((a, b) => b.dance - a.dance)[0];

  return (
    <>
      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Reaktionen total"
          value={totals.reactions}
          accent="text-neon-pink"
          subline={`über ${pulseStats.length} ${pulseStats.length === 1 ? "Song" : "Songs"}`}
        />
        <KpiCard
          label="🔥 Feuer"
          value={totals.fire}
          accent="text-orange-300"
        />
        <KpiCard
          label="💃 Tanze"
          value={totals.dance}
          accent="text-neon-pink"
        />
        <KpiCard
          label="😴 Wechsel"
          value={totals.meh}
          accent="text-white/60"
        />
      </div>

      {/* Heißester Song + Tanzflächen-Killer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PulseHero
          icon="🔥"
          title="Heißester Song"
          subtitle={`Score ${hottest.score}%`}
          variant="fire"
          track={hottest}
        />
        {tanzflaeche && tanzflaeche.dance > 0 && (
          <PulseHero
            icon="💃"
            title="Tanzflächen-Killer"
            subtitle={`${tanzflaeche.dance}× getanzt`}
            variant="dance"
            track={tanzflaeche}
          />
        )}
      </div>

      {/* Vollständige Liste */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-xs uppercase tracking-widest text-white/40 font-semibold mb-3">
          Alle Songs nach Crowd-Pulse
        </h3>
        <ol className="flex flex-col gap-3">
          {pulseStats.map((p, i) => (
            <li
              key={p.trackId}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-2.5"
            >
              <span className="text-white/30 text-xs font-bold w-5 text-center">
                {i + 1}
              </span>
              {p.cover_url && (
                <Image
                  src={p.cover_url}
                  alt={p.title}
                  width={40}
                  height={40}
                  className="rounded-lg flex-shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-semibold truncate">
                  {p.title}
                </p>
                <p className="text-white/40 text-xs truncate">{p.artist}</p>
                <div className="flex items-center gap-2 mt-1">
                  <ReactionPill emoji="🔥" count={p.fire} color="text-orange-300" />
                  <ReactionPill emoji="💃" count={p.dance} color="text-neon-pink" />
                  <ReactionPill emoji="😴" count={p.meh} color="text-white/50" />
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0 min-w-[56px]">
                <span
                  className={`text-lg font-black ${scoreColor(p.score)}`}
                >
                  {p.score}%
                </span>
                <span className="text-[10px] text-white/40 uppercase tracking-wider">
                  Score
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="text-white/30 text-[11px] text-center -mt-2">
        Score = (🔥 + 1,5×💃) ÷ (🔥 + 💃 + 0,5×😴) × 100
      </p>
    </>
  );
}

function scoreColor(score: number): string {
  if (score >= 90) return "text-orange-300";
  if (score >= 75) return "text-neon-pink";
  if (score >= 50) return "text-yellow-300";
  if (score >= 30) return "text-white/70";
  return "text-cyan-300";
}

function ReactionPill({
  emoji,
  count,
  color
}: {
  emoji: string;
  count: number;
  color: string;
}) {
  if (count === 0) return null;
  return (
    <span className={`text-[11px] font-mono ${color}`}>
      {emoji} {count}
    </span>
  );
}

function PulseHero({
  icon,
  title,
  subtitle,
  variant,
  track
}: {
  icon: string;
  title: string;
  subtitle: string;
  variant: "fire" | "dance";
  track: PulseStat;
}) {
  // Statische Klassen-Kombis, damit Tailwind sie beim Build erkennt
  const wrapClass =
    variant === "fire"
      ? "rounded-3xl border border-orange-400/30 bg-gradient-to-br from-orange-500/15 to-neon-pink/5 p-5"
      : "rounded-3xl border border-neon-pink/30 bg-gradient-to-br from-neon-pink/15 to-neon-purple/5 p-5";
  const accentClass =
    variant === "fire" ? "text-orange-300" : "text-neon-pink";

  return (
    <div className={wrapClass}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <span className={`text-xs uppercase tracking-widest font-bold ${accentClass}`}>
          {title}
        </span>
      </div>
      <div className="flex items-center gap-4">
        {track.cover_url && (
          <Image
            src={track.cover_url}
            alt={track.title}
            width={64}
            height={64}
            className="rounded-2xl shadow-xl flex-shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-white font-bold truncate">{track.title}</p>
          <p className="text-white/60 text-sm truncate">{track.artist}</p>
          <p className={`text-sm mt-1 font-semibold ${accentClass}`}>{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  subline,
  accent
}: {
  label: string;
  value: number | string;
  subline?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-widest text-white/40 font-semibold mb-1.5">
        {label}
      </p>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      {subline && <p className="text-white/40 text-xs mt-0.5">{subline}</p>}
    </div>
  );
}

function StatusItem({
  color,
  label,
  count
}: {
  color: string;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-white/70">{label}</span>
      <span className="text-white/50 ml-auto">{count}</span>
    </div>
  );
}

interface Stats {
  totalPlays: number;
  uniqueTracks: number;
  totalRequests: number;
  wishesPlayed: number;
  wishShare: number;
  acceptanceRate: number;
  played: number;
  approved: number;
  pending: number;
  rejected: number;
  topTrack: TrackStat | null;
  topTracks: TrackStat[];
  topArtists: ArtistStat[];
}

// Songtitel normalisieren — Klammern, Suffixe wie "- Single Version", "- Remix",
// "feat. XYZ" wegwerfen. So zaehlen "Baby" und "Baby - Album Version" als
// selber Song.
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*[([].*?[)\]]\s*/g, " ")
    .replace(/\s*-\s*(single|radio|album|extended|remix|version|edit|live|remastered|deluxe|mono|stereo|club\s*mix|mix)\b.*$/gi, "")
    .replace(/\s+(feat\.?|ft\.?|featuring)\s+.*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Erster/primaerer Kuenstler, normalisiert
function normalizeArtist(artist: string): string {
  const primary = artist.split(/[,&]|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b/i)[0] ?? "";
  return primary.toLowerCase().trim();
}

// Plays mit gleichem Titel/Kuenstler innerhalb 15 Min werden als 1 Play
// gezaehlt — verhindert dass verschiedene Spotify-Track-IDs derselben Songs
// (Album, Single, Remix etc.) doppelt gezaehlt werden.
const STATS_DEDUP_WINDOW_MS = 15 * 60 * 1000;

function calculateStats(plays: EventPlay[], requests: SongRequest[]): Stats {
  // Sortiere chronologisch + filtere nahe Duplikate
  const sorted = [...plays].sort((a, b) => a.played_at.localeCompare(b.played_at));
  const seenByKey = new Map<string, number>();
  const dedupedPlays: EventPlay[] = [];
  for (const p of sorted) {
    const key = `${normalizeTitle(p.title)}|${normalizeArtist(p.artist)}`;
    const t = new Date(p.played_at).getTime();
    const last = seenByKey.get(key);
    if (last !== undefined && t - last < STATS_DEDUP_WINDOW_MS) {
      continue;
    }
    seenByKey.set(key, t);
    dedupedPlays.push(p);
  }

  // Plays gruppieren — Key ist normalisierter Titel+Kuenstler
  const trackMap = new Map<string, TrackStat>();
  for (const p of dedupedPlays) {
    const key = `${normalizeTitle(p.title)}|${normalizeArtist(p.artist)}`;
    const existing = trackMap.get(key);
    if (existing) {
      existing.plays++;
      if (p.source === "wish") existing.fromWish++;
      if (p.played_at > existing.latestPlayedAt) {
        existing.latestPlayedAt = p.played_at;
      }
      if (!existing.cover_url && p.cover_url) {
        existing.cover_url = p.cover_url;
      }
    } else {
      trackMap.set(key, {
        id: p.spotify_track_id,
        title: p.title,
        artist: p.artist,
        cover_url: p.cover_url,
        plays: 1,
        fromWish: p.source === "wish" ? 1 : 0,
        latestPlayedAt: p.played_at
      });
    }
  }

  const allTracks = Array.from(trackMap.values()).sort((a, b) => {
    if (b.plays !== a.plays) return b.plays - a.plays;
    return b.latestPlayedAt.localeCompare(a.latestPlayedAt);
  });

  const artistMap = new Map<string, { name: string; plays: number }>();
  for (const p of dedupedPlays) {
    const primary = p.artist.split(/[,&]|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b/i)[0]?.trim();
    if (!primary) continue;
    const normKey = primary.toLowerCase();
    const existing = artistMap.get(normKey);
    if (existing) {
      existing.plays++;
    } else {
      artistMap.set(normKey, { name: primary, plays: 1 });
    }
  }
  const topArtists = Array.from(artistMap.values())
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 5);

  const totalRequests = requests.length;
  const played = requests.filter((r) => r.status === "played").length;
  const approved = requests.filter((r) => r.status === "approved").length;
  const pending = requests.filter((r) => r.status === "pending").length;
  const rejected = requests.filter((r) => r.status === "rejected").length;
  const acceptanceRate =
    totalRequests > 0
      ? Math.round(((approved + played) / totalRequests) * 100)
      : 0;
  const wishesPlayed = dedupedPlays.filter((p) => p.source === "wish").length;
  const wishShare =
    dedupedPlays.length > 0 ? Math.round((wishesPlayed / dedupedPlays.length) * 100) : 0;

  return {
    totalPlays: dedupedPlays.length,
    uniqueTracks: trackMap.size,
    totalRequests,
    wishesPlayed,
    wishShare,
    acceptanceRate,
    played,
    approved,
    pending,
    rejected,
    topTrack: allTracks[0] ?? null,
    topTracks: allTracks.slice(0, 5),
    topArtists
  };
}

// Aggregiere Reactions pro spotify_track_id, hole Metadaten aus Plays/Requests,
// berechne Score und sortiere.
function calculatePulseStats(
  reactions: ReactionRow[],
  plays: EventPlay[],
  requests: SongRequest[]
): PulseStat[] {
  if (reactions.length === 0) return [];

  // 1) Reactions zaehlen pro Track-ID
  const counts = new Map<string, { fire: number; dance: number; meh: number }>();
  for (const r of reactions) {
    const c = counts.get(r.spotify_track_id) ?? { fire: 0, dance: 0, meh: 0 };
    if (r.reaction === "fire") c.fire++;
    else if (r.reaction === "dance") c.dance++;
    else if (r.reaction === "meh") c.meh++;
    counts.set(r.spotify_track_id, c);
  }

  // 2) Metadaten-Lookup aus Plays (primaer) + Requests (Fallback)
  const meta = new Map<
    string,
    { title: string; artist: string; cover_url: string | null }
  >();
  for (const p of plays) {
    if (!meta.has(p.spotify_track_id)) {
      meta.set(p.spotify_track_id, {
        title: p.title,
        artist: p.artist,
        cover_url: p.cover_url
      });
    }
  }
  for (const r of requests) {
    if (!meta.has(r.spotify_track_id)) {
      meta.set(r.spotify_track_id, {
        title: r.title,
        artist: r.artist,
        cover_url: r.cover_url
      });
    }
  }

  // 3) PulseStats zusammenstellen + Score berechnen
  const result: PulseStat[] = [];
  for (const [trackId, c] of counts.entries()) {
    const m = meta.get(trackId);
    const total = c.fire + c.dance + c.meh;
    if (total === 0) continue;
    const num = c.fire + 1.5 * c.dance;
    const den = c.fire + c.dance + 0.5 * c.meh;
    const score = den > 0 ? Math.min(100, Math.round((num / den) * 100)) : 0;
    result.push({
      trackId,
      title: m?.title ?? "Unbekannter Track",
      artist: m?.artist ?? "—",
      cover_url: m?.cover_url ?? null,
      fire: c.fire,
      dance: c.dance,
      meh: c.meh,
      total,
      score
    });
  }

  // 4) Sortieren: erst nach Score, dann nach total
  result.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.total - a.total;
  });

  return result;
}
