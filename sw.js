// CVA Dropship Service Worker
const CACHE_NAME = "cva-dropship-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon.svg"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS).catch(()=>{}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Don't cache GAS API calls — always network
  if (url.hostname.includes("script.google.com") ||
      url.hostname.includes("grupocva.com") ||
      url.hostname.includes("mercadolibre.com")) {
    return;
  }

  // Network-first for HTML/JS (app updates), cache fallback if offline
  if (e.request.destination === "document" || url.pathname.endsWith(".js")) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const clone = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(()=>{});
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for icons/static
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});