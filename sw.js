/* ============================================================
   Service Worker - Bureau de poste DAHMOUNI 14010
   App : Poste LAD
   ============================================================
   Stratégie :
   - HTML  → Network First (pour récupérer les mises à jour)
   - Autres assets → Cache First (rapide + offline)

   ⚠️ IMPORTANT : quand tu modifies le code de l'app,
   change la version ci-dessous (v2 → v3, v3 → v4, etc.)
   pour forcer la mise à jour chez les utilisateurs.
   ============================================================ */

const CACHE_VERSION = 'poste-lad-v1';
const CACHE_NAME = CACHE_VERSION;

// Fichiers mis en cache dès l'installation
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

// ===== INSTALL =====
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

// ===== ACTIVATE =====
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

  // Ignore les méthodes non-GET
  if (request.method !== 'GET') return;

  // Ignore les requêtes cross-origin
  let url;
  try { url = new URL(request.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  const isHTML = request.headers.get('accept')?.includes('text/html') ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/');

  if (isHTML) {
    // HTML → NETWORK FIRST (avec fallback cache)
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then(cached => cached || caches.match('./index.html'));
        })
    );
  } else {
    // Assets → CACHE FIRST
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
          // Fallback pour les images
          if (request.destination === 'image') {
            return caches.match('./icon.png');
          }
          return new Response('', { status: 408, statusText: 'Offline' });
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