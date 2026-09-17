"use client";

import { useState } from "react";

interface Props {
  eventName: string;
  eventUrl: string;
}

// Vorab-Einladung: fertige WhatsApp-Nachricht, die der DJ VOR der Feier an den
// Veranstalter schickt. Enthaelt einen weiterleitbaren Gaeste-Text mit dem
// Event-Link, damit die Gaeste schon vorab Songs wuenschen (Gegenstueck zum
// Bewertungs-Aufruf nach der Feier).

export default function VorabInviteButton({ eventName, eventUrl }: Props) {
  const [copied, setCopied] = useState(false);

  const message =
    `🎉 Bei „${eventName}" sammle ich die Lieblingssongs schon vorab ein!\n` +
    `Magst du das an die Gäste weiterleiten? Hier ein fertiger Text 👇\n\n` +
    `🎶 ${eventName} — wünsch dir schon jetzt deine Party-Songs beim DJ!\n` +
    `Einfach auf den Link tippen, Song suchen, fertig. Jede/r darf bis zu 3 Songs ` +
    `— je öfter ein Song gewünscht wird, desto sicherer kommt er dran.\n` +
    `👉 ${eventUrl}\n\n` +
    `Freu mich auf euch! 🥳 — Zamy`;

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

  function downloadTxt() {
    const blob = new Blob([message], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = eventName
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-");
    a.download = `${safeName}-vorab-einladung.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mb-6 rounded-3xl border border-neon-pink/30 bg-gradient-to-br from-neon-pink/10 via-transparent to-transparent p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">🎶</span>
        <span className="text-xs uppercase tracking-widest text-neon-pink font-semibold">
          Vorab-Wünsche einsammeln
        </span>
      </div>
      <p className="text-white text-sm font-semibold mb-1">
        Fertige Einladung für den Veranstalter
      </p>
      <p className="text-white/50 text-xs mb-4">
        Schon vor der Feier an den Veranstalter schicken — er leitet den Aufruf an
        die Gäste weiter. Der Link führt direkt zum Wunsch-Feld, so kommen die
        ersten Songs rein, bevor die Party losgeht.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
        <button
          type="button"
          onClick={downloadTxt}
          className="py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm transition active:scale-95"
        >
          💾 Als .txt
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
