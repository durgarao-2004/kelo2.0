/**
 * In-app-only notifications: fires a browser Notification for events that
 * happen while KELO is open (lecture processing finished/failed). Never
 * requests permission itself — that only happens from an explicit user
 * click (see NotificationsToggle) — and silently no-ops if unsupported or
 * not granted, so this is always safe to call speculatively.
 *
 * Real background push (e.g. a timetable reminder firing with the tab
 * closed) needs VAPID keys, a subscriptions table, and a server-side
 * scheduler this stack doesn't have yet — out of scope here rather than
 * faking it with an unreliable client-only timer.
 */
export function notify(title: string, options?: NotificationOptions): void {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, options);
  } catch {
    // Some browsers (notably iOS Safari outside a service-worker context)
    // can throw here even when permission is "granted" — never let a
    // notification failure break the feature it's attached to.
  }
}
