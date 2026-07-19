// Bump on each deploy si querés invalidar cache manual; por defecto se invalida sola
// porque index.html va network-first.
const CACHE = 'rutaapp-admin-v4';
const SHELL = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  // NO llamamos skipWaiting() acá: dejamos que la UI controle el momento del switch
  // mediante el mensaje SKIP_WAITING (botón "Actualizar" en UpdatePrompt).
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Firebase / Google APIs: siempre red, sin tocar cache
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com') ||
      url.hostname.includes('accounts.google.com') ||
      url.hostname.includes('apis.google.com')) {
    return; // dejar pasar al fetch nativo
  }

  // Rutas reservadas de Firebase Hosting (/__/auth/handler, /__/auth/iframe, etc.)
  // El SW NUNCA debe interceptar estas — rompen el handshake de OAuth.
  if (url.pathname.startsWith('/__/')) {
    return;
  }

  // Navegación HTML (index.html): network-first para captar updates
  const isNavigation = e.request.mode === 'navigate' ||
                       (e.request.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', clone));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Assets con hash (JS, CSS, imgs): cache-first (son inmutables)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
