// Minimal, conservative service worker: exists mainly to satisfy PWA
// installability criteria (manifest + active service worker). It
// deliberately does NOT cache any authenticated/dynamic (app) route —
// caching per-user server-rendered pages in a shared browser cache risks
// serving stale or even another-session's data. It only ever falls back to
// the public landing page when a navigation fails while fully offline.
const CACHE_NAME = "kelo-shell-v1";
const SHELL_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(SHELL_URL))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).catch(
      () => caches.match(SHELL_URL).then((res) => res || new Response("Offline", { status: 503 })),
    ),
  );
});

// ---------------------------------------------------------------------------
// Web Push — real background notifications (see src/server/push/send.ts,
// which is the only thing that ever sends a push, and always to this exact
// user's own subscriptions). Payload shape: { title, body, url, tag }.
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let payload = { title: "KELO", body: "" , url: "/dashboard" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Malformed/empty payload — still show a minimal notification rather
    // than silently dropping a push the user was expecting.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "KELO", {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag,
      data: { url: payload.url || "/dashboard" },
    }),
  );
});

// Tapping the notification focuses an already-open KELO tab if there is one
// (navigating it to the target page) instead of always opening a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            return client.focus().then(() => {
              if ("navigate" in client) return client.navigate(targetUrl);
            });
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
