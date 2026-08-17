const CACHE_NAME = 'xinblog-shell-v2';
const SHELL_ASSETS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => keys.filter((key) => key !== CACHE_NAME))
      .then((oldKeys) => Promise.all(oldKeys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  
  if (request.method !== 'GET' || url.pathname.startsWith('/api/') || url.origin !== self.location.origin) {
    return;
  }

  
  if (
    url.pathname.startsWith('/assets/') ||
    /\.(js|css|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|ico|json)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }
});
