"use client";

/** Web Push requires the VAPID public key as a raw Uint8Array, but it's
 * distributed/stored as a URL-safe base64 string. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export type PushCapability = "unsupported" | "supported";

export function getPushCapability(): PushCapability {
  if (typeof window === "undefined") return "unsupported";
  const supported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined";
  return supported ? "supported" : "unsupported";
}

/**
 * Subscribes this browser to Web Push and registers it with the server,
 * tied to the signed-in user via the session cookie (see
 * /api/push/subscribe). Requires notification permission to already be
 * granted — callers request that separately so the permission prompt and
 * the subscribe step stay two clearly separate, observable actions.
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!res.ok) throw new Error("subscribe_failed");
}

/** Unsubscribes locally and tells the server to forget this device. Never
 * throws — if either half fails the user can just try again; there's no
 * partial state worth rolling back. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => {});
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
}

export async function hasActivePushSubscription(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return Boolean(subscription);
  } catch {
    return false;
  }
}
