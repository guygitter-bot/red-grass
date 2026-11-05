// יומן סוכר – service worker: מאפשר להתקין את האפליקציה במסך הבית, לפתוח אותה גם בלי אינטרנט ולהציג התראות.
// קובצי האפליקציה: קודם מהרשת (כדי לקבל גרסה חדשה), ובלי רשת – מהעותק השמור. הנתונים עצמם שמורים במכשיר (localStorage).
const CACHE = 'ys-v1';

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

// התראה (התזכורת השבועית) – גם כשהאפליקציה סגורה
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(self.registration.showNotification(data.title || 'יומן סוכר', {
    body: data.body || '',
    tag: data.tag || 'yoman-sukar',
    data: { url: data.url || self.registration.scope },
    icon: 'icon.svg',
    badge: 'icon.svg',
    dir: 'rtl',
    lang: 'he',
    renotify: true,
  }));
});

// לחיצה על ההתראה – ישר למסך המתאים באפליקציה
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let target = self.registration.scope;
  try {
    const url = new URL(event.notification.data?.url || '', self.registration.scope);
    if (url.origin === self.location.origin) target = url.href;
  } catch {
    // נשארים בדף הראשי
  }
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if ('focus' in client) {
        await client.navigate?.(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
