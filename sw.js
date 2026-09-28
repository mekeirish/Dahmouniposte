/* ============================================================
   Service Worker - Poste Dahmouni
   Stratégie :
   - HTML → Network First (pour récupérer les mises à jour)
   - Autres assets → Cache First (rapide + offline)
   ============================================================ */

const CACHE_VERSION = 'poste-dahmouni-v1';
const CACHE_NAME = CACHE_VERSION;

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

// ===== INSTALLATION =====
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return Promise.all(
          PRECACHE_ASSETS.map(url =>
            cache.add(url).catch(err => console.warn(`[SW] Échec cache ${url}:`, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ===== ACTIVATION =====
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Suppression ancien cache :', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ===== FETCH =====
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isHTML = request.headers.get('accept')?.includes('text/html') ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/');

  if (isHTML) {
    // Network First (mises à jour)
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
    );
  } else {
    // Cache First
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => {
          if (request.destination === 'image') {
            return caches.match('./icon.png');
          }
        });
      })
    );
  }
});

// ===== MESSAGE =====
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});