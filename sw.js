const CACHE_NAME = 'cb-sim-v3';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './game.js',
  './router.js',
  './progress.js',
  './dashboard.js',
  './map.js',
  './library.js',
  './achievements.js',
  './character.js',
  './scenarios.js',
  './cases.js',
  './scoring.js',
  './timer.js',
  './ui.js',
  './analytics.js',
  './manifest.webmanifest',
  './favicon.svg',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/characters/chief-clerk-neutral.svg',
  './icons/characters/chief-clerk-happy.svg',
  './icons/characters/chief-clerk-concerned.svg',
  './data/scenarios.json',
  './data/cases.json',
  './data/campaigns.json',
  './data/achievements.json',
  './data/characters.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(event.request);
          return cachedPage || caches.match('./index.html') || caches.match('./');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
