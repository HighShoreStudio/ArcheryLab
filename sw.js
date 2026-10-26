/* Archery Lab · service worker
   Network-first: you always get the latest version when online,
   and the last copy saved on the device when offline. */
const CACHE = 'archery-lab-v1.9.6-webapp-1';
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './css/glass.css', './css/pages.css', './js/shell.js', './js/i18n.js',
  './calcolatore/index.html', './calcolatore/app.js',
  './spennata/index.html', './spennata/app.js', './spennata/catalogo-attrezzatura.json',
  './rosata/index.html', './rosata/app.js',
  './accordatura/index.html', './accordatura/app.js',
  './guide/index.html', './utilities/index.html', './utilities/app.js', './altro/index.html',
  './assets/img/mykan-hero.jpg', './assets/img/logo-fitarco.jpg',
  './assets/brands/hoyt.png', './assets/brands/mybo.png', './assets/brands/uukha.png',
  './icons/icon.svg', './icons/icon-192.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
