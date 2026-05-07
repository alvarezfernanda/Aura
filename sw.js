/* Aura Service Worker — versión optimizada para Android
 * - Precaches the app shell
 * - Stale-while-revalidate para fonts e imágenes
 * - Cache-first inmutable para assets hasheados de Vite
 * - Network-first con fallback al shell para navegaciones
 */

const SW_VERSION = 'aura-v3';
const SHELL_CACHE = `${SW_VERSION}-shell`;
const ASSET_CACHE = `${SW_VERSION}-assets`;
const FONT_CACHE = `${SW_VERSION}-fonts`;
const IMG_CACHE = `${SW_VERSION}-img`;

const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(SW_VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

const isHashedAsset = (url) =>
  /\/assets\/.+\.[a-f0-9]{6,}\.(?:js|css|woff2?|svg|png|jpg|webp)$/.test(url.pathname);

const isFont = (url) => /fonts\.(?:googleapis|gstatic)\.com/.test(url.host);

const isImage = (url) => /\.(?:png|jpg|jpeg|webp|gif|svg)$/i.test(url.pathname);

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((res) => {
      if (res && res.status === 200) cache.put(request, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);
  return cached || (await networkPromise) || cached;
}

async function networkFirstNavigation(request) {
  try {
    const res = await fetch(request);
    if (res && res.status === 200) {
      const copy = res.clone();
      caches.open(SHELL_CACHE).then((c) => c.put('/index.html', copy)).catch(() => {});
    }
    return res;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match(request)) || (await cache.match('/index.html')) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // No interceptamos llamadas al backend (Claude, etc.)
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isFont(url)) {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  if (isHashedAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res && res.status === 200) cache.put(request, res.clone()).catch(() => {});
        return res;
      })
    );
    return;
  }

  if (isImage(url)) {
    event.respondWith(staleWhileRevalidate(request, IMG_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
  }
});
