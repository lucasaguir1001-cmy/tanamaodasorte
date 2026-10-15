const CACHE_NAME = 'tanamao-pwa-v2';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/manifest-afiliados.json',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png',
  '/apple-touch-icon.png',
  '/afiliados-icon-192.png',
  '/afiliados-icon-512.png',
  '/afiliados-icon-maskable.png',
  '/afiliados-apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  // Ignore API requests and non-http
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api') || !url.protocol.startsWith('http')) {
    return;
  }

  // Never cache /afiliados or HTML page navigation, always get fresh network response
  if (url.pathname.startsWith('/afiliados') || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
