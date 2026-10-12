/*
 * Service worker de l'application (site vitrine et back-office). Objectif : que l'appli terrain
 * s'ouvre sur un chantier sans réseau. Les saisies elles-mêmes sont gardées par l'application
 * (IndexedDB) et envoyées au retour du réseau ; ici, on garde seulement l'application :
 * - pages : réseau d'abord, sinon la dernière page d'accueil gardée (le routeur React prend le relais) ;
 * - /assets/ (fichiers à nom unique par version) : gardés à la première lecture ;
 * - /api/ : jamais gardé ici (données à jour, droits vérifiés par le serveur).
 */
const SHELL = "borom-shell-v1";
const ASSETS = "borom-assets-v1";
const MAX_ASSETS = 80;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(["/admin", "/manifest.webmanifest", "/favicon.ico"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, ASSETS].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(key);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/storage/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL).then((cache) => cache.put("/admin", copy));
          }
          return response;
        })
        .catch(() => caches.open(SHELL).then((cache) => cache.match("/admin")).then((r) => r ?? Response.error())),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) { await cache.put(request, response.clone()); void trim(cache); }
        return response;
      }),
    );
    return;
  }

  // Autres fichiers (icônes, manifeste) : la version gardée tout de suite, rafraîchie en arrière-plan.
  event.respondWith(
    caches.open(SHELL).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request).then((response) => { if (response.ok) cache.put(request, response.clone()); return response; }).catch(() => cached);
      return cached ?? network;
    }),
  );
});
