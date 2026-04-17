// Aura Service Worker — cache básico + offline fallback
const CACHE = 'aura-v1';
const CORE = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  // Network first para HTML (para ver cambios rápido)
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache first para assets
  e.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((res) => {
        // Cachear assets estáticos
        if (res.ok && (request.url.includes('/assets/') || request.url.endsWith('.svg') || request.url.endsWith('.png'))) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
