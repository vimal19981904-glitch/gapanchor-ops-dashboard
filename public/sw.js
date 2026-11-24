const CACHE_NAME = 'gapanchor-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Always fetch fresh network content; fallback to cache if offline
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
