// service worker של אפליקציית הניהול: מאפשר התקנה למסך הבית, ומציג התראות "יש תקלה" גם כשהאפליקציה סגורה.
// לא שומר נתונים (הכול תמיד מהשרת)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  // צליל ורטט: התראה רגילה של אנדרואיד (הצליל לפי הגדרות ההתראות של כרום בטלפון)
  event.waitUntil(self.registration.showNotification(data.title || 'mat-kon ניהול', {
    body: data.body || '',
    tag: data.tag || 'mat-kon',
    data: { url: data.url || self.registration.scope },
    icon: 'icon.svg',
    badge: 'icon.svg',
    dir: 'rtl',
    lang: 'he',
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [400, 150, 400, 150, 400],
  }));
});

// לחיצה על ההתראה – פותחת את אפליקציית הניהול בלשונית המתאימה
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
      if (client.url.startsWith(self.registration.scope)) {
        await client.focus();
        return client.navigate(target);
      }
    }
    return self.clients.openWindow(target);
  })());
});
