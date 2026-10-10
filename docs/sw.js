const CACHE = 'il-mio-gin-vino-shell-20261010-ocr-v6';
const APP_FILES = [
  './', './index.html', './Il_Mio_Gin.html', './Il_Mio_Vino.html',
  './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './logo-gin.png', './logo-vino.png', './apple-touch-icon.png', './ocr-etichetta.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('il-mio-gin-vino-shell-') && k !== CACHE).map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match('./index.html'))));
    return;
  }
  if (url.pathname.endsWith('/ocr-etichetta.js')) {
    event.respondWith(fetch(request).catch(() => caches.match('./ocr-etichetta.js')));
    return;
  }
  event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
});
