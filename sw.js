/* ============================================================
   Service Worker - Bureau de poste DAHMOUNI 14010
   - HTML → Network First
   - Assets locaux + logo ImgBB → Cache First
   ============================================================ */

const CACHE_VERSION = 'poste-dahmouni-v3';
const CACHE_NAME = CACHE_VERSION;

const LOGO_URL = 'https://i.ibb.co/ds9JFS3p/1000127367-removebg-preview.png';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  LOGO_URL
];

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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch { return; }

  // Autoriser le cache du logo distant (i.ibb.co)
  const isLogo = request.url === LOGO_URL ||
                 url.hostname === 'i.ibb.co';

  // Bloquer les autres cross-origin
  if (url.origin !== self.location.origin && !isLogo) return;

  const isHTML = request.headers.get('accept')?.includes('text/html') ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/');

  if (isHTML) {
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

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});