// הצוות – service worker: מאפשר להתקין את האפליקציה במסך הבית ולפתוח אותה גם בלי אינטרנט.
// קובצי האפליקציה: קודם מהרשת (כדי לקבל גרסה חדשה), ובלי רשת – מהעותק השמור. כל הנתונים נשארים בשרת.
const CACHE = 'tsevet-v2';

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

// התראות לטלפון: השרת שולח { title, body, url, tag }
self.addEventListener('push', (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = {};
  }
  event.waitUntil(
    self.registration.showNotification(d.title || 'הצוות', {
      body: d.body || '',
      tag: d.tag || undefined,
      data: { url: d.url || '' },
      icon: 'icon.svg',
      badge: 'icon.svg',
      dir: 'rtl',
      lang: 'he',
    }),
  );
});

// לחיצה על התראה: פותחים את האפליקציה (רק כתובות מהאתר עצמו)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let target = self.registration.scope;
  try {
    const u = new URL((event.notification.data && event.notification.data.url) || '', self.location.origin);
    if (u.origin === self.location.origin) target = u.href;
  } catch {
    // כתובת לא תקינה – נפתח את הראשי
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => new URL(c.url).origin === self.location.origin);
      if (open) {
        return open
          .focus()
          .then(() => ('navigate' in open ? open.navigate(target) : undefined))
          .catch(() => undefined);
      }
      return self.clients.openWindow(target);
    }),
  );
});
