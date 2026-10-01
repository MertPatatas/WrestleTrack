// Service worker mínimo de WrestleTrack.
// - Archivos estáticos (JS/CSS/iconos): caché primero.
// - Páginas: red primero; si no hay conexión, se muestra la última versión guardada.
// - /api/*: siempre a la red, para no servir datos antiguos.
const CACHE = 'wrestletrack-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function remember(request, response) {
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  const isStatic = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/');

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => remember(request, res))),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((res) => remember(request, res))
      .catch(() => caches.match(request).then((hit) => hit || caches.match('/'))),
  );
});
