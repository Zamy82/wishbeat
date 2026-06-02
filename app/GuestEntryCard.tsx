"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLastEvent, type LastEvent } from "@/lib/last-event";
import QrScanButton from "./QrScanButton";

// Gast-Einstieg auf der Landing-Page:
// - Wenn letztes Event bekannt: Shortcut zurueck
// - Plus QR-Scan-Button (oeffnet Live-Kamera-Scanner in der App).
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

      {/* Echter QR-Scanner in der App — kein Wechsel mehr in den Browser */}
      <QrScanButton />

      <p className="text-white/30 text-[11px] text-center px-2 leading-relaxed">
        Funktioniert der Scanner nicht? Du kannst auch jederzeit die Kamera-App
        deines Handys benutzen.
      </p>
    </div>
  );
}
