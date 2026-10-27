/* Service Worker — permite abrir la app de EPP sin señal en faena.
   Debe estar en la misma carpeta que index.html. Cambie VERSION al publicar cambios. */
const VERSION = 'epp-v1';
const ASSETS = [
  './',
  './index.html',
  'https://cdn.tailwindcss.com',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(ASSETS.map(async url => {
      try {
        const cross = url.startsWith('http');
        const resp = await fetch(url, cross ? { mode: 'no-cors' } : {});
        await cache.put(url, resp);
      } catch (e) { /* se reintentará en la siguiente visita */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;                                   // los POST a Google Sheets pasan directo
  if (req.url.includes('script.google.com') || req.url.includes('googleusercontent.com')) return;

  // Navegación: red primero (para recibir actualizaciones), caché si no hay señal
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const resp = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put('./index.html', resp.clone());
        return resp;
      } catch {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  // Recursos: caché primero y actualización en segundo plano
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const network = fetch(req).then(async resp => {
      const cache = await caches.open(VERSION);
      cache.put(req, resp.clone());
      return resp;
    }).catch(() => cached);
    return cached || network;
  })());
});
