// plainkit. service worker
//
// Kým na domovskej stránke nestlačíš „Stiahnuť pre použitie offline", NIČ neukladá —
// každá požiadavka ide rovno do siete, presne ako doteraz.
//
// Po stiahnutí:
//   • sieť najprv → aktualizácie prídu hneď, keď si online,
//   • keď sieť nie je (alebo neodpovie do 4 s), použije sa kópia uložená v tomto prehliadači.
//
// Ukladajú sa len verejné súbory webu z plainkit.app (HTML, skripty, fonty) — nikdy tvoj obsah.
// Tento súbor nerobí žiadne požiadavky mimo plainkit.app a nič nikam neposiela.
// Zoznam stiahnutých súborov je v index.html (OFFLINE_CORE / OFFLINE_HEAVY).

const CACHE = 'pk-offline';
const TIMEOUT_MS = 4000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // cudzie domény: nezasahujeme
  if (url.pathname.startsWith('/api/')) return;        // serverové funkcie: nikdy z cache
  if (req.headers.has('range')) return;                // čiastočné požiadavky (média): nechať prehliadaču
  e.respondWith(handle(e, req, url));
});

async function handle(e, req, url) {
  // Nič nestiahnuté → správanie ako predtým: len sieť.
  if (!(await caches.has(CACHE))) return fetch(req);

  const cache = await caches.open(CACHE);
  const isNav = req.mode === 'navigate';
  try {
    const res = await withTimeout(fetch(req), TIMEOUT_MS);
    // Udržuj offline kópiu čerstvú, ale len pre súbory, ktoré už v nej sú.
    if (res.ok && res.type === 'basic') e.waitUntil(refresh(cache, req, url, res.clone(), isNav));
    return res;
  } catch (err) {
    if (isNav) return offlineNavigation(cache, url);
    const hit = await cache.match(req, { ignoreSearch: true });
    return hit || Response.error();
  }
}

function withTimeout(p, ms) {
  return new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error('timeout')), ms);
    p.then((r) => { clearTimeout(t); ok(r); }, (er) => { clearTimeout(t); ko(er); });
  });
}

async function refresh(cache, req, url, res, isNav) {
  try {
    const key = isNav ? new URL(res.url || req.url).pathname : req.url;
    const old = await cache.match(key, { ignoreSearch: true });
    if (!old) return;                                   // nie je v offline zozname → neukladať
    const etag = res.headers.get('etag');
    if (!isNav && (!etag || etag === old.headers.get('etag'))) return; // nezmenené (šetrí zápis veľkých súborov)
    if (isNav && etag && etag === old.headers.get('etag')) return;
    await cache.put(key, new Response(await res.blob(), { status: 200, headers: cleanHeaders(res.headers) }));
  } catch (_) { /* offline kópia je bonus — chyba tu nesmie rozbiť stránku */ }
}

// Len hlavičky, ktoré dávajú zmysel pre uloženú kópiu (napr. Content-Encoding by sa už nehodil).
function cleanHeaders(h) {
  const out = new Headers();
  for (const k of ['content-type', 'etag', 'last-modified']) if (h.get(k)) out.set(k, h.get(k));
  return out;
}

async function offlineNavigation(cache, url) {
  const p = url.pathname;
  const hit = await cache.match(p, { ignoreSearch: true });
  if (hit) return hit;
  // /qr → /qr/ (stránky s relatívnymi cestami k skriptom potrebujú lomku na konci)
  if (!p.endsWith('/') && (await cache.match(p + '/'))) return Response.redirect(p + '/', 301);
  if (p.length > 1 && p.endsWith('/') && (await cache.match(p.slice(0, -1)))) return Response.redirect(p.slice(0, -1), 301);
  return new Response(OFFLINE_PAGE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

const OFFLINE_PAGE = `<!DOCTYPE html><html lang="sk"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>plainkit · offline</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0f14;color:#f5f7fa;font-family:system-ui,sans-serif;padding:24px;box-sizing:border-box;text-align:center}
.c{max-width:360px}.l{font-size:2rem;font-weight:600;color:#f5f7fa;text-decoration:none}.l span{color:#00d4e8}
p{color:#8b95a3;line-height:1.6}a.b{display:inline-block;margin-top:8px;color:#00d4e8;border:1px solid #00d4e8;border-radius:8px;padding:9px 16px;text-decoration:none}</style></head>
<body><div class="c"><a class="l" href="/">plainkit<span>.</span></a>
<p>Si offline a táto stránka nie je stiahnutá — buď potrebuje internet, alebo si ju nestiahol.<br><br>
You're offline and this page isn't downloaded — it either needs the internet or wasn't saved.</p>
<a class="b" href="/">← plainkit.</a></div></body></html>`;
