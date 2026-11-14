// הסטודיו (Durable Object). אותה מחלקה משמשת בשני תפקידים, לפי שם המופע:
// "main" – הסיסמה של האפליקציה + המונה היומי של קריאות ה-AI:
//   pass               -> { hash, salt } (נקבעת בכניסה הראשונה; מי שנכנס ראשון קובע אותה)
//   day:<YYYY-MM-DD>   -> { plans, stills, clips }
//   fails              -> { n, until } (נעילה קצרה אחרי הרבה ניסיונות שגויים)
// "job:<מזהה>" – עבודה אחת של יצירת סרטון. הקריאה ל-Google נשארת פתוחה דקה ויותר, ולכן היא רצה ב-alarm (ברקע),
// והאפליקציה רק שואלת אם הסרטון מוכן. הכול נמחק אחרי יומיים:
//   job                -> { status: queued / working / done / failed, at, motion, aspect, quality, imageType, imageParts,
//                           model?, resolution?, uri?, videoType?, videoParts?, error?, detail? }
//   img:<n>            -> חלקי הפריים (base64, עד מיליון תווים – יש תקרת גודל לערך)
//   vid:<n>            -> חלקי הסרטון, רק אם Google החזירה אותו בגוף התשובה ולא ככתובת
import { generateClip, fetchClipFile } from './video.js';

export const MIN_PASSWORD = 6;
const LIMITS = { plans: 'DAILY_PLANS', stills: 'DAILY_STILLS', clips: 'DAILY_CLIPS' };
const MAX_FAILS = 8;
const LOCK_MS = 10 * 60 * 1000;
const PART = 1_000_000; // מתחלק ב-4, כדי שכל חלק של base64 יהיה תקין בפני עצמו
const KEEP_MS = 48 * 60 * 60 * 1000;
const CALL_MS = 12 * 60 * 1000;

const bytesOf = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const today = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

export class Studio {
  constructor(ctx, env) {
    this.storage = ctx.storage;
    this.env = env;
  }

  // ---- עבודה של סרטון (מופע "job:<מזהה>") ----

  // שומר את הבקשה ומתחיל לעבוד ברקע
  async startJob({ image, motion, aspect, quality }) {
    const parts = Math.ceil(image.data.length / PART);
    for (let i = 0; i < parts; i++) await this.storage.put(`img:${i}`, image.data.slice(i * PART, (i + 1) * PART));
    await this.storage.put('job', { status: 'queued', at: Date.now(), motion, aspect, quality, imageType: image.media_type, imageParts: parts });
    await this.storage.setAlarm(Date.now());
  }

  async finishJob(job, patch) {
    for (let i = 0; i < (job.imageParts || 0); i++) await this.storage.delete(`img:${i}`);
    await this.storage.put('job', { ...job, ...patch, imageParts: 0 });
    await this.storage.setAlarm(Date.now() + KEEP_MS);
  }

  // סרטון שנכשל לא נספר בתקרה היומית
  async failJob(job, error, detail) {
    await this.finishJob(job, { status: 'failed', error, detail: detail || '' });
    try {
      const main = this.env.STUDIO.get(this.env.STUDIO.idFromName('main'));
      await main.fetch(new Request('https://studio/refund', { method: 'POST', body: JSON.stringify({ kind: 'clips' }) }));
    } catch { /* ההחזר למונה לא קריטי */ }
  }

  async alarm() {
    const job = await this.storage.get('job');
    if (!job) return;
    // עברו יומיים: מוחקים הכול
    if (job.status === 'done' || job.status === 'failed') return this.storage.deleteAll();
    // ה-alarm רץ שוב באמצע עבודה (השרת התחיל מחדש): לא יוצרים פעמיים – זה עולה כסף
    if (job.status === 'working') return this.failJob(job, 'יצירת הסרטון נקטעה. נסו שוב.', 'alarm restarted');
    await this.storage.put('job', { ...job, status: 'working' });
    try {
      let data = '';
      for (let i = 0; i < job.imageParts; i++) data += (await this.storage.get(`img:${i}`)) || '';
      const out = await generateClip(this.env, { media_type: job.imageType, data }, job.motion, job.aspect, job.quality, AbortSignal.timeout(CALL_MS));
      const done = { status: 'done', model: out.model, resolution: out.resolution, videoType: out.type };
      if (out.uri) return await this.finishJob(job, { ...done, uri: out.uri });
      // הסרטון הגיע בגוף התשובה: שומרים אותו כאן בחלקים
      const parts = Math.ceil(out.data.length / PART);
      for (let i = 0; i < parts; i++) await this.storage.put(`vid:${i}`, bytesOf(out.data.slice(i * PART, (i + 1) * PART)));
      await this.finishJob(job, { ...done, videoParts: parts });
    } catch (e) {
      await this.failJob(job, e?.message || 'מחולל הווידאו לא הצליח ליצור את הסרטון. נסו שוב.', e?.detail);
    }
  }

  // מצב העבודה, כמו שהאפליקציה רואה אותו
  async jobState() {
    const job = await this.storage.get('job');
    if (!job) return { done: true, error: 'הסרטון כבר לא נמצא בשרת (נשמר רק יומיים). צריך ליצור אותו מחדש.' };
    if (job.status === 'failed') return { done: true, error: job.error, detail: job.detail || '' };
    if (job.status === 'done') return { done: true, resolution: job.resolution || '', model: job.model || '' };
    return { done: false };
  }

  // הקובץ של סרטון מוכן
  async jobFile() {
    const job = await this.storage.get('job');
    if (job?.status !== 'done') return new Response(JSON.stringify({ error: 'הסרטון עוד לא מוכן.' }), { status: 409 });
    const type = /^video\//.test(job.videoType || '') ? job.videoType : 'video/mp4';
    if (job.uri) {
      try {
        const res = await fetchClipFile(this.env, job.uri);
        const length = res.headers.get('content-length');
        return new Response(res.body, { headers: { 'content-type': type, ...(length ? { 'content-length': length } : {}) } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, detail: e.detail || '' }), { status: 502 });
      }
    }
    const storage = this.storage;
    let i = 0;
    const body = new ReadableStream({
      async pull(controller) {
        if (i >= job.videoParts) return controller.close();
        controller.enqueue(await storage.get(`vid:${i++}`));
      },
    });
    return new Response(body, { headers: { 'content-type': type } });
  }

  // ---- סיסמה ותקרה יומית (מופע "main") ----

  // בדיקת סיסמה. בפעם הראשונה (create) היא נקבעת. מחזיר { ok } או { ok: false, code }
  async check(password, create) {
    const pass = await this.storage.get('pass');
    if (typeof password !== 'string' || !password) return { ok: false, code: pass ? 'bad_password' : 'no_password' };
    if (!pass) {
      if (!create) return { ok: false, code: 'no_password' };
      if (password.length < MIN_PASSWORD || password.length > 200) return { ok: false, code: 'short_password' };
      const salt = crypto.randomUUID();
      await this.storage.put('pass', { salt, hash: await sha(salt + password) });
      return { ok: true, created: true };
    }
    const fails = (await this.storage.get('fails')) || { n: 0, until: 0 };
    if (fails.until > Date.now()) return { ok: false, code: 'locked' };
    if ((await sha(pass.salt + password.slice(0, 200))) === pass.hash) {
      if (fails.n) await this.storage.delete('fails');
      return { ok: true };
    }
    const n = fails.n + 1;
    await this.storage.put('fails', n >= MAX_FAILS ? { n: 0, until: Date.now() + LOCK_MS } : { n, until: 0 });
    return { ok: false, code: 'bad_password' };
  }

  // מונה יומי: true אם עוד מותר (וסופר את הקריאה), false אם עברו את התקרה
  async spend(kind) {
    if (!LIMITS[kind]) return false;
    const limit = Number(this.env?.[LIMITS[kind]]) || 0;
    const key = `day:${today()}`;
    const day = (await this.storage.get(key)) || {};
    if (limit && (day[kind] || 0) >= limit) return false;
    await this.storage.put(key, { ...day, [kind]: (day[kind] || 0) + 1 });
    return true;
  }

  // קריאה שנכשלה לא נספרת
  async refund(kind) {
    const key = `day:${today()}`;
    const day = (await this.storage.get(key)) || {};
    if (day[kind] > 0) await this.storage.put(key, { ...day, [kind]: day[kind] - 1 });
  }

  async fetch(request) {
    const { pathname } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const reply = (data) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
    if (pathname === '/job/start') { await this.startJob(body); return reply({ ok: true }); }
    if (pathname === '/job/state') return reply(await this.jobState());
    if (pathname === '/job/file') return this.jobFile();
    if (pathname === '/state') return reply({ hasPassword: Boolean(await this.storage.get('pass')) });
    if (pathname === '/check') return reply(await this.check(body.password, body.create === true));
    if (pathname === '/spend') return reply({ ok: await this.spend(body.kind) });
    if (pathname === '/refund') { await this.refund(body.kind); return reply({ ok: true }); }
    return new Response('{}', { status: 404 });
  }
}
