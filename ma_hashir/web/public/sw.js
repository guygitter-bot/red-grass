// מה השיר? – service worker: רק כדי שאפשר יהיה להתקין את האפליקציה במסך הבית.
// הכול נטען מהרשת (המשחק עצמו בשרת).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
