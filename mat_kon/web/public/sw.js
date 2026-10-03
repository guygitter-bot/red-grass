// mat-kon service worker:
//   1. שיתוף לאפליקציה (share target): קובץ צ'אט מווטסאפ נשמר ב-cache ונפתח במסך הייבוא;
//      קישור או טקסט עוברים לאפליקציה כ-?url=... / ?text=...
//   2. עבודה בלי אינטרנט: האפליקציה עצמה (דפים, קבצים, אייקונים) ותמונות מתכונים נשמרים במטמון.
//      המתכונים עצמם שמורים במכשיר (IndexedDB), כך שאפשר לפתוח ולקרוא גם בלי רשת.
// הגרסה ורשימת הקבצים נכתבות בזמן הבנייה (vite.config.js) – כל עדכון מתקין את עצמו ומנקה את הישן
const BUILD = '__BUILD__';
const PRECACHE = [/*PRECACHE*/];
const SHELL = `matkon-shell-${BUILD}`;
const IMAGES = 'matkon-images-v1';
const API_HOST = /(^|\.)workers\.dev$/;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // שמירה מראש של האפליקציה: נפתחת בלי רשת כבר אחרי הביקור הראשון
    await Promise.all(PRECACHE.map((f) => cache.add(new Request(f, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('matkon-') && ![SHELL, IMAGES, 'matkon-share'].includes(name)) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

// יציאה מהחשבון: מוחקים תמונות ושיתופים שנשמרו
self.addEventListener('message', (event) => {
  if (event.data === 'clear-user-caches') {
    event.waitUntil(Promise.all([caches.delete(IMAGES), caches.delete('matkon-share')]));
  }
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
  // סרטוני הדרכה: ישר מהרשת (הדפדפן מבקש אותם בחלקים, ולא שומרים אותם במטמון)
  if (sameOrigin && url.pathname.endsWith('.mp4')) return;
  // קבצי האפליקציה (עם שם שמשתנה בכל גרסה) ואייקונים: מהמטמון, ומתעדכנים ברקע
  if (sameOrigin && !url.pathname.endsWith('sw.js')) {
    event.respondWith(staleWhileRevalidate(SHELL, request));
    return;
  }
  // תמונות מתכונים שהועלו (רק מהשרת שלנו) – לא משתנות לעולם
  if (API_HOST.test(url.hostname) && /\/img\/[^/]+\/[0-9a-f-]{36}$/.test(url.pathname)) {
    event.respondWith(cacheFirst(IMAGES, request));
  }
});

// דף האפליקציה: מהרשת, אבל אם הרשת איטית (מעל 3 שניות) או לא קיימת – מהמטמון
async function networkFirst(request, fallbackKey) {
  const cache = await caches.open(SHELL);
  const fromCache = async () => (await cache.match(fallbackKey)) || (await cache.match(request));
  const network = fetch(request).then((res) => {
    if (res.ok) cache.put(fallbackKey, res.clone());
    return res;
  });
  const slow = new Promise((resolve) => setTimeout(resolve, 3000)).then(fromCache);
  try {
    const first = await Promise.race([network, slow]);
    return first || (await network);
  } catch {
    return (await fromCache()) || Response.error();
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
    // קישור או טקסט: נשמרים במטמון (ולא בכתובת), כדי שקישור מזויף מבחוץ לא יוסיף מתכון בלי לשאול
    const shared = {};
    for (const key of ['url', 'text', 'title']) {
      const value = form.get(key);
      if (typeof value === 'string' && value) shared[key] = value.slice(0, 20000);
    }
    const cache = await caches.open('matkon-share');
    await cache.put('shared-link', new Response(JSON.stringify(shared), { headers: { 'content-type': 'application/json' } }));
    return Response.redirect(`${scope}?shared=link`, 303);
  } catch {
    return Response.redirect(scope, 303);
  }
}
