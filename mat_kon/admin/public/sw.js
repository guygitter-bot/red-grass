// service worker מינימלי – כדי שאפשר יהיה להתקין את אפליקציית הניהול למסך הבית. לא שומר נתונים (הכול תמיד מהשרת)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
