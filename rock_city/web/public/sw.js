// רוק סיטי – service worker מינימלי: מאפשר להתקין את האפליקציה במסך הבית.
// הכול נטען מהרשת (הנתונים בשרת).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
