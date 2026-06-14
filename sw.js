const CACHE_NAME = "lap-note-v10";
const FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/lap-logo-gray.png?v=20260614-1",
  "./assets/app-icon-180.png",
  "./assets/app-icon-192.png",
  "./assets/app-icon-512.png",
];

self.addEventListener("install", (event) => {
  const freshRequests = FILES.map((url) => new Request(url, { cache: "reload" }));
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(freshRequests)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then((cached) => cached || (event.request.mode === "navigate" ? caches.match("./index.html") : null)),
      ),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
