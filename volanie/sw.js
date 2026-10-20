// plainkit. volanie — offline cache. Žiadne požiadavky mimo plainkit.app.
const C = 'pk-volanie-v1';
const CORE = ['/volanie/', '/volanie/manifest.json', '/volanie/icon-192.png', '/volanie/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('pk-volanie-') && k !== C).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Sieť najprv (aby aktualizácie prišli hneď), pri výpadku cache.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); }
      return r;
    }).catch(() => caches.match(e.request))
  );
});
