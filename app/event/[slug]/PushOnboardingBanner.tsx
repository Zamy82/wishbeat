"use client";

import { useEffect, useState } from "react";
import { subscribeForEvent, isPushSupported } from "@/lib/push-client";
import { getGuestSessionId } from "@/lib/guest-session";

type BrowserKind = "samsung" | "chrome" | "firefox" | "other";

function detectBrowser(): BrowserKind {
  if (typeof window === "undefined") return "other";
  const ua = window.navigator.userAgent;
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/Firefox|FxiOS/i.test(ua)) return "firefox";
  if (/Chrome|CriOS/i.test(ua)) return "chrome";
  return "other";
}

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

  // State beim Mount ermitteln + Auto-Detect wenn Permission sich extern aendert
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!isPushSupported()) {
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

    function refresh() {
      const perm = Notification.permission;
      if (perm === "granted") setState({ kind: "granted" });
      else if (perm === "denied") setState({ kind: "denied" });
      else setState({ kind: "default" });
    }
    refresh();

    // Permissions-API: feuert "change"-Event sobald der User in den
    // Browser-Settings die Berechtigung freischaltet — Banner aktualisiert
    // sich dann automatisch ohne Reload.
    let perm: PermissionStatus | null = null;
    (async () => {
      try {
        perm = await navigator.permissions.query({ name: "notifications" as PermissionName });
        perm.addEventListener("change", refresh);
      } catch {}
    })();

    // Backup: bei Visibility-Change auch nochmal pruefen
    function onVisibilityChange() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (perm) perm.removeEventListener("change", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
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

      {state.kind === "denied" && (
        <DeniedReset onRetry={activate} />
      )}

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

function DeniedReset({ onRetry }: { onRetry: () => void }) {
  const [browser, setBrowser] = useState<BrowserKind>("other");
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);

  useEffect(() => {
    setBrowser(detectBrowser());
  }, []);

  async function handleRetry() {
    setRetrying(true);
    setRetryFailed(false);
    // Notification.permission neu auslesen (falls extern geaendert)
    if (Notification.permission === "granted") {
      onRetry();
      return;
    }
    // Erneut anfragen — wenn schon denied returnt Browser sofort denied
    try {
      const result = await Notification.requestPermission();
      if (result === "granted") {
        onRetry();
      } else {
        setRetryFailed(true);
      }
    } catch {
      setRetryFailed(true);
    } finally {
      setRetrying(false);
    }
  }

  const steps: Record<BrowserKind, { title: string; steps: React.ReactNode[] }> = {
    samsung: {
      title: "Samsung Internet",
      steps: [
        <>Unten rechts auf <strong className="text-white">3-Striche-Menü ☰</strong> tippen</>,
        <>→ <strong className="text-white">Einstellungen</strong> (Zahnrad)</>,
        <>→ <strong className="text-white">Websites und Downloads</strong></>,
        <>→ <strong className="text-white">Site-Berechtigungen</strong> → <strong className="text-white">Benachrichtigungen</strong></>,
        <>Suche <code className="bg-white/10 px-1 rounded text-[10px]">wishbeat-zamy82-s-projects.vercel.app</code> → <strong className="text-white">tippen</strong> → auf <strong className="text-white">„Zulassen"</strong> umstellen</>,
        <>Komm hier zurück und tipp den Button unten</>
      ]
    },
    chrome: {
      title: "Chrome",
      steps: [
        <>Tippe oben auf das <strong className="text-white">Schloss-Symbol 🔒</strong> neben der URL</>,
        <>→ <strong className="text-white">„Berechtigungen"</strong> (oder „Einstellungen")</>,
        <>→ <strong className="text-white">„Benachrichtigungen"</strong> → von <strong className="text-white">„Blockiert"</strong> auf <strong className="text-white">„Zulassen"</strong></>,
        <>Seite neu laden (Pfeil-Kreis oben rechts)</>,
        <>Komm hier zurück und tipp den Button unten</>
      ]
    },
    firefox: {
      title: "Firefox",
      steps: [
        <>Tippe auf das <strong className="text-white">Schloss-Symbol 🔒</strong> neben der URL</>,
        <>→ <strong className="text-white">„Berechtigungen verwalten"</strong></>,
        <>→ <strong className="text-white">„Benachrichtigungen"</strong> entsperren</>,
        <>Seite neu laden</>,
        <>Komm hier zurück und tipp den Button unten</>
      ]
    },
    other: {
      title: "Dein Browser",
      steps: [
        <>Tippe oben auf das <strong className="text-white">Schloss-Symbol 🔒</strong> oder die <strong className="text-white">drei Punkte</strong></>,
        <>Suche nach <strong className="text-white">„Berechtigungen"</strong> oder <strong className="text-white">„Site-Einstellungen"</strong></>,
        <>Setze <strong className="text-white">„Benachrichtigungen"</strong> auf <strong className="text-white">„Zulassen"</strong></>,
        <>Seite neu laden</>,
        <>Komm hier zurück und tipp den Button unten</>
      ]
    }
  };

  const guide = steps[browser];

  return (
    <div>
      <div className="text-center mb-3">
        <div className="text-3xl mb-1">🔕</div>
        <h3 className="text-white font-bold">Push ist blockiert</h3>
        <p className="text-white/50 text-[11px]">
          Erkannt: <span className="text-white/70">{guide.title}</span>
          {" · "}folge der Anleitung dann tipp den Button unten
        </p>
      </div>
      <ol className="space-y-2 text-xs">
        {guide.steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2 rounded-xl bg-white/5 p-2.5">
            <span className="text-neon-cyan font-bold text-sm flex-shrink-0">{i + 1}.</span>
            <span className="text-white/80 flex-1">{step}</span>
          </li>
        ))}
      </ol>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="w-full mt-3 py-3 rounded-2xl bg-gradient-to-r from-neon-pink to-neon-purple text-white font-bold text-sm shadow-lg active:scale-95 transition disabled:opacity-50"
      >
        {retrying ? "⏳ Prüfe…" : "✅ Hab's gemacht — Push aktivieren"}
      </button>
      {retryFailed && (
        <p className="text-yellow-300 text-[11px] mt-2 text-center">
          Noch blockiert. Hast du Browser danach <strong>komplett geschlossen</strong> und neu geöffnet?
          Manchmal ist das nötig.
        </p>
      )}
      <p className="text-white/30 text-[10px] mt-3 text-center">
        💡 Schneller: Eine andere Person hat dieses Problem nicht — du nur weil du heute schon getestet hast.
      </p>
    </div>
  );
}
