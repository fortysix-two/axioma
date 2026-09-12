/* ============================================================
   AXIOMA · sw.js
   Guarda la aplicacion en el telefono para que abra sin conexion.
   La musica NO pasa por aqui: vive en IndexedDB, no en esta cache.
   Sube el numero de VERSION cada vez que cambies algun archivo.
   ============================================================ */
const VERSION = 'axioma-v4';

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

/* Espera acotada: si la red no responde pronto, tiramos de cache. */
function conLimite(promesa, ms) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), ms);
    promesa.then(
      (v) => { clearTimeout(t); res(v); },
      (e) => { clearTimeout(t); rej(e); }
    );
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* Red primero, cache como respaldo.
     Con conexion, una version nueva del servidor entra en cuanto abres la
     app, sin trucos ni segundas aperturas. Sin conexion, fetch falla al
     instante y se sirve lo guardado, asi que el modo avion sigue igual
     de rapido. La musica no pasa por aqui: vive en IndexedDB. */
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const fresca = await conLimite(fetch(req), 3000);
      if (fresca && fresca.ok && fresca.type === 'basic') cache.put(req, fresca.clone());
      return fresca;
    } catch (err) {
      const guardada = await cache.match(req, { ignoreSearch: true });
      if (guardada) return guardada;
      const shell = await cache.match('index.html');
      return shell || Response.error();
    }
  })());
});
