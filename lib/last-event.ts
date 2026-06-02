"use client";

// Merkt sich, auf welchem Event der Gast zuletzt war.
// Damit kann die Landing-Page beim iPhone-PWA-Start direkt
// einen "Zurueck zum Event"-Shortcut anbieten.

const STORAGE_KEY = "wishbeat:last-event";

export interface LastEvent {
  slug: string;
  name: string;
  ts: number;
}

export function setLastEvent(slug: string, name: string): void {
  if (typeof window === "undefined") return;
  try {
    const payload: LastEvent = { slug, name, ts: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage voll oder gesperrt — egal, kein Hard-Fail
  }
}

export function getLastEvent(): LastEvent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastEvent>;
    if (!parsed.slug || !parsed.name) return null;
    return {
      slug: parsed.slug,
      name: parsed.name,
      ts: typeof parsed.ts === "number" ? parsed.ts : 0
    };
  } catch {
    return null;
  }
}

export function clearLastEvent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
