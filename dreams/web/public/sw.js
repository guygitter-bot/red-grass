// שומר את קובצי האפליקציה במטמון, כדי שתיפתח גם בלי רשת (ליד המיטה, במצב טיסה)
const CACHE = 'zc-v1';
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
// קודם רשת (כדי לקבל גרסה חדשה), ובלי רשת – מהמטמון
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreVary: true }).then((r) => r || (req.mode === 'navigate' ? caches.match('./', { ignoreVary: true }) : Response.error()))),
  );
});
