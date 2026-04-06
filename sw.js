const CACHE_NAME = 'sufa-v3';
const ASSETS = [
  './',
  'index.html',
  'css/main.css',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'favicon.png',
  'js/firebase-config.js',
  'js/utils.js',
  'js/offline.js',
  'js/db.js',
  'js/auth.js',
  'js/app.js',
  'https://unpkg.com/lucide@latest',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2',
  'https://cdn.jsdelivr.net/npm/idb@7/build/umd.js',
  'https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;600;700&family=Heebo:wght@300;400;700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
