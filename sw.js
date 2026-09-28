/* ============================================================
   Service Worker - Poste Dahmouni
   Stratégie : Cache First pour les assets, Network First pour le HTML
   pour permettre les mises à jour tout en restant utilisable offline.
   ============================================================ */

const CACHE_VERSION = 'poste-dahmouni-v1';
const CACHE_NAME = `${CACHE_VERSION}`;

// Fichiers à mettre en cache immédiatement lors de l'installation
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './tailwind.min.js',
  './icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// ===== INSTALLATION =====
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // addAll échoue si un seul fichier manque → on tolère les erreurs
        return Promise.all(
          PRECACHE_ASSETS.map(url =>
            cache.add(url).catch(err => console.warn(`[SW] Échec cache pour ${url}:`, err))
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

  // On ne gère que les GET
  if (request.method !== 'GET') return;

  // Ne pas intercepter les requêtes non-same-origin (analytics, etc.)
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Stratégie : Network First pour le HTML, Cache First pour le reste
  const isHTML = request.headers.get('accept')?.includes('text/html') ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/');

  if (isHTML) {
    // Network First (pour récupérer les mises à jour, avec fallback sur le cache)
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
          // Mettre en cache les nouveaux assets récupérés
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => {
          // Fallback : si c'est une image, on peut retourner un placeholder
          if (request.destination === 'image') {
            return caches.match('./icon.png');
          }
        });
      })
    );
  }
});

// ===== MESSAGE (permet de forcer la mise à jour depuis l'app) =====
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});