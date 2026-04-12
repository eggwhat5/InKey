// Service Worker for Guitar Hero MIDI Practice — offline caching
const CACHE_NAME = 'ghmp-v2';
const ASSETS = [
    'guitar_hero.html',
    'guitar_hero.js',
    'guitar_hero.css',
    'training.js',
    'manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cached) => {
            // Network-first for HTML, cache-first for assets
            if (event.request.mode === 'navigate') {
                return fetch(event.request).catch(() => cached);
            }
            return cached || fetch(event.request);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
});
