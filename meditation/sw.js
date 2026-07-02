// Cache minimal de l'app shell pour un fonctionnement hors-ligne.
// L'audio importé vit dans IndexedDB, pas ici : aucun risque de désync.
const CACHE = 'meditation-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './db.js',
  './audio-engine.js',
  './timers.js',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return res;
    }).catch(() => cached)),
  );
});
