const CACHE_NAME = 'uniformes-bethel-cache-v1';
const urlsToCache = [
  '/listadeuniformes/', // Ruta base de tu app
  '/listadeuniformes/index.html',
  '/listadeuniformes/icons/icon-192x192.png',
  '/listadeuniformes/icons/icon-512x512.png'
  // Si tuvieras archivos CSS o JS externos propios, los añadirías aquí.
  // Ejemplo: '/styles.css', '/app.js'
];

// Instalación del Service Worker y cacheo de recursos iniciales
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activación del Service Worker y limpieza de caches antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Asegura que el SW activo controle la página inmediatamente
});

// Interceptación de peticiones fetch para servir desde caché si es posible
self.addEventListener('fetch', event => {
  // Solo interceptar peticiones GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Estrategia: Cache first, then network
  // Ideal para el app shell (HTML, CSS, JS, iconos)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // No está en caché, ir a la red
        return fetch(event.request).then(
          networkResponse => {
            // Comprobar si recibimos una respuesta válida
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
              return networkResponse;
            }

            // Importante: Clonar la respuesta. Una respuesta es un stream y
            // solo puede ser consumida una vez. Necesitamos una para el browser y una para la caché.
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // Solo cachear si es una petición a nuestro propio origen o CDN de confianza
                // Evitar cachear respuestas opacas de terceros que podrían no ser lo que esperamos
                if (event.request.url.startsWith(self.location.origin + '/listadeuniformes/') ||
                    event.request.url.includes('googleapis') ||
                    event.request.url.includes('gstatic') ||
                    event.request.url.includes('tailwindcss')) {
                   cache.put(event.request, responseToCache);
                }
              });
            return networkResponse;
          }
        ).catch(error => {
          // Manejo de error de red, podríamos devolver una página offline genérica
          console.error('Fetching failed:', error);
          // Podrías tener una página offline.html para mostrar aquí
          // return caches.match('/offline.html');
          throw error;
        });
      })
  );
});
