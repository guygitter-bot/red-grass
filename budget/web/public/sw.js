// תקציב הבית – service worker: מאפשר להתקין את האפליקציה במסך הבית ולפתוח אותה גם בלי אינטרנט.
// קובצי האפליקציה: קודם מהרשת (כדי לקבל גרסה חדשה), ובלי רשת – מהעותק השמור. הנתונים עצמם שמורים במכשיר (localStorage).
const CACHE = 'bb-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./'))),
  );
});
