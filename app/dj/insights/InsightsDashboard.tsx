"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

interface EventRow {
  id: string;
  name: string;
  event_date: string;
}

interface PlayRow {
  event_id: string;
  spotify_track_id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  source: string | null;
  played_at: string;
}

interface ReactionRow {
  event_id: string;
  spotify_track_id: string;
  reaction: "fire" | "dance" | "meh";
}

interface RatingRow {
  event_id: string;
  rating: number;
  comment: string | null;
  nickname: string | null;
  created_at: string;
}

interface Props {
  events: EventRow[];
  plays: PlayRow[];
  reactions: ReactionRow[];
  ratings: RatingRow[];
}

type Range = "30days" | "year" | "all";

const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: "30days", label: "30 Tage" },
  { key: "year", label: "Dieses Jahr" },
  { key: "all", label: "Alle Zeit" }
];

// Songtitel normalisieren — Klammern, Remix-Suffixe, Feat. wegwerfen.
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*[([].*?[)\]]\s*/g, " ")
    .replace(/\s*-\s*(single|radio|album|extended|remix|version|edit|live|remastered|deluxe|mono|stereo|club\s*mix|mix)\b.*$/gi, "")
    .replace(/\s+(feat\.?|ft\.?|featuring)\s+.*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeArtist(artist: string): string {
  const primary = artist.split(/[,&]|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b/i)[0] ?? "";
  return primary.toLowerCase().trim();
}

interface SongAggregate {
  key: string;
  trackId: string;
  title: string;
  artist: string;
  cover_url: string | null;
  plays: number;
  fire: number;
  dance: number;
  meh: number;
  pulseScore: number | null;
  eventsCount: number;
}

interface AggregatedStats {
  eventCount: number;
  totalPlays: number;
  uniqueTracks: number;
  totalReactions: number;
  totalRatings: number;
  avgRating: number | null;
  totalFire: number;
  totalDance: number;
  totalMeh: number;
  topPlays: SongAggregate[];
  topPulse: SongAggregate[];
  topDance: SongAggregate[];
  coldSongs: SongAggregate[];
  topArtists: { name: string; plays: number }[];
}

function aggregate(
  events: EventRow[],
  plays: PlayRow[],
  reactions: ReactionRow[],
  ratings: RatingRow[]
): AggregatedStats {
  // Song-Aggregation pro normalisierter (Titel, Artist)-Kombi
  const songMap = new Map<
    string,
    {
      title: string;
      artist: string;
      cover_url: string | null;
      trackId: string;
      plays: number;
      trackIds: Set<string>;
      eventIds: Set<string>;
    }
  >();

  for (const p of plays) {
    const key = `${normalizeTitle(p.title)}|${normalizeArtist(p.artist)}`;
    const existing = songMap.get(key);
    if (existing) {
      existing.plays++;
      existing.trackIds.add(p.spotify_track_id);
      existing.eventIds.add(p.event_id);
      if (!existing.cover_url && p.cover_url) existing.cover_url = p.cover_url;
    } else {
      songMap.set(key, {
        title: p.title,
        artist: p.artist,
        cover_url: p.cover_url,
        trackId: p.spotify_track_id,
        plays: 1,
        trackIds: new Set([p.spotify_track_id]),
        eventIds: new Set([p.event_id])
      });
    }
  }

  // Reactions: gruppiere pro spotify_track_id, dann ueber normalisierte
  // Track-Key joinen wenn Plays vorhanden — sonst lege neuen Entry an.
  const reactionByTrackId = new Map<string, { fire: number; dance: number; meh: number }>();
  for (const r of reactions) {
    const c = reactionByTrackId.get(r.spotify_track_id) ?? { fire: 0, dance: 0, meh: 0 };
    if (r.reaction === "fire") c.fire++;
    else if (r.reaction === "dance") c.dance++;
    else if (r.reaction === "meh") c.meh++;
    reactionByTrackId.set(r.spotify_track_id, c);
  }

  // Enriche Song-Aggregate mit Reaction-Counts
  const aggregates: SongAggregate[] = [];
  for (const [key, s] of songMap.entries()) {
    let fire = 0;
    let dance = 0;
    let meh = 0;
    for (const tid of s.trackIds) {
      const c = reactionByTrackId.get(tid);
      if (c) {
        fire += c.fire;
        dance += c.dance;
        meh += c.meh;
      }
    }
    const total = fire + dance + meh;
    const num = fire + 1.5 * dance;
    const den = fire + dance + 0.5 * meh;
    const pulseScore = total >= 2 && den > 0
      ? Math.min(100, Math.round((num / den) * 100))
      : null;
    aggregates.push({
      key,
      trackId: s.trackId,
      title: s.title,
      artist: s.artist,
      cover_url: s.cover_url,
      plays: s.plays,
      fire,
      dance,
      meh,
      pulseScore,
      eventsCount: s.eventIds.size
    });
  }

  // Top Künstler
  const artistMap = new Map<string, { name: string; plays: number }>();
  for (const p of plays) {
    const primary = p.artist
      .split(/[,&]|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b/i)[0]
      ?.trim();
    if (!primary) continue;
    const normKey = primary.toLowerCase();
    const existing = artistMap.get(normKey);
    if (existing) existing.plays++;
    else artistMap.set(normKey, { name: primary, plays: 1 });
  }
  const topArtists = Array.from(artistMap.values())
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 8);

  const totalFire = aggregates.reduce((s, a) => s + a.fire, 0);
  const totalDance = aggregates.reduce((s, a) => s + a.dance, 0);
  const totalMeh = aggregates.reduce((s, a) => s + a.meh, 0);

  const avgRating =
    ratings.length > 0
      ? Math.round(
          (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10
        ) / 10
      : null;

  return {
    eventCount: events.length,
    totalPlays: plays.length,
    uniqueTracks: aggregates.length,
    totalReactions: totalFire + totalDance + totalMeh,
    totalRatings: ratings.length,
    avgRating,
    totalFire,
    totalDance,
    totalMeh,
    topPlays: [...aggregates]
      .sort((a, b) => b.plays - a.plays || b.eventsCount - a.eventsCount)
      .slice(0, 10),
    topPulse: [...aggregates]
      .filter((a) => a.pulseScore !== null && a.fire + a.dance + a.meh >= 3)
      .sort(
        (a, b) =>
          (b.pulseScore ?? 0) - (a.pulseScore ?? 0) ||
          b.fire + b.dance - (a.fire + a.dance)
      )
      .slice(0, 10),
    topDance: [...aggregates]
      .filter((a) => a.dance > 0)
      .sort((a, b) => b.dance - a.dance)
      .slice(0, 10),
    coldSongs: [...aggregates]
      .filter((a) => a.meh >= 2 && a.meh > a.fire + a.dance)
      .sort((a, b) => b.meh - a.meh)
      .slice(0, 10),
    topArtists
  };
}

export default function InsightsDashboard({
  events,
  plays,
  reactions,
  ratings
}: Props) {
  const [range, setRange] = useState<Range>("year");

  const filtered = useMemo(() => {
    let cutoffDate: string | null = null;
    const now = new Date();
    if (range === "30days") {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      cutoffDate = d.toISOString().slice(0, 10);
    } else if (range === "year") {
      cutoffDate = `${now.getFullYear()}-01-01`;
    }
    if (!cutoffDate) {
      return { events, plays, reactions, ratings };
    }
    const eventsInRange = events.filter((e) => e.event_date >= cutoffDate!);
    const idSet = new Set(eventsInRange.map((e) => e.id));
    return {
      events: eventsInRange,
      plays: plays.filter((p) => idSet.has(p.event_id)),
      reactions: reactions.filter((r) => idSet.has(r.event_id)),
      ratings: ratings.filter((r) => idSet.has(r.event_id))
    };
  }, [range, events, plays, reactions, ratings]);

  const stats = useMemo(
    () =>
      aggregate(filtered.events, filtered.plays, filtered.reactions, filtered.ratings),
    [filtered]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Range-Selector */}
      <div className="flex gap-1 p-1 rounded-2xl bg-white/5 border border-white/10 w-fit">
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              range === r.key
                ? "bg-gradient-to-r from-neon-pink/40 to-neon-purple/40 text-white shadow"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {stats.totalPlays === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <p className="text-white/50">
            Keine Daten im gewählten Zeitraum.
          </p>
        </div>
      ) : (
        <>
          {/* KPI-Kacheln */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard
              label="Events"
              value={stats.eventCount}
              accent="text-neon-cyan"
            />
            <KpiCard
              label="Songs gespielt"
              value={stats.totalPlays}
              accent="text-neon-pink"
              subline={`${stats.uniqueTracks} eindeutig`}
            />
            <KpiCard
              label="Reactions"
              value={stats.totalReactions}
              accent="text-neon-purple"
              subline={`🔥${stats.totalFire} 💃${stats.totalDance} 😴${stats.totalMeh}`}
            />
            <KpiCard
              label="Bewertungen"
              value={stats.totalRatings}
              accent="text-yellow-300"
              subline={stats.avgRating !== null ? `⭐ ${stats.avgRating} / 5` : "—"}
            />
            <KpiCard
              label="⌀ Songs/Event"
              value={
                stats.eventCount > 0
                  ? Math.round(stats.totalPlays / stats.eventCount)
                  : 0
              }
              accent="text-white"
            />
          </div>

          {/* Top Plays + Top Crowd-Hits */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RankedList
              icon="🏆"
              title="Meist gespielte Songs"
              rows={stats.topPlays.map((s) => ({
                key: s.key,
                cover: s.cover_url,
                title: s.title,
                artist: s.artist,
                primary: `${s.plays}×`,
                secondary:
                  s.eventsCount > 1 ? `auf ${s.eventsCount} Events` : null,
                accent: "text-neon-cyan"
              }))}
            />
            <RankedList
              icon="🔥"
              title="Crowd-Hits (Pulse-Score)"
              empty="Noch keine Reactions im Zeitraum"
              rows={stats.topPulse.map((s) => ({
                key: s.key,
                cover: s.cover_url,
                title: s.title,
                artist: s.artist,
                primary: `${s.pulseScore}%`,
                secondary: `🔥${s.fire} 💃${s.dance} 😴${s.meh}`,
                accent: "text-orange-300"
              }))}
            />
          </div>

          {/* Top Dance + Cold Songs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RankedList
              icon="💃"
              title="Tanzflächen-Killer"
              empty="Keine Tanz-Reactions im Zeitraum"
              rows={stats.topDance.map((s) => ({
                key: s.key,
                cover: s.cover_url,
                title: s.title,
                artist: s.artist,
                primary: `${s.dance}×`,
                secondary: s.plays > 1 ? `${s.plays}× gespielt` : null,
                accent: "text-neon-pink"
              }))}
            />
            <RankedList
              icon="❄️"
              title="Floppen — beim nächsten Mal meiden"
              empty="Keine Reinfälle — alles gut gelaufen!"
              rows={stats.coldSongs.map((s) => ({
                key: s.key,
                cover: s.cover_url,
                title: s.title,
                artist: s.artist,
                primary: `${s.meh}×`,
                secondary: "Wechsel-Reaktionen",
                accent: "text-cyan-300"
              }))}
            />
          </div>

          {/* ⭐ Bewertungs-Sektion */}
          {filtered.ratings.length > 0 && (
            <RatingsSection
              ratings={filtered.ratings}
              events={filtered.events}
            />
          )}

          {/* Top Künstler */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-xs uppercase tracking-widest text-white/40 font-semibold mb-3">
              🎤 Top Künstler
            </h3>
            {stats.topArtists.length === 0 ? (
              <p className="text-white/40 text-sm">Noch keine Daten</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {stats.topArtists.map((a, i) => (
                  <li key={a.name} className="flex items-center gap-3">
                    <span className="text-white/30 text-xs font-bold w-5">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-semibold truncate">
                        {a.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
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
                      <span className="text-neon-pink text-sm font-bold w-8 text-right">
                        {a.plays}×
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface RowData {
  key: string;
  cover: string | null;
  title: string;
  artist: string;
  primary: string;
  secondary: string | null;
  accent: string;
}

function RankedList({
  icon,
  title,
  rows,
  empty
}: {
  icon: string;
  title: string;
  rows: RowData[];
  empty?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-xs uppercase tracking-widest text-white/40 font-semibold mb-3 flex items-center gap-2">
        <span>{icon}</span>
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-white/40 text-sm">{empty ?? "Noch keine Daten"}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li key={r.key} className="flex items-center gap-3">
              <span className="text-white/30 text-xs font-bold w-5">{i + 1}</span>
              {r.cover ? (
                <Image
                  src={r.cover}
                  alt={r.title}
                  width={36}
                  height={36}
                  className="rounded-md flex-shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-md bg-white/5 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-semibold truncate">
                  {r.title}
                </p>
                <p className="text-white/40 text-xs truncate">{r.artist}</p>
              </div>
              <div className="flex flex-col items-end flex-shrink-0 min-w-[64px]">
                <span className={`text-sm font-bold ${r.accent}`}>
                  {r.primary}
                </span>
                {r.secondary && (
                  <span className="text-white/30 text-[10px]">
                    {r.secondary}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function RatingsSection({
  ratings,
  events
}: {
  ratings: RatingRow[];
  events: EventRow[];
}) {
  const eventNameById = new Map(events.map((e) => [e.id, e.name]));

  // Star-Verteilung 1..5
  const distribution = [1, 2, 3, 4, 5].map((star) => ({
    star,
    count: ratings.filter((r) => r.rating === star).length
  }));
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));

  // Pro-Event-Schnitt
  const perEvent = new Map<string, { sum: number; count: number }>();
  for (const r of ratings) {
    const e = perEvent.get(r.event_id) ?? { sum: 0, count: 0 };
    e.sum += r.rating;
    e.count += 1;
    perEvent.set(r.event_id, e);
  }
  const eventAverages = Array.from(perEvent.entries())
    .map(([eventId, { sum, count }]) => ({
      eventId,
      name: eventNameById.get(eventId) ?? "—",
      avg: Math.round((sum / count) * 10) / 10,
      count
    }))
    .sort((a, b) => b.avg - a.avg);

  const withComment = ratings.filter(
    (r) => r.comment && r.comment.trim().length > 0
  );

  return (
    <section className="rounded-3xl border border-yellow-400/30 bg-gradient-to-br from-yellow-400/5 to-amber-500/5 p-5">
      <h3 className="text-xs uppercase tracking-widest text-yellow-300 font-semibold mb-4 flex items-center gap-2">
        <span>⭐</span> Bewertungen
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sterne-Verteilung */}
        <div>
          <p className="text-white/40 text-[10px] uppercase tracking-widest mb-3 font-semibold">
            Verteilung
          </p>
          <div className="flex flex-col gap-1.5">
            {[...distribution].reverse().map((d) => (
              <div key={d.star} className="flex items-center gap-2">
                <span className="text-yellow-300 text-xs w-8 font-bold">
                  {d.star}★
                </span>
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-amber-300 transition-all"
                    style={{ width: `${(d.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-white/70 text-xs font-mono w-8 text-right">
                  {d.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pro Event */}
        <div>
          <p className="text-white/40 text-[10px] uppercase tracking-widest mb-3 font-semibold">
            Pro Event
          </p>
          {eventAverages.length === 0 ? (
            <p className="text-white/40 text-sm">Keine Daten</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {eventAverages.map((e) => (
                <li
                  key={e.eventId}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-white text-sm font-semibold truncate">
                    {e.name}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-yellow-300 text-sm font-bold">
                      ⭐ {e.avg}
                    </span>
                    <span className="text-white/30 text-[10px]">
                      ({e.count})
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Kommentare */}
      {withComment.length > 0 && (
        <div className="mt-6 pt-5 border-t border-white/10">
          <p className="text-white/40 text-[10px] uppercase tracking-widest mb-3 font-semibold">
            Letzte Kommentare ({withComment.length})
          </p>
          <ul className="flex flex-col gap-3">
            {withComment.slice(0, 8).map((r, i) => (
              <li
                key={`${r.event_id}-${r.created_at}-${i}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-3"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-yellow-300 text-sm font-bold">
                    {"★".repeat(r.rating)}
                    <span className="text-white/15">
                      {"★".repeat(5 - r.rating)}
                    </span>
                  </span>
                  <span className="text-white/30 text-[10px]">
                    {r.nickname?.trim() || "Anonym"} ·{" "}
                    {eventNameById.get(r.event_id) ?? "—"}
                  </span>
                </div>
                <p className="text-white/80 text-sm leading-relaxed">
                  „{r.comment}"
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
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
