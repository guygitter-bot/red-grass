// סדר – service worker: האפליקציה נפתחת גם בלי אינטרנט (כל הנתונים שמורים במכשיר),
// ומציג התראות של תזכורות. הגרסה ורשימת הקבצים נכתבות בזמן הבנייה (vite.config.js)
const BUILD = '__BUILD__';
const PRECACHE = [/*PRECACHE*/];
const SHELL = `seder-shell-${BUILD}`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(PRECACHE.map((f) => cache.add(new Request(f, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith('seder-') && name !== SHELL) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.endsWith('sw.js')) return;
  if (request.mode === 'navigate') {
    // דף האפליקציה (גם שיתוף מווטסאפ: ‎?text=...‎) – מהרשת, ובלי רשת מהמטמון
    event.respondWith(fetch(request).then((res) => {
      if (res.ok && !url.search) caches.open(SHELL).then((c) => c.put('./', res.clone()));
      return res;
    }).catch(async () => (await caches.match('./')) || Response.error()));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((res) => {
    if (res.ok) caches.open(SHELL).then((c) => c.put(request, res.clone()));
    return res;
  })));
});

// לחיצה על התראה פותחת את האפליקציה על המשימה
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = `${self.registration.scope}#task=${event.notification.data?.id || ''}`;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if ('focus' in client) {
        client.navigate?.(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
