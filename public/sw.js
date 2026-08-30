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
