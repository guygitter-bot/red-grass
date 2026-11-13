// המדף (Durable Object אחד, "main"): ספרים ששותפו בקישור + המונה היומי של קריאות ה-AI.
//   book:<id>          -> { book, keys: [מפתחות התמונות], secretHash, at }
//   img:<id>:<key>     -> { media_type, data } (כל תמונה בנפרד – יש תקרת גודל לערך)
//   day:<YYYY-MM-DD>   -> { text, images, shares }
// הספר עצמו נשמר אצל מי שיצר אותו (במכשיר); כאן רק עותק לקריאה, שנמחק כשמבטלים את השיתוף.
export const MAX_IMAGE_B64 = 1_200_000;
export const MAX_IMAGES = 40;
const KEY_RE = /^[a-z0-9]{1,24}$/;
const ID_RE = /^[a-z0-9]{16,40}$/;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const randomId = (bytes) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, bytes * 2);

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const str = (s, max) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

// הספר כפי שהוא מוצג לקורא: רק טקסט ושמות, בלי הבריף (מה שסיפרו על האדם נשאר במכשיר של היוצר)
export function cleanSharedBook(b) {
  const title = str(b?.title, 120);
  const chapters = (Array.isArray(b?.chapters) ? b.chapters : [])
    .map((c) => ({ title: str(c?.title, 120), text: str(c?.text, 12000), image: str(c?.image, 24) }))
    .filter((c) => c.title && c.text)
    .slice(0, 20);
  if (!title || !chapters.length) return null;
  return {
    title,
    subtitle: str(b.subtitle, 200),
    dedication: str(b.dedication, 1200),
    name: str(b.name, 80),
    from: str(b.from, 80),
    kid: Boolean(b.kid),
    cover: str(b.cover, 24),
    photos: (Array.isArray(b.photos) ? b.photos : []).map((k) => str(k, 24)).filter(Boolean).slice(0, 12),
    chapters,
  };
}

export function cleanImages(images) {
  const out = {};
  for (const [key, im] of Object.entries(images && typeof images === 'object' ? images : {}).slice(0, MAX_IMAGES)) {
    if (!KEY_RE.test(key) || !im || !IMAGE_TYPES.includes(im.media_type) || typeof im.data !== 'string') continue;
    if (!im.data || im.data.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/]+=*$/.test(im.data)) continue;
    out[key] = { media_type: im.media_type, data: im.data };
  }
  return out;
}

export const today = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

export class Shelf {
  constructor(ctx, env) {
    this.storage = ctx.storage;
    this.env = env;
  }

  // מונה יומי: true אם עוד מותר (וסופר את הקריאה), false אם עברו את התקרה
  async spend(kind) {
    const limit = Number(this.env?.[{ text: 'DAILY_TEXT', images: 'DAILY_IMAGES', shares: 'DAILY_SHARES' }[kind]]) || 0;
    const key = `day:${today()}`;
    const day = (await this.storage.get(key)) || {};
    if (limit && (day[kind] || 0) >= limit) return false;
    await this.storage.put(key, { ...day, [kind]: (day[kind] || 0) + 1 });
    return true;
  }

  async removeImages(id, keys) {
    for (const k of keys || []) await this.storage.delete(`img:${id}:${k}`);
  }

  // שיתוף חדש, או עדכון של ספר שכבר שותף (עם הסוד שלו)
  async share({ book, images, id, secret }) {
    const clean = cleanSharedBook(book);
    if (!clean) return { status: 400, error: 'אין בספר מה לשתף עדיין' };
    const pics = cleanImages(images);
    let old = null;
    if (id) {
      old = ID_RE.test(String(id)) ? await this.storage.get(`book:${id}`) : null;
      if (!old || old.secretHash !== (await sha(String(secret || '')))) return { status: 403, error: 'אי אפשר לעדכן את הקישור הזה' };
    } else {
      if (!(await this.spend('shares'))) return { status: 429, error: 'שותפו היום הרבה ספרים. נסו שוב מחר.' };
      id = randomId(10);
      secret = randomId(12);
    }
    if (old) await this.removeImages(id, old.keys);
    for (const [k, im] of Object.entries(pics)) await this.storage.put(`img:${id}:${k}`, im);
    await this.storage.put(`book:${id}`, { book: clean, keys: Object.keys(pics), secretHash: await sha(secret), at: Date.now() });
    return { status: 200, id, secret };
  }

  async unshare({ id, secret }) {
    const old = ID_RE.test(String(id || '')) ? await this.storage.get(`book:${id}`) : null;
    if (!old) return { status: 200, ok: true };
    if (old.secretHash !== (await sha(String(secret || '')))) return { status: 403, error: 'אי אפשר לבטל את הקישור הזה' };
    await this.removeImages(id, old.keys);
    await this.storage.delete(`book:${id}`);
    return { status: 200, ok: true };
  }

  async read(id) {
    const rec = ID_RE.test(String(id || '')) ? await this.storage.get(`book:${id}`) : null;
    return rec ? { status: 200, book: rec.book, images: rec.keys } : { status: 404, error: 'הספר לא נמצא. אולי הקישור בוטל.' };
  }

  async image(id, key) {
    if (!ID_RE.test(String(id || '')) || !KEY_RE.test(String(key || ''))) return null;
    return (await this.storage.get(`img:${id}:${key}`)) || null;
  }

  // ה-Worker פונה לכאן: POST /spend|/share|/unshare (JSON), GET /book/<id>, GET /img/<id>/<key>
  async fetch(request) {
    const { pathname } = new URL(request.url);
    const json = ({ status = 200, ...data }) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
    const parts = pathname.split('/').filter(Boolean);
    if (request.method === 'GET' && parts[0] === 'book') return json(await this.read(parts[1]));
    if (request.method === 'GET' && parts[0] === 'img') {
      const im = await this.image(parts[1], parts[2]);
      return json(im ? { status: 200, ...im } : { status: 404, error: 'לא נמצא' });
    }
    const body = await request.json().catch(() => ({}));
    if (pathname === '/spend') return json({ ok: await this.spend(body.kind) });
    if (pathname === '/share') return json(await this.share(body));
    if (pathname === '/unshare') return json(await this.unshare(body));
    return json({ status: 404, error: 'לא נמצא' });
  }
}
