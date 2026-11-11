// BREACHLINE service worker: network-first for the app so updates arrive, cache as offline fallback.
const CACHE = 'breachline-v9';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'vendor/three.module.min.js', 'js/game.js', 'js/gfx.js', 'js/actors.js', 'js/audio.js', 'js/shared.js', 'js/mats.js', 'js/weather.js', 'js/veg.js', 'js/car.js', 'vendor/GLTFLoader.js', 'vendor/BufferGeometryUtils.js', 'sfx/manifest.json', 'js/core/level.js', 'js/core/sim.js', 'js/core/host.js', 'js/core/weapon.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/ws/')) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
