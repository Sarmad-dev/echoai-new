// EchoAI Service Worker for Performance Optimization
const CACHE_NAME = 'echoai-widget-v1';
const urlsToCache = [
  '/enhanced-widget.js',
  '/widget.js',
  '/polyfills.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('EchoAI: Service worker cache opened');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  // Only cache GET requests for our widget files
  if (event.request.method === 'GET' && 
      (event.request.url.includes('widget.js') || 
       event.request.url.includes('polyfills.js'))) {
    
    event.respondWith(
      caches.match(event.request)
        .then(function(response) {
          // Return cached version or fetch from network
          if (response) {
            console.log('EchoAI: Serving from cache:', event.request.url);
            return response;
          }
          
          return fetch(event.request).then(function(response) {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            var responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          });
        })
    );
  }
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('EchoAI: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});