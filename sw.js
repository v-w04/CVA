// CVA Dropship Service Worker
// IMPORTANTE: bumpear CACHE_NAME cada vez que cambie esta lógica para
// forzar invalidación. app.js e index.html NO se cachean — siempre red.
const CACHE_NAME = "cva-dropship-v7";
const STATIC_ASSETS = [
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon.svg"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS).catch(()=>{}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  // Eliminar TODOS los caches viejos (incluso de versiones anteriores que
  // pudieran tener app.js o index.html guardados).
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
     .then(() => self.clients.matchAll().then(clients => {
       // Avisar a los clientes para que recarguen y tomen la nueva versión
       clients.forEach(c => c.postMessage({ type: "SW_UPDATED", version: CACHE_NAME }));
     }))
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // No cachear nunca llamadas a APIs externas
  if (url.hostname.includes("script.google.com") ||
      url.hostname.includes("grupocva.com") ||
      url.hostname.includes("mercadolibre.com") ||
      url.hostname.includes("corsproxy.io")) {
    return;
  }

  // app.js y index.html (y cualquier .html / .js) → SIEMPRE red, nunca cache
  // (esto evita que se quede pegado con versiones viejas)
  if (e.request.destination === "document" ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".html") ||
      url.pathname.endsWith("/")) {
    e.respondWith(
      fetch(e.request).catch(() => {
        // Solo en offline absoluto, intentar cache como último recurso
        return caches.match(e.request);
      })
    );
    return;
  }

  // Cache-first para íconos y estáticos (manifest, png, svg)
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
