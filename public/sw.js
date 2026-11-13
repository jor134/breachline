// BREACHLINE service worker: network-first for the app so updates arrive, cache as offline fallback.
const CACHE = 'breachline-v28';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'vendor/three.module.min.js', 'js/game.js', 'js/gfx.js', 'js/actors.js', 'js/audio.js', 'js/shared.js', 'js/mats.js', 'js/weather.js', 'js/veg.js', 'js/car.js', 'vendor/GLTFLoader.js', 'vendor/BufferGeometryUtils.js', 'sfx/manifest.json', 'js/core/level.js', 'js/core/sim.js', 'js/core/host.js', 'js/core/weapon.js', 'js/m4.js', 'js/chars.js', 'models/chars/swat.glb', 'models/chars/thug.glb', 'models/chars/gunman.glb', 'models/chars/phoenix.glb', 'models/chars/boss.glb', 'models/m4/fn509.glb', 'models/m4/m4.glb', 'js/core/maps/mansion.js', 'js/core/maps/terminal.js', 'js/maps/mansion-gfx.js', 'js/maps/terminal-gfx.js', 'js/core/maps/training.js', 'js/maps/training-gfx.js', 'js/core/maps/grandprix.js', 'js/core/maps/circuit.js', 'js/maps/grandprix-gfx.js', 'js/racecar.js', 'js/race.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/ws/')) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
