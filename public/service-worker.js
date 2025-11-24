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
  const url = new URL(event.request.url);
  
  // Allow caching of external assets critical for UI (Tailwind, Fonts, Images)
  const isSameOrigin = url.origin === self.location.origin;
  const isExternalAsset = url.hostname.includes('tailwindcss.com') || 
                          url.hostname.includes('googleapis.com') || 
                          url.hostname.includes('gstatic.com') ||
                          url.hostname.includes('picsum.photos');

  // Skip if it's not a GET request or if it's a random API call we don't want to cache
  if (event.request.method !== 'GET' || (!isSameOrigin && !isExternalAsset)) {
      return;
  }

  // Network First, fall back to Cache strategy for main content to ensure freshness
  // Stale-while-revalidate for assets could be better, but Network First is safer for data consistency
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