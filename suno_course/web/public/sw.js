// קורס סונו – service worker: התקנה במסך הבית ועבודה גם בלי אינטרנט (חוץ מה-AI).
// כל עלייה מחליפה את שם המטמון, כך שהגרסה החדשה נטענת אחרי סגירה ופתיחה.
const CACHE = 'suno-course-v1';
const FILES = ['./', 'index.html', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'img/suno-home.jpg', 'img/suno-pricing.jpg', 'img/yt-ai-disclosure.jpg', 'img/yt-ypp.jpg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // קודם מהרשת (כדי לקבל עדכונים), ואם אין אינטרנט – מהמטמון
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then((m) => m || caches.match('index.html'))));
});
