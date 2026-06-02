"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLastEvent, type LastEvent } from "@/lib/last-event";

// Gast-Einstieg auf der Landing-Page:
// - Wenn letztes Event bekannt: Shortcut zurueck
// - Sonst Hinweis QR-Code mit Kamera-App scannen
// Zeigt nichts beim SSR (vermeidet Hydration-Mismatch), erst nach Mount.
export default function GuestEntryCard() {
  const [last, setLast] = useState<LastEvent | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLast(getLastEvent());
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-full max-w-md h-32" aria-hidden />;
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-3">
      {last && (
        <Link
          href={`/event/${last.slug}`}
          className="block rounded-3xl border border-neon-cyan/40 bg-neon-cyan/10 p-5 text-left hover:bg-neon-cyan/15 transition active:scale-[0.98]"
        >
          <p className="text-[10px] uppercase tracking-widest text-neon-cyan/80 mb-1 font-semibold">
            🎵 Dein letztes Event
          </p>
          <p className="text-white font-bold text-xl truncate">{last.name}</p>
          <p className="text-white/60 text-xs mt-1">
            Tippen, um Wünsche zu senden →
          </p>
        </Link>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-left">
        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2 font-semibold">
          📷 {last ? "Anderes Event?" : "Du bist Gast auf einer Party?"}
        </p>
        <p className="text-white/80 text-sm leading-relaxed">
          Öffne die <strong className="text-white">Kamera-App</strong> auf deinem
          Handy und richte sie auf den QR-Code am Tisch oder beim DJ.
        </p>
        <p className="text-white/40 text-xs mt-2">
          Der QR öffnet dein Event automatisch — kein Suchen, kein Eintippen.
        </p>
      </div>
    </div>
  );
}
