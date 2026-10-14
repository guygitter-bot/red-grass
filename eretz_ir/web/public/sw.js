// ארץ עיר – service worker: מאפשר להתקין את האפליקציה במסך הבית,
// ומציג התראות "בואו לשחק" מחברי הקהילה (גם כשהאפליקציה סגורה).
// הכול נטען מהרשת (המשחק עצמו בשרת).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(self.registration.showNotification(data.title || '🎲 בואו לשחק ארץ עיר!', {
    body: data.body || '',
    tag: data.tag || 'eretz-ir',
    data: { url: data.url || self.registration.scope },
    icon: 'icon.svg',
    badge: 'icon.svg',
    dir: 'rtl',
    lang: 'he',
    renotify: true,
    requireInteraction: true,
  }));
});

// לחיצה על ההתראה – ישר למשחק
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
