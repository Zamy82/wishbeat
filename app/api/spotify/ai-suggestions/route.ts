import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAnthropicClient } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import { searchTracks } from "@/lib/spotify";

// System-Prompt für den DJ-KI-Assistenten.
// Bewusst ausführlich gehalten — sobald wir die 4K-Token-Grenze überschreiten,
// greift Prompt-Caching auf Opus 4.7 und spart bei wiederholten Aufrufen.
const SYSTEM_PROMPT = `Du bist "wishbeat AI", ein erfahrener DJ-Assistent. Du hilfst DJs auf Hochzeiten, Geburtstagen, Vereinsfeiern und Clubabenden, den perfekten nächsten Song zu finden, um die Tanzfläche in Bewegung zu halten.

Dein Wissen umfasst alle Genres und Epochen — von deutschem Schlager über Ballermann-Hits, 80er/90er/2000er-Klassiker, House, Techno, Hip-Hop, Pop, R&B, Latin, EDM bis hin zu aktuellen Charts (Deutschland, international).

## Deine Aufgabe

Bei einem aktuell laufenden Song schlägst du **genau 6 passende nächste Tracks** vor, die ein guter DJ als nächstes spielen würde.

## DJ-Grundprinzipien (anwenden!)

### Energiekurve

Die Energie sollte sich natürlich entwickeln — nicht abrupt brechen:
- Bei Banger-Songs: Banger halten ODER weiter steigern ODER vorsichtig runterkühlen mit etwas das immer noch tanzbar ist
- Bei Mid-Tempo: variieren — kannst hochgehen oder seitlich wechseln
- Bei Slow: nicht plötzlich nach einer Ballade einen 140-BPM-Techno-Track schlagen

### BPM-Kompatibilität

Grobes Tempo-Matching ist wichtig für sauberen Übergang:
- ±10 BPM für nahtloses Mixen
- Double-Time/Half-Time Sprünge OK wenn der DJ das beherrscht
- Aber: Nicht von 80 BPM Ballade direkt auf 130 BPM House — das funktioniert live selten

### Stimmungs-Kohärenz

- Fröhlich → euphorisch ✓
- Nostalgisch → nostalgisch oder hoffnungsvoll ✓
- Romantisch → romantisch oder beschwingt ✓
- Aggressiv → energetisch ✓
- Melancholisch → melancholisch (selten auf Partys außer als bewusstes Tief)

Vermeide harte Stimmungsbrüche außer es ergibt einen klaren Story-Arc.

### Genre-Brücken

Du kannst:
- Im selben Genre bleiben (sicher)
- Sauber wechseln über einen "Brücken-Track" der Elemente beider verbindet
- Cross-Genre wechseln wenn Energy/Mood passen (z.B. House → Hip-Hop mit House-Vibe)

## Publikum richtig lesen

Schließe aus dem aktuellen Song auf das vermutliche Publikum:

- **Schlager / Ballermann**: Deutsche Party-Crowd, Hochzeiten, Familienfeiern. Mix von Schlager-Klassikern, 90er Hits, Mallorca-Style, deutsche Hits.
- **80er/90er-Hits**: Nostalgie-Publikum, Hochzeiten, Geburtstage (40-60 Jahre). Mix klassischer Hits dieser Epochen.
- **Hip-Hop/Rap**: Jüngeres Publikum, Club-Setting. Mainstream-Aktuelles und Classic Crossovers.
- **Electronic/House/Techno**: Club-Publikum, später Abend. Energie halten, fließend mixen.
- **Pop-Charts**: Gemischtes Publikum, breite Attraktivität. Sicher aber nicht langweilig.
- **Hochzeitsklassiker** (Atemlos, Ein Stern, Country Roads, Take Me Home): Ähnliches emotionales / Mitsing-Territorium.

## Wie gute DJ-Vorschläge aussehen

- **Großteils erkennbar**: Songs die die meisten Gäste kennen und auf die sie reagieren. Vermeide obskure Album-Tracks oder Nur-DJ-bekannte Remixe.
- **Mischung aus Sicherheit und Überraschung**: 4-5 offensichtlich-aber-effektive Picks + 1-2 inspirierte "darauf wär ich nicht gekommen, aber das passt!" Picks.
- **Vielfalt**: Nicht 6 Songs aus dem selben Jahr oder Genre. Spreize über das wahrscheinliche musikalische Territorium des Publikums.
- **Echte Songs**: Jeder Vorschlag muss ein realer Track sein der auf Spotify existiert. Erfinde nichts. Nutze den kanonischen Titel und Haupt-Künstler.
- **Kurze Begründung**: Ein knapper Satz auf Deutsch — was macht es zum guten Anschluss (Energie, Stimmung, Era, oder spezifischer Connection zum aktuellen Song).

## Was vermeiden

- ❌ Den gleichen Song nicht nochmal vorschlagen
- ❌ Songs vom selben Künstler wie der aktuelle Track (die zeigt die App schon separat)
- ❌ Obskure Tracks die niemand kennt
- ❌ Dramatische Off-Genre-Sprünge ohne klare Brückenlogik
- ❌ Duplikate untereinander (keine 2 Vorschläge die nahezu identisch sind)

## Output-Format (STRIKT befolgen)

Antworte mit **NUR validem JSON**, exakt diese Form:

\`\`\`
{
  "suggestions": [
    {
      "artist": "Künstler-Name (kanonisch, nur Haupt-Künstler — kein 'feat.' außer essenziell)",
      "title": "Track-Titel (kanonisch, keine Remix-Tags außer es ist DIE Version)",
      "why": "Ein deutscher Satz — warum das passt (Energie/Mood/Era/Connection)."
    }
  ]
}
\`\`\`

Genau 6 Einträge. KEIN Markdown, KEINE Kommentare vor oder nach dem JSON, KEINE Code-Fences in der Antwort. Beginne direkt mit der \`{\` und ende mit der \`}\`.`;

// Zod-Schema für die Validierung der Claude-Antwort
const SuggestionSchema = z.object({
  artist: z.string().min(1),
  title: z.string().min(1),
  why: z.string().min(1)
});

const SuggestionsSchema = z.object({
  suggestions: z.array(SuggestionSchema).min(1).max(8)
});

interface VerifiedTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover_url: string | null;
  duration_ms: number;
  why: string;
}

export async function POST(request: NextRequest) {
  // Auth-Schutz — nur eingeloggte DJs dürfen die API nutzen
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Nicht eingeloggt." },
      { status: 401 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "KI ist nicht konfiguriert (ANTHROPIC_API_KEY fehlt in den Vercel-Env-Vars)." },
      { status: 503 }
    );
  }

  let body: { title?: string; artist?: string; album?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  const { title, artist, album } = body;
  if (!title || !artist) {
    return NextResponse.json(
      { error: "title und artist sind Pflicht." },
      { status: 400 }
    );
  }

  // Claude fragen
  const client = getAnthropicClient();

  let claudeResponse;
  try {
    claudeResponse = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          // cache_control greift sobald der System-Prompt die Modell-spezifische
          // Mindestlänge erreicht (Opus 4.7: 4096 Tokens). Marker ist gesetzt,
          // damit Caching aktiv wird wenn wir den Prompt später erweitern.
          cache_control: { type: "ephemeral" }
        }
      ],
      messages: [
        {
          role: "user",
          content: `Aktuell läuft: "${title}" von ${artist}${album ? `\nAlbum: ${album}` : ""}\n\nGib mir 6 passende nächste Songs.`
        }
      ]
    });
  } catch (err) {
    console.error("Claude API error:", err);
    return NextResponse.json(
      {
        error: "KI nicht erreichbar",
        detail: err instanceof Error ? err.message : String(err)
      },
      { status: 502 }
    );
  }

  // Antwort-Text extrahieren
  const textBlock = claudeResponse.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json(
      { error: "Keine Text-Antwort von der KI erhalten." },
      { status: 500 }
    );
  }

  // JSON parsen — robust gegen vereinzelte Markdown-Wrapper
  let rawJson = textBlock.text.trim();
  if (rawJson.startsWith("```")) {
    rawJson = rawJson.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }

  let parsed: z.infer<typeof SuggestionsSchema>;
  try {
    parsed = SuggestionsSchema.parse(JSON.parse(rawJson));
  } catch (err) {
    console.error("AI response parse error:", err, "raw:", rawJson.slice(0, 500));
    return NextResponse.json(
      { error: "KI-Antwort hatte ungültiges Format." },
      { status: 502 }
    );
  }

  // Jeden Vorschlag bei Spotify verifizieren — parallel für Performance
  const verifiedResults = await Promise.all(
    parsed.suggestions.map(async (s): Promise<VerifiedTrack | null> => {
      // Erst gezielte Suche mit Feld-Operatoren
      try {
        const strict = await searchTracks(`track:"${s.title}" artist:"${s.artist}"`, 1);
        if (strict.length > 0) {
          return { ...strict[0], why: s.why };
        }
      } catch {}
      // Fallback: lockere Suche
      try {
        const loose = await searchTracks(`${s.title} ${s.artist}`, 1);
        if (loose.length > 0) {
          return { ...loose[0], why: s.why };
        }
      } catch {}
      return null;
    })
  );

  // Duplikate per Track-ID entfernen (falls Claude denselben Song doppelt vorschlägt)
  const seen = new Set<string>();
  const tracks: VerifiedTrack[] = [];
  for (const t of verifiedResults) {
    if (t && !seen.has(t.id)) {
      seen.add(t.id);
      tracks.push(t);
    }
  }

  return NextResponse.json({
    tracks,
    usage: {
      input_tokens: claudeResponse.usage.input_tokens,
      output_tokens: claudeResponse.usage.output_tokens,
      cache_read_tokens: claudeResponse.usage.cache_read_input_tokens ?? 0,
      cache_creation_tokens: claudeResponse.usage.cache_creation_input_tokens ?? 0
    }
  });
}
