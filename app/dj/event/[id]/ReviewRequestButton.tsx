"use client";

import { useState } from "react";

interface Props {
  eventName: string;
  eventUrl: string;
}

// Bewertungs-Aufruf: fertige WhatsApp-Nachricht, die der DJ einen Tag nach dem
// Event an den Veranstalter schickt. Enthaelt einen weiterleitbaren Gaeste-Text
// mit dem Event-Link (Bewertung laeuft ueber dieselbe Event-Seite).

export default function ReviewRequestButton({ eventName, eventUrl }: Props) {
  const [copied, setCopied] = useState(false);

  const message =
    `🎉 ${eventName} war ein Fest — danke nochmal, dass ich dabei sein durfte!\n` +
    `Eine kleine Bitte: Magst du an die Gäste weiterleiten, dass sie den Abend kurz ` +
    `bewerten können? Das hilft mir riesig. Hier ein fertiger Text zum Weiterleiten 👇\n\n` +
    `⭐ Hat euch die Musik gefallen? Bewertet den Abend bei ${eventName} in 10 Sekunden ` +
    `— kein Konto nötig:\n` +
    `👉 ${eventUrl}\n\n` +
    `Danke dir! — Zamy`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  }

  function shareWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  return (
    <section className="mt-6 rounded-3xl border border-yellow-400/30 bg-gradient-to-br from-yellow-400/10 via-transparent to-transparent p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">⭐</span>
        <span className="text-xs uppercase tracking-widest text-yellow-300 font-semibold">
          Bewertungen einsammeln
        </span>
      </div>
      <p className="text-white text-sm font-semibold mb-1">
        Fertiger Aufruf für den Veranstalter
      </p>
      <p className="text-white/50 text-xs mb-4">
        Einen Tag nach dem Event an den Veranstalter schicken — er leitet den
        Bewertungs-Aufruf an die Gäste weiter. Der Link führt direkt zur
        Sterne-Bewertung. Hat bei anderen Events viele Bewertungen gebracht.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={shareWhatsApp}
          className="py-3 rounded-2xl bg-[#25D366] hover:bg-[#1eb858] text-white font-bold text-sm transition active:scale-95"
        >
          💬 An WhatsApp
        </button>
        <button
          type="button"
          onClick={copy}
          className="py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm transition active:scale-95"
        >
          {copied ? "✅ Kopiert!" : "📋 Kopieren"}
        </button>
      </div>

      <details className="mt-4">
        <summary className="text-white/40 hover:text-white/70 text-xs cursor-pointer transition">
          Vorschau der Nachricht
        </summary>
        <pre className="mt-3 rounded-2xl bg-black/40 border border-white/10 p-3 text-[11px] text-white/80 leading-relaxed overflow-x-auto whitespace-pre-wrap">
          {message}
        </pre>
      </details>
    </section>
  );
}
