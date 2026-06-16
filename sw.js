// ─────────────────────────────────────────────────────────────
// sw.js — Service Worker (Phase 0: shell cache only)
//
// Strategy:
//   - App shell files → cache-first (fast offline load)
//   - GAS API calls   → network-only (financial data never cached)
//
// Bump CACHE_NAME when deploying new shell versions.
// ─────────────────────────────────────────────────────────────

// Bump this string on every deployment that changes shell files.
// A new name causes the browser to install a fresh SW, delete the
// old cache, and serve updated files to all clients.
const CACHE_NAME = 'haarnak-sheli-v13';

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/themes.css',
  './css/components.css',
  './js/currency.js',
  './js/i18n.js',
  './js/api.js',
  './js/auth.js',
  './js/views/setup.js',
  './js/views/purchase-helper.js',
  './js/views/wallet-display.js',
  './js/views/goals-display.js',
  './js/views/child-dashboard.js',
  './js/views/parent-controls.js',
  './js/views/parent-dashboard.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Install: pre-cache the shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

// Activate: delete old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_NAME)
            .map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: route requests
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept GAS API calls — always go to network
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // config.js is private and not in the cache — always network
  if (url.pathname.endsWith('/config.js')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Shell files: cache-first, fall back to network
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});
