// mat-kon service worker: מקבל שיתוף לאפליקציה (share target).
//   קובץ צ'אט מווטסאפ ("ייצוא צ'אט") נשמר ב-cache ונפתח במסך הייבוא.
//   קישור או טקסט עוברים לאפליקציה כ-?url=... / ?text=... ומתווספים מיד.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(receiveShare(event.request));
  }
});

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
