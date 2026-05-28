// plainkit service worker
// Exists ONLY so the site can be installed to the home screen.
// It caches NOTHING and tracks NOTHING — every request goes straight to the network.
// (Consistent with plainkit's "no tracking" promise: no content, no chat, nothing is stored here.)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  // A fetch handler is required for installability; this one just forwards to the network.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request));
  }
});
