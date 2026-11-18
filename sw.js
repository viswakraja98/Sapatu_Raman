// Offline support: app files are served from cache, then refreshed in the background.
const CACHE = 'fdp-v2';
const SHELL = ['./', './index.html', './styles.css', './app.js', './db.js', './charts.js', './seed.js', './groceries.js', './config.js', './manifest.json', './icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const isShell = url.origin === location.origin;
  const isLib = url.hostname === 'cdn.jsdelivr.net';
  if (!isShell && !isLib) return; // Supabase API calls always go to the network
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: isShell });
    const fresh = fetch(e.request).then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => cached);
    return cached || fresh;
  }));
});
