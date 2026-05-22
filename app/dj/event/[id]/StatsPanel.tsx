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

export default function StatsPanel({
  eventId,
  initialRequests,
  initialPlays
}: Props) {
  const [requests, setRequests] = useState<SongRequest[]>(initialRequests);
  const [plays, setPlays] = useState<EventPlay[]>(initialPlays);

  // Realtime + Polling-Fallback für plays UND requests
  useEffect(() => {
    const supabase = createClient();

    async function refetchAll() {
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase
          .from("song_requests")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
        supabase
          .from("event_plays")
          .select("*")
          .eq("event_id", eventId)
          .order("played_at", { ascending: true })
      ]);
      if (r) setRequests(r as SongRequest[]);
      if (p) setPlays(p as EventPlay[]);
    }

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
      .subscribe();

    return () => {
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const stats = useMemo(() => calculateStats(plays, requests), [plays, requests]);

  if (plays.length === 0 && requests.length === 0) {
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

function calculateStats(plays: EventPlay[], requests: SongRequest[]): Stats {
  // Plays gruppieren nach Track
  const trackMap = new Map<string, TrackStat>();
  for (const p of plays) {
    const existing = trackMap.get(p.spotify_track_id);
    if (existing) {
      existing.plays++;
      if (p.source === "wish") existing.fromWish++;
      if (p.played_at > existing.latestPlayedAt) {
        existing.latestPlayedAt = p.played_at;
      }
    } else {
      trackMap.set(p.spotify_track_id, {
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

  // Top Artists
  const artistMap = new Map<string, number>();
  for (const p of plays) {
    const primary = p.artist.split(",")[0]?.trim();
    if (!primary) continue;
    artistMap.set(primary, (artistMap.get(primary) ?? 0) + 1);
  }
  const topArtists = Array.from(artistMap.entries())
    .map(([name, plays]) => ({ name, plays }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 5);

  // Wunsch-Stats
  const totalRequests = requests.length;
  const played = requests.filter((r) => r.status === "played").length;
  const approved = requests.filter((r) => r.status === "approved").length;
  const pending = requests.filter((r) => r.status === "pending").length;
  const rejected = requests.filter((r) => r.status === "rejected").length;
  const acceptanceRate =
    totalRequests > 0
      ? Math.round(((approved + played) / totalRequests) * 100)
      : 0;
  const wishesPlayed = plays.filter((p) => p.source === "wish").length;
  const wishShare =
    plays.length > 0 ? Math.round((wishesPlayed / plays.length) * 100) : 0;

  return {
    totalPlays: plays.length,
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
