// FF Bet Manager - Service Worker
const CACHE_NAME = 'ffbet-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json'
];

// Install — cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET and Firebase requests
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('firestore.googleapis.com')) return;
    if (event.request.url.includes('gstatic.com')) return;
    if (event.request.url.includes('googleapis.com')) return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Cache successful responses
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
