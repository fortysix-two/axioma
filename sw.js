/* ============================================================
   AXIOMA · sw.js
   Guarda la aplicacion en el telefono para que abra sin conexion.
   La musica NO pasa por aqui: vive en IndexedDB, no en esta cache.
   Sube el numero de VERSION cada vez que cambies algun archivo.
   ============================================================ */
const VERSION = 'axioma-v3';

const SHELL = [
  './',
  'index.html',
  'styles.css',
  'js/core.js',
  'js/player.js',
  'js/ui.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-64.png',
  'fonts/silkscreen-latin-1.woff2',
  'fonts/silkscreen-latin-ext-0.woff2',
  'fonts/silkscreen-latin-3.woff2',
  'fonts/silkscreen-latin-ext-2.woff2',
  'fonts/archivo-latin-1.woff2',
  'fonts/archivo-latin-ext-0.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      /* Un archivo que falte no debe tumbar la instalacion entera. */
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch((err) => console.warn('sw: no se pudo cachear', u, err)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) {
        /* Servimos lo cacheado al instante y refrescamos por detras. */
        e.waitUntil(
          fetch(req).then((res) => {
            if (res && res.ok) return caches.open(VERSION).then((c) => c.put(req, res));
          }).catch(() => {})
        );
        return hit;
      }
      return fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match('index.html'));
    })
  );
});
