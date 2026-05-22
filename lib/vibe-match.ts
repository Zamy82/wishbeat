// Vibe-Match: Wie gut passt ein Wunschsong zur aktuellen Stimmung?
//
// Idee: Spotify liefert pro Kuenstler eine Liste Genre-Tags wie
// ["german hip hop", "deep house", "atl rap"]. Wir zerlegen die Tags
// in einzelne Woerter und vergleichen die Wortmenge des Wunsches mit
// einer gewichteten Wortmenge der zuletzt gespielten Songs.
//
// Beispiel:
//   Vibe der letzten Plays:  hip(5) hop(5) german(3) trap(2) rap(2)
//   Wunsch-Genres:           ["pop rap", "german rap"]
//   Wunsch-Woerter:          pop, rap, german
//   "rap"   → vibe 2 / max 5 = 0.4
//   "german"→ vibe 3 / max 5 = 0.6
//   "pop"   → 0
//   Mittel: (0.4 + 0.6 + 0) / 3 = 0.33 → 33% Match
//
// Vorteil dieses Ansatzes: keine starren Strings, "hip hop" matcht
// "german hip hop" automatisch ueber die geteilten Woerter.

// Allgemeine, nicht-aussagekraeftige Woerter aus Tags rausfiltern
const STOP_WORDS = new Set([
  "music",
  "the",
  "of",
  "and",
  "a",
  "an",
  "with"
]);

export function tokenize(genres: string[]): string[] {
  const tokens = new Set<string>();
  for (const g of genres) {
    if (!g) continue;
    for (const word of g.toLowerCase().split(/\s+/)) {
      const clean = word.trim();
      if (clean.length < 2) continue;
      if (STOP_WORDS.has(clean)) continue;
      tokens.add(clean);
    }
  }
  return Array.from(tokens);
}

// Gewichteter Vibe: zaehlt pro Wort, wie oft es in den letzten Plays vorkam.
// Frische Plays am Ende koennen optional staerker gewichtet werden, hier
// erstmal alle gleich (V1).
export function computeVibeTokens(
  playsGenres: (string[] | null | undefined)[]
): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const list of playsGenres) {
    if (!list || list.length === 0) continue;
    const tokens = tokenize(list);
    for (const t of tokens) {
      weights[t] = (weights[t] ?? 0) + 1;
    }
  }
  return weights;
}

export interface MatchResult {
  percent: number;
  matchedWords: string[];
  totalWords: number;
}

// Liefert null wenn nicht genug Daten fuer eine sinnvolle Aussage da sind.
export function matchPercent(
  wishGenres: string[] | null | undefined,
  vibeTokens: Record<string, number>
): MatchResult | null {
  if (!wishGenres || wishGenres.length === 0) return null;
  const wishTokens = tokenize(wishGenres);
  if (wishTokens.length === 0) return null;

  const vibeValues = Object.values(vibeTokens);
  if (vibeValues.length === 0) return null;
  const vibeMax = Math.max(...vibeValues);
  if (vibeMax === 0) return null;

  let sum = 0;
  const matched: string[] = [];
  for (const t of wishTokens) {
    const w = vibeTokens[t] ?? 0;
    if (w > 0) matched.push(t);
    sum += w / vibeMax;
  }
  const percent = Math.round((sum / wishTokens.length) * 100);
  return {
    percent: Math.max(0, Math.min(100, percent)),
    matchedWords: matched,
    totalWords: wishTokens.length
  };
}

// Farb-/Label-Helper fuer UI
export function matchTone(percent: number): "high" | "mid" | "low" {
  if (percent >= 70) return "high";
  if (percent >= 30) return "mid";
  return "low";
}
