// Golazo Lab service worker: caches the app shell so it opens offline.
// Live football data is always fetched fresh from the network.
const CACHE = 'golazo-v1'
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg']))); self.skipWaiting() })
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim() })
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url)
  if (u.origin !== location.origin) return // ESPN and other data: network only
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r }).catch(() => caches.match(e.request)))
})
