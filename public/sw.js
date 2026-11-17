// Hakuviestit service worker.
// __BUILD_ID__ korvataan build-web.mjs:ssä sisällön tiivisteellä, jolloin
// jokainen uusi versio saa oman välimuistinsa ja vanhat poistetaan.
// Fontit ovat omalta palvelimelta (fonts/) ja esivälimuistitetaan rungon mukana.
// Vain saman originin GET-pyyntöjä käsitellään; ristiin-origin-pyyntöjä ei koskaan välimuistiteta.
const VERSION = '__BUILD_ID__';
const SHELL_CACHE = 'hakuviestit-shell-' + VERSION;

// build-web.mjs korvaa tämän listan fonttitiedostoilla.
const FONT_FILES = [/*__FONT_FILES__*/];

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  ...FONT_FILES,
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
          // Poistetaan kaikki vanhat hakuviestit-välimuistit (myös vanha hakuviestit-fonts-v1).
          names.filter((n) => n.startsWith('hakuviestit-') && n !== SHELL_CACHE).map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Cache-first: sovelluksen runko löytyy aina välimuistista.
async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
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
  // Vain sama origin; muut pyynnöt jätetään selaimelle (CSP estää ne joka tapauksessa).
  if (url.origin !== self.location.origin) return;
  event.respondWith(cacheFirst(request));
});
