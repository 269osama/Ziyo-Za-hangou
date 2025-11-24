const CACHE_NAME = 'ranobe-reader-v1';
const DYNAMIC_CACHE = 'ranobe-dynamic-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests or non-GET requests for basic caching
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
      return;
  }

  // Network First, fall back to Cache strategy for main content to ensure freshness
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});