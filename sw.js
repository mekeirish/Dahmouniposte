/* ============================================================
   Service Worker - Bureau de poste DAHMOUNI 14010
   - HTML → Network First (avec fallback cache)
   - Assets locaux + logo distant → Cache First
   - skipWaiting() à l'install + clients.claim() à l'activate
   - Purge des anciens caches à l'activate
   ============================================================ */

const CACHE_VERSION = 'poste-v2';
const CACHE_NAME = CACHE_VERSION;

const LOGO_URL = 'https://i.ibb.co/ds9JFS3p/1000127367-removebg-preview.png';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  LOGO_URL
];

// ===== INSTALL =====
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        PRECACHE_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn(`[SW] Échec cache ${url}:`, err))
        )
      ))
      .then(() => self.skipWaiting())
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Suppression ancien cache :', key);
          return caches.delete(key);
        }
      })
    )).then(() => self.clients.claim())
  );
});

// ===== FETCH =====
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch { return; }

  // Autoriser le cache du logo distant (i.ibb.co)
  const isLogo = request.url === LOGO_URL || url.hostname === 'i.ibb.co';

  // Bloquer les autres cross-origin
  if (url.origin !== self.location.origin && !isLogo) return;

  const isHTML = request.headers.get('accept')?.includes('text/html') ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/');

  if (isHTML) {
    // Network First
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then(cached => cached || caches.match('./index.html'))
        )
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
          if (request.destination === 'image') return caches.match('./icon.png');
          return new Response('', { status: 408, statusText: 'Offline' });
        });
      })
    );
  }
});

// ===== MESSAGE =====
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});