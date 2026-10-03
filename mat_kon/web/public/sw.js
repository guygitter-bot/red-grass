// mat-kon service worker:
//   1. שיתוף לאפליקציה (share target): קובץ צ'אט מווטסאפ נשמר ב-cache ונפתח במסך הייבוא;
//      קישור או טקסט עוברים לאפליקציה כ-?url=... / ?text=...
//   2. עבודה בלי אינטרנט: האפליקציה עצמה (דפים, קבצים, אייקונים) ותמונות מתכונים נשמרים במטמון.
//      המתכונים עצמם שמורים במכשיר (IndexedDB), כך שאפשר לפתוח ולקרוא גם בלי רשת.
const SHELL = 'matkon-shell-v1';
const IMAGES = 'matkon-images-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('matkon-') && ![SHELL, IMAGES, 'matkon-share'].includes(name)) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(receiveShare(request));
    return;
  }
  if (request.method !== 'GET') return;
  const sameOrigin = url.origin === self.location.origin;
  // דף האפליקציה: קודם מהרשת (גרסה עדכנית), ובלי רשת – מהמטמון
  if (sameOrigin && request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './'));
    return;
  }
  // קבצי האפליקציה (עם שם שמשתנה בכל גרסה) ואייקונים: מהמטמון, ומתעדכנים ברקע
  if (sameOrigin && !url.pathname.endsWith('sw.js')) {
    event.respondWith(staleWhileRevalidate(SHELL, request));
    return;
  }
  // תמונות מתכונים שהועלו (השרת שלנו) – לא משתנות לעולם
  if (/\/img\/[^/]+\/[0-9a-f-]{36}$/.test(url.pathname)) {
    event.respondWith(cacheFirst(IMAGES, request));
  }
});

async function networkFirst(request, fallbackKey) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(fallbackKey, res.clone());
    return res;
  } catch {
    return (await cache.match(fallbackKey)) || (await cache.match(request)) || Response.error();
  }
}

async function staleWhileRevalidate(name, request) {
  const cache = await caches.open(name);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached || Response.error());
  return cached || fresh;
}

async function cacheFirst(name, request) {
  const cache = await caches.open(name);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
  return res;
}

async function receiveShare(request) {
  const scope = self.registration.scope;
  try {
    const form = await request.formData();
    const file = form.getAll('chat').find((f) => f && typeof f === 'object' && f.size > 0);
    if (file) {
      const cache = await caches.open('matkon-share');
      await cache.put('shared-chat', new Response(file, { headers: { 'x-file-name': encodeURIComponent(file.name || 'chat.txt') } }));
      return Response.redirect(`${scope}#/import?shared=1`, 303);
    }
    const params = new URLSearchParams();
    for (const key of ['url', 'text', 'title']) {
      const value = form.get(key);
      if (typeof value === 'string' && value) params.set(key, value);
    }
    return Response.redirect(`${scope}?${params}`, 303);
  } catch {
    return Response.redirect(scope, 303);
  }
}
