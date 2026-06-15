// Cache version — incrémenter à chaque déploiement
const CACHE_VERSION = 'natty-v1781539594501786639';
const CACHE_NAME = CACHE_VERSION;

// Ne pas cacher index.html pour toujours avoir la version fraîche
const NEVER_CACHE = [
  '/index.html',
  '/admin.html', 
  '/onboarding.html',
  '/questionnaire-alim.html',
];

self.addEventListener('install', function(e) {
  console.log('SW install:', CACHE_NAME);
  self.skipWaiting(); // Prendre le contrôle immédiatement
});

self.addEventListener('activate', function(e) {
  console.log('SW activate:', CACHE_NAME);
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { 
              console.log('SW deleting old cache:', key);
              return caches.delete(key); 
            })
      );
    }).then(function() {
      return self.clients.claim(); // Contrôler tous les onglets ouverts
    })
  );
});

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  
  // Ne jamais cacher les fichiers HTML → toujours réseau
  if (NEVER_CACHE.some(function(p) { return url.pathname === p || url.pathname.endsWith('.html'); })) {
    e.respondWith(fetch(e.request));
    return;
  }
  
  // Ignorer les requêtes non-GET et les URLs externes
  if (e.request.method !== 'GET') return;
  if (!url.pathname.match(/\.(js|css|png|jpg|jpeg|webp|ico|json|woff2?)$/)) return;
  
  // Cache-first pour les assets statiques
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            // Ne pas cacher les URLs chrome-extension
            if (!e.request.url.startsWith('chrome-extension://')) {
              cache.put(e.request, clone);
            }
          });
        }
        return response;
      });
    }).catch(function() {
      return new Response('Offline', {status: 503});
    })
  );
});
