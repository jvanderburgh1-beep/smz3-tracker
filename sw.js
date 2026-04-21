/* =============================================================
   SMZ3 Tracker — service worker
   Caches core files on install, serves cache-first with network
   fallback so the app works fully offline.
   ============================================================= */

const CACHE_VERSION = 'smz3-tracker-v3';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './logic.js',
  './tracker.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];

// Image assets are cached on first fetch via the runtime handler below
// rather than precached, so the SW install step doesn't fail if some
// filenames are missing or renamed. Once each image loads once online,
// it's available offline.

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('SW: failed to cache some assets', err);
      })
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== 'GET') return;

  // Skip cross-origin (fonts, etc.) — let browser handle with its own cache
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        // Opportunistically cache successful same-origin responses
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
        }
        return resp;
      }).catch(() => {
        // Offline fallback: serve the cached index for navigation requests
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
