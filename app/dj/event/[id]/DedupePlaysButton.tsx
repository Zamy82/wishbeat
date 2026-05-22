"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  eventId: string;
}

// Loescht doppelte event_plays-Eintraege (gleicher Song innerhalb 3 Min).
// Wuensche bleiben unberuehrt. Nuetzlich nach Testphase wo viele Hard-
// Refreshs zu Duplikat-Plays gefuehrt haben.
export default function DedupePlaysButton({ eventId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleDedupe() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/events/${eventId}/dedupe-plays`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setMsg(`Fehler: ${data.message ?? "unbekannt"}`);
      } else if (data.removed === 0) {
        setMsg("Keine Duplikate gefunden — Statistik ist sauber.");
      } else {
        setMsg(`${data.removed} Doppel-Plays entfernt (${data.kept} behalten).`);
        router.refresh();
      }
    } catch {
      setMsg("Netzwerk-Fehler.");
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 6000);
    }
  }

  return (
    <>
      <button
        onClick={handleDedupe}
        disabled={busy}
        className="px-3 py-1.5 rounded-full border border-yellow-500/30 text-yellow-400/80 hover:text-yellow-300 hover:bg-yellow-500/10 hover:border-yellow-500/50 text-xs font-medium transition disabled:opacity-50"
        title="Doppelte Plays entfernen (gleicher Song innerhalb 3 Min)"
      >
        {busy ? "Räume auf…" : "🧹 Statistik aufräumen"}
      </button>
      {msg && (
        <span className="text-xs text-white/60 self-center">{msg}</span>
      )}
    </>
  );
}
