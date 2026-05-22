// Client-seitiger Helper: Service Worker registrieren + Web-Push-Subscription
// auf dem Gerät des Gastes anlegen.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf;
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function subscribeForEvent(params: {
  eventId: string;
  sessionId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: "no_vapid" };

  // Permission anfragen
  if (Notification.permission === "default") {
    const result = await Notification.requestPermission();
    if (result !== "granted") return { ok: false, reason: "denied" };
  } else if (Notification.permission !== "granted") {
    return { ok: false, reason: "denied" };
  }

  const reg = await ensureServiceWorker();
  if (!reg) return { ok: false, reason: "sw_failed" };

  // Bestehende Subscription oder neue anlegen
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      const keyArray = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast nötig wegen TS-Strict-Mismatch zw. Uint8Array und BufferSource
        applicationServerKey: keyArray.buffer as ArrayBuffer
      });
    } catch {
      return { ok: false, reason: "subscribe_failed" };
    }
  }

  // An Backend schicken
  try {
    const json = sub.toJSON();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: params.sessionId,
        event_id: params.eventId,
        subscription: {
          endpoint: json.endpoint,
          keys: json.keys
        }
      })
    });
    if (!res.ok) return { ok: false, reason: "store_failed" };
  } catch {
    return { ok: false, reason: "store_failed" };
  }

  return { ok: true };
}
