const CACHE = 'natty-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/onboarding.html',
  '/offre.html',
  '/challenges.html',
  '/accueil.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Installation : mise en cache des assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activation : suppression des anciens caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch : réseau d'abord, cache en fallback
self.addEventListener('fetch', (e) => {
  // Ne pas intercepter les appels API
  if (e.request.url.includes('/api/') || 
      e.request.url.includes('supabase') ||
      e.request.url.includes('anthropic') ||
      e.request.url.includes('cloudinary')) {
    return;
  }
  
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Mettre en cache la réponse fraîche
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
