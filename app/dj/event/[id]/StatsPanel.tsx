"use client";

import { useMemo } from "react";
import Image from "next/image";
import type { SongRequest } from "@/lib/types";

interface Props {
  requests: SongRequest[];
}

interface TrackStat {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  count: number;
  played: number;
}

interface ArtistStat {
  name: string;
  count: number;
}

export default function StatsPanel({ requests }: Props) {
  const stats = useMemo(() => calculateStats(requests), [requests]);

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-white/40 text-sm">
          Noch keine Daten. Sobald Gäste Wünsche schicken, erscheint hier die
          Statistik.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Wünsche total"
          value={stats.total}
          accent="text-white"
        />
        <KpiCard
          label="Angenommen"
          value={stats.approved + stats.played}
          accent="text-neon-cyan"
          subline={`davon ${stats.played} gespielt`}
        />
        <KpiCard
          label="Annahmequote"
          value={`${stats.acceptanceRate}%`}
          accent="text-neon-pink"
        />
        <KpiCard
          label="Eindeutige Songs"
          value={stats.uniqueTracks}
          accent="text-neon-purple"
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
              <p className="text-white/70 text-sm truncate">
                {stats.topTrack.artist}
              </p>
              <p className="text-yellow-300 text-sm mt-1 font-semibold">
                {stats.topTrack.count}× gewünscht
                {stats.topTrack.played > 0 && ` · ${stats.topTrack.played}× gespielt`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Songs + Top Künstler nebeneinander */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Songs */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-xs uppercase tracking-widest text-white/40 font-semibold mb-3">
            Top Songs
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
                    <p className="text-white/40 text-xs truncate">{t.artist}</p>
                  </div>
                  <span className="text-neon-cyan text-sm font-bold flex-shrink-0">
                    {t.count}×
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
                              ? (a.count / stats.topArtists[0].count) * 100
                              : 0
                          }%`
                        }}
                      />
                    </div>
                    <span className="text-neon-pink text-sm font-bold">
                      {a.count}×
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Status-Verteilung */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-xs uppercase tracking-widest text-white/40 font-semibold mb-3">
          Status-Verteilung
        </h3>
        <div className="flex h-3 rounded-full overflow-hidden bg-white/5 mb-3">
          {stats.played > 0 && (
            <div
              className="bg-neon-cyan/80"
              style={{ width: `${(stats.played / stats.total) * 100}%` }}
              title={`${stats.played} gespielt`}
            />
          )}
          {stats.approved > 0 && (
            <div
              className="bg-neon-purple/80"
              style={{ width: `${(stats.approved / stats.total) * 100}%` }}
              title={`${stats.approved} in Queue`}
            />
          )}
          {stats.pending > 0 && (
            <div
              className="bg-yellow-400/80"
              style={{ width: `${(stats.pending / stats.total) * 100}%` }}
              title={`${stats.pending} offen`}
            />
          )}
          {stats.rejected > 0 && (
            <div
              className="bg-red-500/70"
              style={{ width: `${(stats.rejected / stats.total) * 100}%` }}
              title={`${stats.rejected} abgelehnt`}
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
  total: number;
  played: number;
  approved: number;
  pending: number;
  rejected: number;
  uniqueTracks: number;
  acceptanceRate: number;
  topTrack: TrackStat | null;
  topTracks: TrackStat[];
  topArtists: ArtistStat[];
}

function calculateStats(requests: SongRequest[]): Stats {
  const total = requests.length;
  const played = requests.filter((r) => r.status === "played").length;
  const approved = requests.filter((r) => r.status === "approved").length;
  const pending = requests.filter((r) => r.status === "pending").length;
  const rejected = requests.filter((r) => r.status === "rejected").length;

  // Top Tracks: gruppiert nach spotify_track_id
  const trackMap = new Map<string, TrackStat>();
  for (const r of requests) {
    const existing = trackMap.get(r.spotify_track_id);
    if (existing) {
      existing.count++;
      if (r.status === "played") existing.played++;
    } else {
      trackMap.set(r.spotify_track_id, {
        id: r.spotify_track_id,
        title: r.title,
        artist: r.artist,
        cover_url: r.cover_url,
        count: 1,
        played: r.status === "played" ? 1 : 0
      });
    }
  }
  const allTracks = Array.from(trackMap.values()).sort(
    (a, b) => b.count - a.count
  );

  // Top Artists: erster Künstler im artist-Feld
  const artistMap = new Map<string, number>();
  for (const r of requests) {
    const primary = r.artist.split(",")[0]?.trim();
    if (!primary) continue;
    artistMap.set(primary, (artistMap.get(primary) ?? 0) + 1);
  }
  const topArtists = Array.from(artistMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const acceptanceRate =
    total > 0 ? Math.round(((approved + played) / total) * 100) : 0;

  return {
    total,
    played,
    approved,
    pending,
    rejected,
    uniqueTracks: trackMap.size,
    acceptanceRate,
    topTrack: allTracks[0] ?? null,
    topTracks: allTracks.slice(0, 5),
    topArtists
  };
}
