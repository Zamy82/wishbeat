import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Oeffentliche Aggregat-Statistik der Events eines DJs — gibt NUR Zahlen zurueck
// (Songs, Top-Kuenstler, Wunsch-Zahlen), KEINE Gaeste-Namen/Sessions. Damit
// laesst sich die Auswertung ohne DJ-Login/Screenshots ziehen (Gegenstueck zu
// /api/dj/[ownerId]/reviews). Nutzt Service-Role (RLS-Bypass), gibt aber nur
// unbedenkliche Aggregate raus.
//
// GET .../stats            -> Liste der Events mit Basiszahlen (zum Auffinden)
// GET .../stats?event_id=X -> volle Aggregat-Statistik fuer ein Event

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

interface RouteContext {
  params: Promise<{ ownerId: string }>;
}

interface PlayRow {
  spotify_track_id: string;
  title: string;
  artist: string;
  source: string | null;
  played_at: string;
}

interface ReqRow {
  status: string;
  spotify_track_id: string;
  title: string;
  artist: string;
}

// Titel normalisieren (identisch zur Dashboard-StatsPanel-Logik), damit
// Album-/Single-/Remix-Varianten desselben Songs als einer zaehlen.
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*[([].*?[)\]]\s*/g, " ")
    .replace(
      /\s*-\s*(single|radio|album|extended|remix|version|edit|live|remastered|deluxe|mono|stereo|club\s*mix|mix)\b.*$/gi,
      ""
    )
    .replace(/\s+(feat\.?|ft\.?|featuring)\s+.*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeArtist(artist: string): string {
  const primary = artist.split(/[,&]|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b/i)[0] ?? "";
  return primary.toLowerCase().trim();
}

const STATS_DEDUP_WINDOW_MS = 15 * 60 * 1000;

function computeEventStats(plays: PlayRow[], requests: ReqRow[]) {
  // Chronologisch sortieren + nahe Duplikate (gleicher Titel/Kuenstler < 15 Min)
  // zusammenfassen — verhindert Doppelzaehlung verschiedener Track-IDs.
  const sorted = [...plays].sort((a, b) => a.played_at.localeCompare(b.played_at));
  const seenByKey = new Map<string, number>();
  const deduped: PlayRow[] = [];
  for (const p of sorted) {
    const key = `${normalizeTitle(p.title)}|${normalizeArtist(p.artist)}`;
    const t = new Date(p.played_at).getTime();
    const last = seenByKey.get(key);
    if (last !== undefined && t - last < STATS_DEDUP_WINDOW_MS) continue;
    seenByKey.set(key, t);
    deduped.push(p);
  }

  // Tracks gruppieren
  const trackMap = new Map<
    string,
    { title: string; artist: string; plays: number; fromWish: number; latest: string }
  >();
  for (const p of deduped) {
    const key = `${normalizeTitle(p.title)}|${normalizeArtist(p.artist)}`;
    const ex = trackMap.get(key);
    if (ex) {
      ex.plays++;
      if (p.source === "wish") ex.fromWish++;
      if (p.played_at > ex.latest) ex.latest = p.played_at;
    } else {
      trackMap.set(key, {
        title: p.title,
        artist: p.artist,
        plays: 1,
        fromWish: p.source === "wish" ? 1 : 0,
        latest: p.played_at
      });
    }
  }
  const allTracks = Array.from(trackMap.values()).sort((a, b) =>
    b.plays !== a.plays ? b.plays - a.plays : b.latest.localeCompare(a.latest)
  );

  // Kuenstler
  const artistMap = new Map<string, { name: string; plays: number }>();
  for (const p of deduped) {
    const primary = p.artist
      .split(/[,&]|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b/i)[0]
      ?.trim();
    if (!primary) continue;
    const k = primary.toLowerCase();
    const ex = artistMap.get(k);
    if (ex) ex.plays++;
    else artistMap.set(k, { name: primary, plays: 1 });
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
    totalRequests > 0 ? Math.round(((approved + played) / totalRequests) * 100) : 0;
  const wishesPlayed = deduped.filter((p) => p.source === "wish").length;
  const wishShare =
    deduped.length > 0 ? Math.round((wishesPlayed / deduped.length) * 100) : 0;

  const top = (t: { title: string; artist: string; plays: number; fromWish: number }) => ({
    title: t.title,
    artist: t.artist,
    plays: t.plays,
    fromWish: t.fromWish
  });

  return {
    totalPlays: deduped.length,
    uniqueTracks: trackMap.size,
    totalRequests,
    played,
    approved,
    pending,
    rejected,
    acceptanceRate,
    wishesPlayed,
    wishShare,
    topTrack: allTracks[0] ? top(allTracks[0]) : null,
    topTracks: allTracks.slice(0, 10).map(top),
    topArtists
  };
}

// Gleicht Wuensche gegen tatsaechlich gespielte Songs ab — unabhaengig vom
// App-Status (viele DJs spielen Wuensche direkt aus Spotify, ohne sie in der
// App auf "played" zu klicken). Match ueber Spotify-Track-ID ODER normalisierten
// Titel+Kuenstler (faengt Album-/Single-/Remix-Varianten). Gibt nur Songtitel
// zurueck, keine Gaeste-Namen.
function computeWishMatch(plays: PlayRow[], requests: ReqRow[]) {
  const playedKeys = new Set<string>();
  const playedIds = new Set<string>();
  for (const p of plays) {
    playedKeys.add(`${normalizeTitle(p.title)}|${normalizeArtist(p.artist)}`);
    if (p.spotify_track_id) playedIds.add(p.spotify_track_id);
  }
  // Wuensche auf eindeutige Songs eindampfen (mehrere Gaeste = selber Song)
  const distinct = new Map<string, { title: string; artist: string; trackId: string }>();
  for (const r of requests) {
    const key = `${normalizeTitle(r.title)}|${normalizeArtist(r.artist)}`;
    if (!distinct.has(key)) {
      distinct.set(key, { title: r.title, artist: r.artist, trackId: r.spotify_track_id });
    }
  }
  const playedList: { title: string; artist: string }[] = [];
  const notPlayedList: { title: string; artist: string }[] = [];
  for (const [key, w] of distinct) {
    const matched = playedKeys.has(key) || (!!w.trackId && playedIds.has(w.trackId));
    (matched ? playedList : notPlayedList).push({ title: w.title, artist: w.artist });
  }
  return {
    requestEntries: requests.length,
    wishSongsDistinct: distinct.size,
    wishSongsPlayed: playedList.length,
    wishSongsNotPlayed: notPlayedList.length,
    playedList,
    notPlayedList
  };
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { ownerId } = await ctx.params;
  const eventId = req.nextUrl.searchParams.get("event_id");
  const supabase = adminClient();

  const { data: evs } = await supabase
    .from("events")
    .select("id, name, event_date, is_active")
    .eq("owner_id", ownerId);

  if (!evs || evs.length === 0) {
    return NextResponse.json({ events: [] });
  }

  // Einzel-Event: volle Aggregat-Statistik
  if (eventId) {
    const ev = evs.find((e: { id: string }) => e.id === eventId);
    if (!ev) {
      return NextResponse.json({ error: "event_not_found" }, { status: 404 });
    }
    const [{ data: plays }, { data: requests }] = await Promise.all([
      supabase
        .from("event_plays")
        .select("spotify_track_id, title, artist, source, played_at")
        .eq("event_id", eventId)
        .order("played_at", { ascending: true }),
      supabase
        .from("song_requests")
        .select("status, spotify_track_id, title, artist")
        .eq("event_id", eventId)
    ]);
    const p = (plays ?? []) as PlayRow[];
    const r = (requests ?? []) as ReqRow[];
    const stats = computeEventStats(p, r);
    const wishMatch = computeWishMatch(p, r);
    return NextResponse.json({
      event: {
        id: ev.id,
        name: ev.name,
        event_date: ev.event_date,
        is_active: ev.is_active
      },
      ...stats,
      wishMatch
    });
  }

  // Liste: Basiszahlen pro Event (zum Auffinden der event_id)
  const evIds = evs.map((e: { id: string }) => e.id);
  const [{ data: reqs }, { data: plays }] = await Promise.all([
    supabase.from("song_requests").select("event_id, status").in("event_id", evIds),
    supabase.from("event_plays").select("event_id").in("event_id", evIds)
  ]);

  const reqCount = new Map<string, { total: number; played: number }>();
  for (const r of (reqs ?? []) as { event_id: string; status: string }[]) {
    const c = reqCount.get(r.event_id) ?? { total: 0, played: 0 };
    c.total++;
    if (r.status === "played") c.played++;
    reqCount.set(r.event_id, c);
  }
  const playCount = new Map<string, number>();
  for (const p of (plays ?? []) as { event_id: string }[]) {
    playCount.set(p.event_id, (playCount.get(p.event_id) ?? 0) + 1);
  }

  const events = (
    evs as { id: string; name: string; event_date: string; is_active: boolean }[]
  )
    .map((e) => ({
      id: e.id,
      name: e.name,
      event_date: e.event_date,
      is_active: e.is_active,
      playsRaw: playCount.get(e.id) ?? 0,
      requests: reqCount.get(e.id)?.total ?? 0,
      requestsPlayed: reqCount.get(e.id)?.played ?? 0
    }))
    .sort((a, b) => b.event_date.localeCompare(a.event_date));

  return NextResponse.json({ events });
}
