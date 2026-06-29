"use client";

import { useEffect, useState } from "react";
import { isPushSupported, subscribeAsDj } from "@/lib/push-client";

// Kleines Opt-In-Banner damit der DJ Push-Benachrichtigungen
// fuer neue Wuensche aktivieren kann.

const DISMISS_KEY = "wishbeat_dj_push_dismissed";

type State = "checking" | "granted" | "denied" | "default" | "unsupported";

export default function DjPushOptIn() {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) {
      setState("unsupported");
      return;
    }
    setState(Notification.permission as State);

    if (typeof window !== "undefined") {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    }

    // Wenn schon erlaubt: still subscribe (refresh subscription)
    if (Notification.permission === "granted") {
      subscribeAsDj().catch(() => {});
    }
  }, []);

  async function enable() {
    setBusy(true);
    const result = await subscribeAsDj();
    setBusy(false);
    if (result.ok) {
      setState("granted");
    } else if (result.reason === "denied") {
      setState("denied");
    }
  }

  function dismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(DISMISS_KEY, "1");
    }
  }

  if (state === "checking" || state === "granted" || state === "unsupported") {
    return null;
  }
  if (dismissed) return null;

  return (
    <div className="rounded-2xl border border-neon-purple/40 bg-gradient-to-br from-neon-purple/15 to-neon-pink/5 p-4 mb-6 flex items-start gap-3">
      <span className="text-2xl flex-shrink-0">🔔</span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm">
          Push-Benachrichtigung für neue Wünsche & Bewertungen aktivieren
        </p>
        <p className="text-white/60 text-xs mt-1">
          Du bekommst eine Mitteilung auf den Browser/Handy sobald ein Gast einen
          Wunsch absendet oder dich bewertet — auch wenn die App im Hintergrund läuft.
        </p>
        <div className="flex items-center gap-2 mt-3">
          {state === "denied" ? (
            <span className="text-red-400 text-xs">
              Du hast Push abgelehnt. Aktivier&apos;s ggf. in den Browser-Einstellungen.
            </span>
          ) : (
            <>
              <button
                onClick={enable}
                disabled={busy}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-neon-pink to-neon-purple text-white text-xs font-bold disabled:opacity-50 hover:opacity-90 transition"
              >
                {busy ? "Aktiviere…" : "Aktivieren"}
              </button>
              <button
                onClick={dismiss}
                className="px-3 py-2 text-white/40 hover:text-white text-xs transition"
              >
                Später
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
