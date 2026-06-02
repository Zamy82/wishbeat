"use client";

import { useEffect } from "react";
import { setLastEvent } from "@/lib/last-event";

interface Props {
  slug: string;
  name: string;
}

// Speichert beim Mount Slug+Name des aktuellen Events im localStorage.
// Die Landing-Page liest das spaeter, um einen "Zurueck zum Event"-Button
// anzuzeigen — wichtig fuer iPhone-Gaeste, die wishbeat als PWA installieren.
export default function LastEventTracker({ slug, name }: Props) {
  useEffect(() => {
    setLastEvent(slug, name);
  }, [slug, name]);
  return null;
}
