"use client";

import { useEffect, useState } from "react";
import { subscribeForEvent, isPushSupported } from "@/lib/push-client";
import { getGuestSessionId } from "@/lib/guest-session";

type State =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "ios_needs_pwa" }
  | { kind: "default" } // Permission noch nicht gefragt
  | { kind: "denied" }
  | { kind: "granted" }
  | { kind: "activating" }
  | { kind: "error"; reason: string };

interface Props {
  eventId: string;
}

export default function PushOnboardingBanner({ eventId }: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [collapsed, setCollapsed] = useState(false);
  const [testFiring, setTestFiring] = useState(false);

  // State beim Mount ermitteln
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!isPushSupported()) {
      // iOS-Safari ohne PWA-Install hat keine PushAPI im normalen Browser
      const ua = window.navigator.userAgent;
      const isIos = /iPhone|iPad|iPod/i.test(ua);
      if (isIos) {
        interface NavWithStandalone extends Navigator { standalone?: boolean }
        const isStandalone =
          (window.navigator as NavWithStandalone).standalone === true ||
          window.matchMedia("(display-mode: standalone)").matches;
        if (!isStandalone) {
          setState({ kind: "ios_needs_pwa" });
          return;
        }
      }
      setState({ kind: "unsupported" });
      return;
    }

    const perm = Notification.permission;
    if (perm === "granted") setState({ kind: "granted" });
    else if (perm === "denied") setState({ kind: "denied" });
    else setState({ kind: "default" });
  }, []);

  async function activate() {
    setState({ kind: "activating" });
    const sessionId = getGuestSessionId();
    const result = await subscribeForEvent({ eventId, sessionId });
    if (result.ok) {
      setState({ kind: "granted" });
    } else if (result.reason === "denied") {
      setState({ kind: "denied" });
    } else {
      setState({ kind: "error", reason: result.reason ?? "unbekannt" });
    }
  }

  function fireTestPush() {
    if (typeof window === "undefined") return;
    if (Notification.permission !== "granted") return;
    setTestFiring(true);
    try {
      const n = new Notification("🎵 Test-Push", {
        body: "Wenn du das siehst, klappt's beim echten Song auch!",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "test-push"
      });
      n.onclick = () => { n.close(); window.focus(); };
    } catch {}
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate([180, 80, 180]); } catch {}
    }
    setTimeout(() => setTestFiring(false), 1500);
  }

  // Wenn aktiv und kollabiert: nur ein winziges grünes Pille zeigen
  if (state.kind === "granted" && collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-full max-w-md mb-4 px-4 py-2 rounded-full bg-green-500/15 border border-green-500/40 text-green-300 text-xs font-medium flex items-center justify-between"
      >
        <span>🔔 Push ist aktiv — du wirst benachrichtigt wenn dein Song läuft</span>
        <span className="text-green-400/60">▾</span>
      </button>
    );
  }

  // Bei "unsupported" gar nichts zeigen — Browser kann's einfach nicht
  if (state.kind === "unsupported" || state.kind === "loading") {
    return null;
  }

  return (
    <section className="w-full max-w-md mb-4 rounded-3xl border p-4 bg-gradient-to-br border-white/10 from-zinc-900/80 to-purple-950/30">
      {state.kind === "ios_needs_pwa" && <IosInstall />}

      {state.kind === "default" && (
        <DefaultPrompt onActivate={activate} />
      )}

      {state.kind === "activating" && (
        <div className="text-center py-3">
          <p className="text-white/80 text-sm">⏳ Push wird aktiviert…</p>
        </div>
      )}

      {state.kind === "granted" && (
        <GrantedState
          onTest={fireTestPush}
          testFiring={testFiring}
          onCollapse={() => setCollapsed(true)}
        />
      )}

      {state.kind === "denied" && <DeniedReset />}

      {state.kind === "error" && (
        <div className="text-center">
          <p className="text-red-300 text-sm">
            🔕 Push konnte nicht aktiviert werden ({state.reason}).
          </p>
        </div>
      )}
    </section>
  );
}

function DefaultPrompt({ onActivate }: { onActivate: () => void }) {
  return (
    <div className="text-center">
      <div className="text-3xl mb-2">🔔</div>
      <h3 className="text-white font-bold mb-1">Push-Nachricht aktivieren?</h3>
      <p className="text-white/60 text-xs leading-relaxed mb-4">
        Wir geben dir Bescheid sobald dein Wunschsong läuft —
        auch wenn du draußen bist oder die App geschlossen hast.
      </p>
      <button
        onClick={onActivate}
        className="w-full py-3 rounded-2xl bg-gradient-to-r from-neon-pink to-neon-purple text-white font-bold text-sm shadow-lg active:scale-95 transition"
      >
        🔔 Jetzt aktivieren
      </button>
      <p className="text-white/30 text-[10px] mt-2">
        Der Browser fragt dich gleich — tipp auf „Erlauben"
      </p>
    </div>
  );
}

function IosInstall() {
  return (
    <div>
      <div className="text-center mb-3">
        <div className="text-3xl mb-1">📲</div>
        <h3 className="text-white font-bold">iPhone: 3 Schritte für Push</h3>
        <p className="text-white/50 text-xs">
          Apple lässt Push-Nachrichten nur durch, wenn du wishbeat als App installierst.
          Dauert 15 Sekunden.
        </p>
      </div>
      <ol className="space-y-2 text-sm">
        <li className="flex items-start gap-2 rounded-xl bg-white/5 p-3">
          <span className="text-neon-cyan font-bold">1.</span>
          <span className="text-white/80 flex-1">
            Tippe unten in Safari auf das <strong className="text-white">Teilen-Symbol</strong>{" "}
            <span className="inline-block px-1.5 py-0.5 rounded bg-white/10 text-white text-[10px] font-mono">⬆</span>{" "}
            (Quadrat mit Pfeil nach oben)
          </span>
        </li>
        <li className="flex items-start gap-2 rounded-xl bg-white/5 p-3">
          <span className="text-neon-cyan font-bold">2.</span>
          <span className="text-white/80 flex-1">
            Scrolle nach unten → tippe{" "}
            <strong className="text-white">„Zum Home-Bildschirm"</strong> → oben rechts{" "}
            <strong className="text-white">„Hinzufügen"</strong>
          </span>
        </li>
        <li className="flex items-start gap-2 rounded-xl bg-white/5 p-3">
          <span className="text-neon-cyan font-bold">3.</span>
          <span className="text-white/80 flex-1">
            Schließe Safari komplett → öffne wishbeat über das neue{" "}
            <strong className="text-white">Home-Screen-Icon</strong>
          </span>
        </li>
      </ol>
      <p className="text-white/30 text-[10px] mt-3 text-center">
        Ohne Home-Screen-Install kommt von Apple aus keine Push durch — egal welche Einstellung.
      </p>
    </div>
  );
}

function GrantedState({
  onTest,
  testFiring,
  onCollapse
}: {
  onTest: () => void;
  testFiring: boolean;
  onCollapse: () => void;
}) {
  return (
    <div className="text-center">
      <div className="text-3xl mb-2">✅</div>
      <h3 className="text-white font-bold mb-1">Push aktiviert!</h3>
      <p className="text-white/60 text-xs mb-3">
        Du wirst benachrichtigt, sobald dein Wunschsong läuft — auch wenn die App zu ist.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onTest}
          disabled={testFiring}
          className="py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs border border-white/20 transition disabled:opacity-50"
        >
          {testFiring ? "📨 …" : "📨 Test-Push"}
        </button>
        <button
          onClick={onCollapse}
          className="py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 font-medium text-xs border border-white/10 transition"
        >
          Einklappen
        </button>
      </div>
    </div>
  );
}

function DeniedReset() {
  return (
    <div>
      <div className="text-center mb-3">
        <div className="text-3xl mb-1">🔕</div>
        <h3 className="text-white font-bold">Push ist blockiert</h3>
        <p className="text-white/60 text-xs">
          Du hast Benachrichtigungen früher mal abgelehnt. Reset in 30 Sekunden:
        </p>
      </div>
      <ol className="space-y-1.5 text-xs text-white/70">
        <li>1. Tippe oben auf das <strong className="text-white">Schloss-Symbol 🔒</strong> neben der URL</li>
        <li>2. <strong className="text-white">„Cookies und Site-Daten" / „Berechtigungen"</strong></li>
        <li>3. <strong className="text-white">„Zurücksetzen"</strong> oder Eintrag löschen</li>
        <li>4. Browser schließen, neu öffnen, Seite nochmal aufrufen</li>
        <li>5. Hier zurück → diesmal kommt der Erlauben-Dialog</li>
      </ol>
    </div>
  );
}
