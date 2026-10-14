// מאגר AI – service worker מינימלי: מאפשר להתקין את האפליקציה במסך הבית
// ולקבל "שיתוף" מאפליקציות אחרות. הכול נטען מהרשת (החומר נמצא בשרת).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
