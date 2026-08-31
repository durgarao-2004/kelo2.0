import "server-only";
import webpush from "web-push";
import {
  listPushSubscriptions,
  deletePushSubscriptionByEndpoint,
  type PushSubscriptionRow,
} from "@/server/db/push";

export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** True only when every VAPID variable is actually set — callers must check
 * this before offering push in the UI or attempting to send, rather than
 * letting an unconfigured deployment silently no-op or throw deep in a
 * pipeline. */
export function getPushConfig(): PushConfig | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

let configured = false;
function ensureConfigured(config: PushConfig): void {
  if (configured) return;
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Path opened when the notification is tapped, e.g. "/dashboard". */
  url: string;
  tag?: string;
}

export interface PushSendResult {
  sent: number;
  expired: number;
  failed: number;
}

/**
 * Sends one push payload to every subscription a user has (one account can
 * have several — phone, laptop, installed PWA, ...). A 404/410 response means
 * the push service has permanently invalidated that subscription (uninstalled,
 * permission revoked, browser data cleared) — the row is deleted immediately
 * so we stop paying for and retrying dead endpoints. Never throws: a push
 * failure must never break the caller (lecture processing, attendance marking).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  const config = getPushConfig();
  const result: PushSendResult = { sent: 0, expired: 0, failed: 0 };
  if (!config) return result;
  ensureConfigured(config);

  const subs = await listPushSubscriptions(userId);
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub: PushSubscriptionRow) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
        result.sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          result.expired++;
          await deletePushSubscriptionByEndpoint(sub.endpoint).catch(() => {});
        } else {
          result.failed++;
        }
      }
    }),
  );

  return result;
}
