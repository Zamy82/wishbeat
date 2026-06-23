"use client";

import { useEffect, useRef, useState } from "react";

// AutoReload — pollt /api/version. Wenn der Build-Hash sich aendert,
// laedt die Seite automatisch neu. Damit der User nach einem Deploy
// die neue Version sieht, ohne F5 zu druecken.
//
// Verhalten:
//  - Polling alle 45s, nur wenn Tab sichtbar
//  - Bei Tab-Wechsel (Hintergrund -> Vordergrund) sofort check
//  - Bei Hash-Aenderung: kurze Notification + Reload nach 1.8s

export default function AutoReload({
  pollMs = 45_000
}: {
  pollMs?: number;
}) {
  const initial = useRef<string | null>(null);
  const reloadTriggered = useRef(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let mounted = true;
    let reloadTimer: number | null = null;

    async function check() {
      if (!mounted || reloadTriggered.current) return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        const v = data.version;
        if (!v) return;
        if (initial.current === null) {
          initial.current = v;
          return;
        }
        if (initial.current !== v) {
          reloadTriggered.current = true;
          setUpdating(true);
          reloadTimer = window.setTimeout(() => {
            window.location.reload();
          }, 1800);
        }
      } catch {
        // Netzwerkfehler ignorieren — beim naechsten Poll erneut versuchen
      }
    }

    check();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") check();
    }, pollMs);

    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
      if (reloadTimer !== null) window.clearTimeout(reloadTimer);
    };
  }, [pollMs]);

  if (!updating) return null;

  return (
    <div
      className="no-print fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl bg-gradient-to-r from-neon-pink to-neon-purple text-white text-sm font-semibold shadow-2xl flex items-center gap-2"
      role="status"
      aria-live="polite"
    >
      <span className="inline-block animate-spin">🔄</span>
      Neue Version — wird geladen…
    </div>
  );
}
