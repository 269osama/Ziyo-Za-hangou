const CACHE_NAME = 'ranobe-reader-v1';
const DYNAMIC_CACHE = 'ranobe-dynamic-v1';

// Install event - cache core static assets if possible, 
// though mostly we rely on runtime caching for this dynamic environment
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - cleanup old caches
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

// Fetch event - Network first for API, Cache first for assets, Stale-while-revalidate for others
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Strategy: Stale While Revalidate
  // This ensures the app loads fast from cache, but updates in background
  event.respondWith(
    caches.open(DYNAMIC_CACHE).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            // Update cache with new response
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // Network failed
            // If we have a cached response, it was returned earlier (in a real SWR impl) 
            // but here we return it if fetch fails
             return cachedResponse;
          });

        return cachedResponse || fetchPromise;
      });
    })
  );
});