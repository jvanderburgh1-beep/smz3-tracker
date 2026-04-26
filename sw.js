/* =============================================================
   SMZ3 Tracker — service worker
   - Code/markup (HTML/CSS/JS): network-first so updates apply
     on the next refresh when online.
   - Everything else (images, manifest, icons): cache-first for
     speed and offline use.
   ============================================================= */

const CACHE_VERSION = 'smz3-tracker-v26';
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

// Files we always want to serve fresh from network when online so
// that pushing an update reaches the user on the next page refresh
// rather than waiting for the cache to invalidate. Cache is still
// used as a fallback when offline.
const NETWORK_FIRST_PATHS = [
  '/',
  '/index.html',
  '/styles.css',
  '/logic.js',
  '/tracker.js',
  '/sw.js',
  '/calibrate.html',
  '/calibrate-sm.html',
];

function isNetworkFirst(url) {
  // Match either the absolute pathname or the trailing segment, so
  // this works whether the app is served from / or /smz3-tracker/.
  const path = url.pathname;
  return NETWORK_FIRST_PATHS.some(p => path === p || path.endsWith(p));
}

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

  if (isNetworkFirst(url)) {
    // Network-first: always try to grab the latest, fall back to cache offline.
    event.respondWith(
      fetch(req).then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
        }
        return resp;
      }).catch(() =>
        caches.match(req).then((cached) =>
          cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)
        )
      )
    );
    return;
  }

  // Cache-first for everything else (images, icons, etc.)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
        }
        return resp;
      }).catch(() => {
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
