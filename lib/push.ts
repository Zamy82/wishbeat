// Web-Push Helper — server-only.
// Verwendet web-push Library mit VAPID-Signing.

import webpush from "web-push";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID environment variables not set");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  url?: string;
  tag?: string;
}

export async function sendPush(
  sub: PushSubscriptionData,
  payload: PushPayload
): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
  ensureConfigured();
  try {
    const result = await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      },
      JSON.stringify(payload)
    );
    return { ok: true, statusCode: result.statusCode };
  } catch (err) {
    const e = err as { statusCode?: number; body?: string; message?: string };
    return {
      ok: false,
      statusCode: e.statusCode,
      error: e.body ?? e.message ?? String(err)
    };
  }
}
