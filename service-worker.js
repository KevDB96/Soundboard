// App-shell cache so the board still loads offline. Sound/background blobs live in
// IndexedDB (see js/storage.js) and don't need to go through this cache.
const CACHE_NAME = 'soundboard-shell-v6-poppy-branding';
const APP_SHELL = [
  './',
  'index.html',
  'manifest.json',
  'css/styles.css',
  'js/storage.js',
  'js/audio.js',
  'js/app.js',
  'icons/poppy-icon.svg',
  'icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Network-first: always try to get the latest app shell, only falling back to
// the cache when offline. Cache-first would silently keep serving whatever
// HTML/CSS/JS was cached on first load even after those files change on the
// server, which is exactly wrong while the app is still being iterated on.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
