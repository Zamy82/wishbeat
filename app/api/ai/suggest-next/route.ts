import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "@/lib/spotify-user";
import { searchTracks, getGenresByArtistName } from "@/lib/spotify";
import { computeVibeTokens } from "@/lib/vibe-match";

// KI-Vorschlaege: aus aktuellem Spotify-Track + Vibe-Kontext schlaegt
// Claude Haiku 4.5 passende naechste Songs vor. Wir reichern jeden
// Vorschlag dann mit echten Spotify-Suchtreffern an, damit der DJ
// direkt in die Queue pushen kann.

interface PlayRow {
  spotify_track_id: string;
  title: string;
  artist: string;
  artist_genres?: string[] | null;
  played_at: string;
}

interface AISuggestion {
  title: string;
  artist: string;
  reason: string;
}

interface EnrichedSuggestion extends AISuggestion {
  spotify_track_id: string | null;
  cover_url: string | null;
  album: string | null;
}

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const SYSTEM_PROMPT = `Du bist ein erfahrener DJ-Assistent für deutsche Partys (Hochzeiten, Geburtstage, Oktoberfest, Firmenfeiern).

Deine Aufgabe: 6-8 passende Songs vorschlagen, die DIREKT nach dem aktuellen Track gut funktionieren.

═══ HARTE REGELN — NICHT VERHANDELBAR ═══

REGEL 1 — KÜNSTLER-FOKUS (wichtigste Regel!):
- Schlage **mindestens 2 weitere Songs des aktuellen Künstlers** vor.
- Beispiel: Läuft "Atemlos" von Helene Fischer → schlage z.B. "Achterbahn" und "Phänomen" von Helene Fischer vor.
- Diese 2 Künstler-Songs müssen die ersten Vorschläge in der Liste sein.

REGEL 2 — GENRE-TREUE:
- Mindestens **80% deiner Vorschläge müssen das gleiche Genre** haben wie der aktuelle Track.
- Schlager-Song → fast nur Schlager-Songs vorschlagen (Roland Kaiser, Andrea Berg, Andreas Gabalier, Mickie Krause, Wolfgang Petry, Matthias Reim, Helene Fischer, Eloy de Jong, Beatrice Egli, Vanessa Mai, …)
- 90er-Pop → 90er-Pop
- Hip-Hop → Hip-Hop
- KEINE Genre-Sprünge! Kein englischer Rock nach deutschem Schlager.

REGEL 3 — SPRACHE:
- Aktueller Song ist deutschsprachig → **alle Vorschläge auf Deutsch**.
- Aktueller Song ist englischsprachig → Englisch.

REGEL 4 — MAX 1 ÜBERGANGS-SONG:
- Maximal EIN Vorschlag darf eine sanfte Brücke zu einem verwandten Genre sein (z.B. von Schlager zu Partyschlager/Ballermann, oder von 80er-Pop zu 90er-Pop).
- Alle anderen müssen voll im Stil bleiben.

REGEL 5 — KEINE WIEDERHOLUNGEN:
- Wenn ein Song in den "Letzte gespielte Songs" steht, nicht erneut vorschlagen.

═══ OUTPUT-FORMAT ═══

Antworte AUSSCHLIESSLICH mit reinem JSON, kein Markdown, kein Begleittext.
Format: {"suggestions": [{"title": "...", "artist": "...", "reason": "..."}, ...]}

- 6 bis 8 Vorschläge.
- Schlage NUR echte, auf Spotify auffindbare Songs vor.
- Künstlernamen wie auf Spotify (z.B. "Helene Fischer", nicht "Fischer, Helene").
- "reason" auf Deutsch, max 70 Zeichen, sehr konkret:
  * "Vom selben Künstler — direkter Anschluss"
  * "Schlager-Hit, hält Energie und Stimmung"
  * "Übergang zu Mickie Krause für mehr Party-Tempo"
- Die ersten zwei Vorschläge sollen vom GLEICHEN Künstler wie der aktuelle Track sein.`;

export async function POST(_req: NextRequest) {
  // Auth: DJ muss eingeloggt sein
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Nicht eingeloggt." },
      { status: 401 }
    );
  }

  // API-Key checken
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      ok: false,
      message: "Anthropic API-Key nicht konfiguriert. Bitte in Vercel als ANTHROPIC_API_KEY setzen."
    }, { status: 500 });
  }

  // Aktuellen Spotify-Track holen
  const spotifyToken = await getValidAccessToken();
  if (!spotifyToken) {
    return NextResponse.json({
      ok: false,
      message: "Spotify ist nicht verbunden. Verbinde Spotify zuerst."
    });
  }

  const npRes = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing?market=DE",
    { headers: { Authorization: `Bearer ${spotifyToken}` }, cache: "no-store" }
  );

  if (npRes.status === 204 || !npRes.ok) {
    return NextResponse.json({
      ok: false,
      message: "Spotify spielt gerade nichts. Starte einen Song zuerst."
    });
  }

  interface NowPlaying {
    item: {
      name: string;
      artists: { name: string }[];
    } | null;
  }
  const npData = (await npRes.json()) as NowPlaying;
  if (!npData.item) {
    return NextResponse.json({
      ok: false,
      message: "Kein aktueller Spotify-Track gefunden."
    });
  }
  const currentTitle = npData.item.name;
  const currentArtist = npData.item.artists.map((a) => a.name).join(", ");

  // Aktuelles Event finden (das neueste aktive Event des DJs)
  const admin = adminClient();
  const { data: activeEvent } = await admin
    .from("events")
    .select("id")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Letzte ~10 Plays aus dem aktiven Event laden (fuer Kontext)
  let recentPlays: PlayRow[] = [];
  if (activeEvent) {
    const { data: plays } = await admin
      .from("event_plays")
      .select("spotify_track_id, title, artist, artist_genres, played_at")
      .eq("event_id", activeEvent.id)
      .order("played_at", { ascending: false })
      .limit(10);
    recentPlays = (plays ?? []) as PlayRow[];
  }

  // Vibe-Tags aus den Recent-Plays berechnen (oder live von MusicBrainz)
  const playsGenresLists: string[][] = await Promise.all(
    recentPlays.map(async (p) => {
      if (Array.isArray(p.artist_genres) && p.artist_genres.length > 0) {
        return p.artist_genres;
      }
      try {
        return await getGenresByArtistName(p.artist);
      } catch {
        return [];
      }
    })
  );
  const vibeTokens = computeVibeTokens(playsGenresLists);
  const topVibeWords = Object.entries(vibeTokens)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);

  // Genres des aktuellen Tracks
  let currentGenres: string[] = [];
  try {
    currentGenres = await getGenresByArtistName(currentArtist);
  } catch {}

  // Primaerer Kuenstler (vor Komma)
  const primaryArtist = currentArtist.split(",")[0].trim();

  // User-Message bauen
  const recentList = recentPlays
    .slice(0, 8)
    .map((p, i) => `${i + 1}. "${p.title}" — ${p.artist}`)
    .join("\n");

  const userMessage = `═══ AKTUELLER TRACK ═══
Titel: "${currentTitle}"
Künstler: ${currentArtist}
${currentGenres.length > 0 ? `Genre-Tags: ${currentGenres.slice(0, 5).join(", ")}` : ""}

═══ KONTEXT ═══
${recentPlays.length > 0
  ? `Letzte gespielte Songs (NICHT erneut vorschlagen!):\n${recentList}`
  : "Bisher noch keine anderen Songs auf dieser Party gespielt."}

${topVibeWords.length > 0
  ? `Aktuelle Vibe-Wörter aus letzten Plays: ${topVibeWords.join(", ")}`
  : ""}

═══ ANFORDERUNG ═══
Schlage 6-8 Songs vor, die nach "${currentTitle}" gut funktionieren.

PFLICHT:
- Vorschlag 1 und 2 MÜSSEN andere bekannte Songs von **${primaryArtist}** sein (nicht der aktuelle Track!).
- Restliche Vorschläge im gleichen Genre/Stil wie der aktuelle Track.
- Maximal EIN Vorschlag darf in ein verwandtes Genre wechseln.`;

  // Claude Haiku 4.5 aufrufen
  const anthropic = new Anthropic();

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }]
    });

    // Antwort parsen — System-Prompt erzwingt reines JSON
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({
        ok: false,
        message: "Keine Text-Antwort von KI bekommen."
      });
    }

    // Falls Claude doch mal einen ```json-Block schickt, robust extrahieren
    let jsonText = textBlock.text.trim();
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonText = codeBlockMatch[1].trim();

    let parsed: { suggestions: AISuggestion[] };
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return NextResponse.json({
        ok: false,
        message: "KI-Antwort konnte nicht geparst werden.",
        raw: textBlock.text.slice(0, 500)
      });
    }

    // Pro Vorschlag: Spotify-Search → echte Track-Daten holen
    const enriched: EnrichedSuggestion[] = await Promise.all(
      (parsed.suggestions ?? []).slice(0, 8).map(async (s) => {
        try {
          const query = `${s.title} ${s.artist}`;
          const tracks = await searchTracks(query, 1);
          const t = tracks[0];
          return {
            ...s,
            spotify_track_id: t?.id ?? null,
            cover_url: t?.cover_url ?? null,
            album: t?.album ?? null
          };
        } catch {
          return {
            ...s,
            spotify_track_id: null,
            cover_url: null,
            album: null
          };
        }
      })
    );

    // Nur Vorschlaege mit gefundener Spotify-ID zurueckgeben
    const usable = enriched.filter((s) => s.spotify_track_id);

    return NextResponse.json({
      ok: true,
      currentTrack: { title: currentTitle, artist: currentArtist },
      suggestions: usable,
      droppedCount: enriched.length - usable.length,
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens
      }
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({
      ok: false,
      message: `KI-Fehler: ${err.message ?? String(e)}`,
      code: err.status
    }, { status: 500 });
  }
}
