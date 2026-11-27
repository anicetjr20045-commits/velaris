/**
 * Djelia Studio - Service Worker PWA
 * Stratégie : Network-first pour HTML/Navigation (évite les pages obsolètes),
 * passthrough direct pour /api, Supabase et WAHA.
 */

const CACHE_NAME = 'djelia-studio-pwa-v3';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('velarisagent.life') ||
    url.hostname.includes('kie.ai') ||
    url.protocol.startsWith('ws')
  ) {
    return;
  }

  // HTML / navigation : Network first (sans cache HTTP) pour garantir les dernières mises à jour
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match('/'))
    );
    return;
  }

  // Icônes & assets statiques : Cache-first
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
