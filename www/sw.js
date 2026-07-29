// Service Worker désactivé - se désinscrit immédiatement
self.addEventListener('install', function() {
  self.skipWaiting();
});
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).then(function() {
      return self.clients.claim();
    }).then(function() {
      // Se désenregistrer lui-même
      return self.registration.unregister();
    })
  );
});
self.addEventListener('fetch', function(e) {
  // Passer toutes les requêtes au réseau sans cache
  e.respondWith(fetch(e.request));
});
