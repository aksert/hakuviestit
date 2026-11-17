// Hakuviestit service worker.
// __BUILD_ID__ korvataan build-web.mjs:ssä sisällön tiivisteellä, jolloin
// jokainen uusi versio saa oman välimuistinsa ja vanhat poistetaan.
const VERSION = '__BUILD_ID__';
const SHELL_CACHE = 'hakuviestit-shell-' + VERSION;
const FONT_CACHE = 'hakuviestit-fonts-v1';
const KEEP = [SHELL_CACHE, FONT_CACHE];

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n.startsWith('hakuviestit-') && !KEEP.includes(n))
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isFontRequest(url) {
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

// Stale-while-revalidate: palauta välimuistista heti, päivitä taustalla.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

// Cache-first: sovelluksen runko löytyy aina välimuistista.
async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok && new URL(request.url).origin === self.location.origin) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (request.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (isFontRequest(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
  }
});
