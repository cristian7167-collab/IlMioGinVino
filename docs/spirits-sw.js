/* Bibirub Distillati PWA - scope restricted to the superalcolici HTML page. */
'use strict';
const CACHE_NAME = 'bibirub-spirits-pwa-v2-blu';
const PAGE = new URL('./Il_Mio_Superalcolico_Android.html', self.location.href).href;
const ASSETS = [
  PAGE,
  new URL('./spirits-manifest.webmanifest', self.location.href).href,
  new URL('./spirits-icon-192.png', self.location.href).href,
  new URL('./spirits-icon-512.png', self.location.href).href,
  new URL('./spirits-brand-logo.webp', self.location.href).href
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('bibirub-spirits-pwa-') && k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === new URL(PAGE).pathname && req.mode === 'navigate') {
    event.respondWith(fetch(req).then(response => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(PAGE, copy)));
      }
      return response;
    }).catch(() => caches.match(PAGE)));
  }
});
