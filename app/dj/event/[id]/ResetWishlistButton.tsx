"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  eventId: string;
  hasData: boolean;
}

export default function ResetWishlistButton({ eventId, hasData }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/reset`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? "Konnte nicht zurückgesetzt werden.");
        setBusy(false);
        return;
      }
      setOpen(false);
      setBusy(false);
      // Seite neu laden, damit Wunschliste + Statistik frisch geladen werden
      router.refresh();
    } catch {
      setError("Netzwerk-Fehler. Bitte nochmal versuchen.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={!hasData}
        className="px-3 py-1.5 rounded-full border border-red-500/30 text-red-400/80 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/50 text-xs font-medium transition disabled:opacity-30 disabled:cursor-not-allowed"
        title={hasData ? "Alle Wünsche + Play-History dieses Events löschen" : "Nichts zu löschen"}
      >
        🗑 Wunschliste löschen
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-red-500/30 bg-zinc-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-2">
              Wirklich alles löschen?
            </h3>
            <p className="text-white/60 text-sm mb-4">
              Das löscht für dieses Event <strong className="text-white">unwiderruflich</strong>:
            </p>
            <ul className="text-white/70 text-sm space-y-1 mb-5 list-disc list-inside">
              <li>Alle Wünsche (offen, angenommen, gespielt, abgelehnt)</li>
              <li>Die komplette Play-History (Statistik startet bei 0)</li>
            </ul>
            <p className="text-white/40 text-xs mb-5">
              Bewertungen von Gästen bleiben erhalten.
            </p>

            {error && (
              <p className="text-red-400 text-sm mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="flex-1 px-4 py-3 rounded-2xl border border-white/20 text-white/80 hover:text-white hover:bg-white/5 text-sm font-medium transition disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleReset}
                disabled={busy}
                className="flex-1 px-4 py-3 rounded-2xl bg-red-500/80 hover:bg-red-500 text-white text-sm font-bold transition disabled:opacity-50 disabled:cursor-wait"
              >
                {busy ? "Lösche…" : "Ja, alles löschen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
