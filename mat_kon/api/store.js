import { buildRecipe, errorGroup, failure, recipeKind } from './jobs.js';
import { trackedClient } from './deps.js';
import { HIDE_AT_REPORTS, communityIdentity, communityKey, publicCopy, searchCommunity, summarize } from './community.js';
// ספר המתכונים: Durable Object אחד שמחזיק את כל המתכונים (כל מתכון במפתח r:<id>).

const PREFIX = 'r:';
const EDITABLE = ['title', 'description', 'category', 'categories', 'tags', 'servings', 'prepTime', 'cookTime', 'totalTime', 'ingredients', 'steps', 'tips', 'notes', 'favorite', 'myNotes', 'image', 'rating', 'nutrition', 'published'];

const SRC = 'src:';
const CACHE_DAYS = 90; // מתכון במטמון המשותף מתחדש אחרי 3 חודשים
export const MAX_RECIPES = 2000; // תקרה לספר, כדי שאי אפשר יהיה למלא את האחסון
const STALE_JOB_MS = 5 * 60 * 1000;
// המקור של מתכון: קישור, או מפתח (הודעת ווטסאפ, צילום...)
const sourceKey = (r) => String(r?.source?.url || r?.source?.key || '').slice(0, 1500);

const LIST_LIMITS = { shopping: 500, pantry: 400, plan: 1500 };

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export class RecipeBook {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env || {};
  }

  // ---- המאגר עצמו: cs:<key> סיכום לחיפוש, cr:<key> המתכון המלא, rt:<key>:<ספר> דירוג ----
  async summaries() {
    if (!this.index) this.index = new Map([...(await this.storage.list({ prefix: 'cs:' })).values()].map((s) => [s.key, s]));
    return this.index;
  }

  async communityRoute(url, request) {
    const body = request.method === 'POST' ? await request.json() : {};
    const index = await this.summaries();
    const save = async (s) => {
      index.set(s.key, s);
      await this.storage.put(`cs:${s.key}`, s);
    };
    if (url.pathname === '/community/add') {
      for (const { key, recipe } of (body.items || []).slice(0, 2000)) {
        const s = index.get(key);
        if (s) await save({ ...s, saves: s.saves + 1 });
        else if (recipe) {
          await this.storage.put(`cr:${key}`, recipe);
          await save(summarize(key, recipe, { saves: 1, ratingSum: 0, ratingCount: 0 }));
        }
      }
      return json({ ok: true });
    }
    if (url.pathname === '/community/remove') {
      const s = index.get(body.key);
      if (s) {
        const rated = await this.storage.get(`rt:${body.key}:${body.rater}`);
        if (rated) await this.storage.delete(`rt:${body.key}:${body.rater}`);
        await save({ ...s, saves: Math.max(0, s.saves - 1), ratingSum: s.ratingSum - (rated || 0), ratingCount: Math.max(0, s.ratingCount - (rated ? 1 : 0)) });
      }
      return json({ ok: true });
    }
    if (url.pathname === '/community/rate') {
      const s = index.get(body.key);
      const rating = Number.isInteger(body.rating) && body.rating >= 0 && body.rating <= 5 ? body.rating : 0;
      if (s) {
        const k = `rt:${body.key}:${String(body.rater).slice(0, 100)}`;
        const prev = (await this.storage.get(k)) || 0;
        if (rating) await this.storage.put(k, rating);
        else await this.storage.delete(k);
        await save({ ...s, ratingSum: s.ratingSum - prev + rating, ratingCount: s.ratingCount - (prev ? 1 : 0) + (rating ? 1 : 0) });
      }
      return json({ ok: true });
    }
    if (url.pathname === '/community/stats') {
      const all = [...index.values()].filter((s) => s.saves);
      const top = all.sort((a, b) => b.saves - a.saves).slice(0, 10).map((s) => ({ title: s.title, saves: s.saves, ratingCount: s.ratingCount, rating: s.ratingCount ? Math.round((s.ratingSum / s.ratingCount) * 10) / 10 : null, credit: s.credit }));
      return json({ recipes: all.length, saves: all.reduce((n, s) => n + s.saves, 0), ratings: all.reduce((n, s) => n + s.ratingCount, 0), guessed: all.filter((s) => s.basis === 'guessed').length, top });
    }
    if (url.pathname === '/community/search') return json({ results: searchCommunity([...index.values()], body.q || '', body.filters || {}) });
    if (url.pathname === '/community/get') {
      const s = index.get(body.key);
      const recipe = s && s.saves && (!s.hidden || body.admin) && (await this.storage.get(`cr:${body.key}`));
      return recipe ? json({ recipe, summary: s }) : json({ error: 'not found' }, 404);
    }

    // ---- מתכון שמשתמש פרסם בעצמו (עם שם תצוגה) ----
    const unpublish = async (key) => {
      if (!index.has(key)) return;
      index.delete(key);
      const extra = [...(await this.storage.list({ prefix: `rt:${key}:` })).keys(), ...(await this.storage.list({ prefix: `rep:${key}:` })).keys()];
      const keys = [`cs:${key}`, `cr:${key}`, ...extra];
      for (let i = 0; i < keys.length; i += 128) await this.storage.delete(keys.slice(i, i + 128));
    };
    if (url.pathname === '/community/publish') {
      const old = index.get(body.key);
      await this.storage.put(`cr:${body.key}`, body.recipe);
      const stats = old ? { saves: old.saves, ratingSum: old.ratingSum, ratingCount: old.ratingCount } : { saves: 1, ratingSum: 0, ratingCount: 0 };
      await save({
        ...summarize(body.key, body.recipe, stats, body.author), publishedAt: old?.publishedAt || new Date().toISOString(),
        reports: old?.reports || 0, reportReasons: old?.reportReasons || [], hidden: Boolean(old?.hidden),
        flagged: Boolean(body.flagged), flagReason: body.flagged ? String(body.reason || '').slice(0, 200) : '',
      });
      return json({ ok: true });
    }
    if (url.pathname === '/community/unpublish') {
      await unpublish(body.key);
      return json({ ok: true });
    }
    if (url.pathname === '/community/remove-author') {
      for (const s of [...index.values()].filter((x) => x.authorId && x.authorId === body.authorId)) await unpublish(s.key);
      return json({ ok: true });
    }
    // דיווח: פעם אחת לכל ספר; אחרי HIDE_AT_REPORTS דיווחים המתכון מוסתר עד בדיקה
    if (url.pathname === '/community/report') {
      const s = index.get(body.key);
      const k = `rep:${body.key}:${String(body.rater).slice(0, 100)}`;
      if (!s || (await this.storage.get(k))) return json({ ok: true });
      await this.storage.put(k, true);
      const reports = (s.reports || 0) + 1;
      const hidden = s.hidden || (s.personal && reports >= HIDE_AT_REPORTS);
      await save({ ...s, reports, reportReasons: [String(body.reason || '').slice(0, 100), ...(s.reportReasons || [])].slice(0, 5), hidden });
      return json({ ok: true, justHidden: hidden && !s.hidden, title: s.title });
    }
    // לבעל האפליקציה: מה מחכה לבדיקה (דיווחים, או בדיקת AI שלא הייתה בטוחה)
    if (url.pathname === '/community/reports') {
      const list = [...index.values()].filter((s) => s.reports || s.flagged).sort((a, b) => Number(b.hidden) - Number(a.hidden) || (b.reports || 0) - (a.reports || 0));
      return json({ items: list.slice(0, 100).map((s) => ({ key: s.key, title: s.title, author: s.author || '', authorId: s.authorId || '', credit: s.credit, personal: Boolean(s.personal), reports: s.reports || 0, reasons: s.reportReasons || [], flagged: Boolean(s.flagged), flagReason: s.flagReason || '', hidden: Boolean(s.hidden) })) });
    }
    if (url.pathname === '/community/moderate') {
      const s = index.get(body.key);
      if (!s) return json({ error: 'not found' }, 404);
      if (body.action === 'remove') await unpublish(body.key);
      else {
        for (const k of (await this.storage.list({ prefix: `rep:${body.key}:` })).keys()) await this.storage.delete(k);
        await save({ ...s, reports: 0, reportReasons: [], flagged: false, flagReason: '', hidden: false, reviewed: true });
      }
      return json({ ok: true, authorId: s.authorId || '' });
    }
    return json({ error: 'not found' }, 404);
  }

  // מאגר הקהילה (מופע community): כל ספר מדווח על מתכונים מקישורים שנשמרו/נמחקו ועל הדירוג שלו – בלי שמות.
  // תקלה במאגר לא עוצרת את העבודה בספר
  async community(path, body) {
    const stub = this.env.BOOK?.get(this.env.BOOK.idFromName('community'));
    if (!stub) return;
    try {
      await stub.fetch(new Request(`https://do${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    } catch (e) {
      console.error('community', e);
    }
  }

  // מתכון לדיווח: המפתח במאגר, ותוכן ציבורי רק אם הוא כמו שנבנה מהמקור (בלי עריכות, לא שחזור מגיבוי)
  async communityItem(recipe, { fresh = true } = {}) {
    const identity = communityIdentity(recipe);
    if (!identity) return null;
    // תוכן נכנס למאגר רק ממתכון מקישור ציבורי (מתכון אישי מתפרסם רק בפרסום מפורש)
    const original = fresh && Boolean(recipe.source?.url) && !recipe.restored && !(recipe.edited && Object.keys(recipe.edited).length);
    return { key: await communityKey(identity), recipe: original ? publicCopy(recipe) : null };
  }

  // תמונה שהועלתה לספר הזה (קישור /img/<book>/<id>) – נמחקת כשהמתכון נמחק או שהתמונה הוחלפה
  async dropImage(image) {
    const m = typeof image === 'string' && image.match(/\/img\/[^/]+\/([0-9a-f-]{36})$/);
    if (m) await this.storage.delete(`img:${m[1]}`);
  }

  // ---- עבודות ברקע: הוספת מתכון מקישור ממשיכה גם אם האפליקציה נסגרה ----
  async alarm() {
    const jobs = await this.storage.list({ prefix: 'job:' });
    const now = Date.now();
    let next = null;
    for (const [key, job] of jobs) {
      if (now - Date.parse(job.createdAt) > 86400000) {
        await this.storage.delete(key); // עבודות ישנות (יום) נמחקות
      } else if (job.status === 'running' && now - Date.parse(job.startedAt || job.createdAt) > STALE_JOB_MS) {
        // עבודה שנקטעה באמצע (עדכון שרת וכו'): נכשלת, והמכסה חוזרת
        await this.finishJob(key, job, { status: 'error', error: 'העבודה נקטעה. נסו שוב.', code: 502 }, true);
      } else if (job.status === 'pending' && !next) {
        next = [key, job];
      }
    }
    if (!next) {
      const left = [...jobs.values()].filter((j) => j.status === 'running');
      if (left.length) await this.storage.setAlarm(now + STALE_JOB_MS);
      return;
    }
    // עבודה אחת בכל פעם; האזעקה הבאה נקבעת לפני העבודה, כדי שתמשיך גם אם זו נקטעת
    const [key, job] = next;
    await this.storage.put(key, { ...job, status: 'running', startedAt: new Date().toISOString() });
    await this.storage.setAlarm(Date.now() + 1000);
    const done = await this.runJob(job);
    await this.finishJob(key, job, done, false);
  }

  async finishJob(key, job, done, giveBack) {
    if (giveBack && job.quota) {
      const accounts = this.env.ACCOUNTS?.get(this.env.ACCOUNTS.idFromName('accounts'));
      await accounts?.fetch(new Request('https://do/quota/give', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: job.quota.userId }) })).catch(() => {});
    }
    const { input, categories, quota, ...rest } = job;
    void input; void categories; void quota;
    await this.storage.put(key, { ...rest, ...done, finishedAt: new Date().toISOString() });
  }

  async runJob(job) {
    const self = (path, body) => this.fetch(new Request(`https://do${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    const accounts = this.env.ACCOUNTS && this.env.ACCOUNTS.get(this.env.ACCOUNTS.idFromName('accounts'));
    const toAccounts = (path, body) => accounts?.fetch(new Request(`https://do${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).catch(() => {});
    const giveBack = () => job.quota && toAccounts('/quota/give', { userId: job.quota.userId });
    const month = new Date().toISOString().slice(0, 7);
    try {
      const client = trackedClient(this.env, (u) => self('/costs/add', { month, kind: recipeKind(job.input), ...u }));
      const recipe = await buildRecipe(this.env, client, job.input, job.categories);
      delete recipe.more; // מקישור – תמיד מתכון אחד
      const res = await self('/recipes', recipe);
      const data = await res.json();
      if (!data.counted) await giveBack();
      return { status: 'done', recipeId: data.recipe.id, title: data.recipe.title, category: data.recipe.category, updated: data.updated };
    } catch (e) {
      await giveBack();
      await toAccounts('/errors/add', {
        where: 'job', message: String(e?.message || e).slice(0, 300), status: e?.status || null, user: job.quota?.userId || 'owner',
        ...(job.input?.link ? { group: errorGroup(job.input.link, e) } : {}),
      });
      const f = failure(e, { owner: job.owner });
      return { status: 'error', error: f.error, code: f.status };
    }
  }

  // אינדקס מקור -> מתכון (נבנה פעם אחת לספרים שנוצרו לפניו)
  // מספר המתכונים בספר (נספר פעם אחת מהאחסון, ואחר כך מתעדכן בהוספה ובמחיקה)
  async recipeCount() {
    const stored = await this.storage.get('recipe-count');
    if (typeof stored === 'number') return stored;
    const count = (await this.storage.list({ prefix: PREFIX })).size;
    await this.storage.put('recipe-count', count);
    return count;
  }

  async ensureSourceIndex() {
    if (await this.storage.get('src-indexed')) return;
    const all = await this.storage.list({ prefix: PREFIX });
    const entries = {};
    for (const r of all.values()) {
      const key = sourceKey(r);
      if (key) entries[SRC + key] = r.id;
    }
    const keys = Object.keys(entries);
    for (let i = 0; i < keys.length; i += 128) {
      await this.storage.put(Object.fromEntries(keys.slice(i, i + 128).map((k) => [k, entries[k]])));
    }
    await this.storage.put('src-indexed', true);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const id = url.pathname.split('/')[2] || '';

    // ---- מטמון משותף של מתכונים מקישורים (רק במופע recipe-cache, ראו jobs.js) ----
    if (url.pathname === '/cache/get' && request.method === 'POST') {
      const { keys } = await request.json();
      for (const k of (Array.isArray(keys) ? keys : []).slice(0, 4)) {
        const hit = await this.storage.get(`cache:${k}`);
        if (hit && Date.now() - hit.at < CACHE_DAYS * 86400000) return json({ recipe: hit.recipe });
      }
      return json({ recipe: null });
    }
    if (url.pathname === '/cache/put' && request.method === 'POST') {
      const { keys, recipe } = await request.json();
      if (!recipe || JSON.stringify(recipe).length > 100000) return json({ ok: false });
      for (const k of (Array.isArray(keys) ? keys : []).slice(0, 4)) await this.storage.put(`cache:${k}`, { at: Date.now(), recipe });
      // ניקוי מדי פעם של מתכונים ישנים במטמון
      if (Math.random() < 0.02) {
        const old = [...(await this.storage.list({ prefix: 'cache:' }))].filter(([, v]) => Date.now() - v.at > CACHE_DAYS * 86400000).map(([k]) => k);
        for (let i = 0; i < old.length; i += 128) await this.storage.delete(old.slice(i, i + 128));
      }
      return json({ ok: true });
    }

    // ---- מאגר הקהילה (רק במופע community) ----
    if (url.pathname.startsWith('/community/')) return this.communityRoute(url, request);

    // ---- גיבוי (רק מתוך השרת, backup.js): כל הנתונים בלי התמונות, והתמונות אחת-אחת ----
    if (url.pathname === '/backup/export' && request.method === 'GET') {
      const data = {};
      const images = [];
      for (const [k, v] of await this.storage.list()) {
        if (k.startsWith('img:')) images.push(k.slice(4));
        else data[k] = v;
      }
      return json({ data, images });
    }
    if (url.pathname === '/backup/import' && request.method === 'POST') {
      const { data } = await request.json();
      await this.storage.deleteAll();
      const entries = Object.entries(data || {});
      for (let i = 0; i < entries.length; i += 128) await this.storage.put(Object.fromEntries(entries.slice(i, i + 128)));
      return json({ ok: true, keys: entries.length });
    }
    if (url.pathname === '/backup/image' && request.method === 'POST') {
      const { id: imageId, type, data } = await request.json();
      await this.storage.put(`img:${imageId}`, { type, bytes: Uint8Array.from(atob(data), (c) => c.charCodeAt(0)) });
      return json({ ok: true });
    }

    // שינויים ברמת פריט ברשימות המשותפות (קניות, מלאי, תכנון): כל שינוי חל על הרשימה העדכנית,
    // כך ששני בני משפחה שעורכים בו-זמנית לא מוחקים זה לזה. {ops: [{op: add|update|remove, id, item}]}
    const opsMatch = url.pathname.match(/^\/ops\/(shopping|pantry|plan)$/);
    if (opsMatch && request.method === 'POST') {
      const key = opsMatch[1];
      const { ops } = await request.json();
      const stored = await this.storage.get(key);
      // התכנון נשמר לפי ימים – כאן הוא רשימה שטוחה של ארוחות עם day
      let list = key === 'plan'
        ? Object.entries(stored || {}).flatMap(([day, meals]) => meals.map((m) => ({ ...m, day })))
        : [...(stored || [])];
      for (const o of ops) {
        const at = list.findIndex((x) => x.id === o.id);
        if (o.op === 'remove') {
          if (at >= 0) list.splice(at, 1);
        } else if (o.op === 'update') {
          if (at >= 0) list[at] = o.item; // פריט שמישהו אחר כבר מחק – נשאר מחוק
        } else if (o.op === 'add' && at < 0) {
          list.push(o.item);
        }
      }
      list = list.slice(-LIST_LIMITS[key]);
      let value = list;
      if (key === 'plan') {
        value = {};
        for (const { day, ...meal } of list) (value[day] ||= []).push(meal);
        for (const d of Object.keys(value)) value[d] = value[d].slice(0, 12);
      }
      await this.storage.put(key, value);
      return json(key === 'plan' ? { plan: value } : { items: value });
    }

    // תמונות שהועלו: נשמרות כקובץ בינארי במפתח נפרד
    if (url.pathname === '/img' && request.method === 'POST') {
      const { type, data } = await request.json();
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      if (bytes.byteLength > 400 * 1024) return json({ error: 'too large' }, 413);
      const imageId = crypto.randomUUID();
      await this.storage.put(`img:${imageId}`, { type, bytes });
      return json({ id: imageId });
    }
    if (url.pathname.startsWith('/img/') && request.method === 'GET') {
      const img = await this.storage.get(`img:${url.pathname.slice(5)}`);
      if (!img) return json({ error: 'not found' }, 404);
      return new Response(img.bytes, { headers: { 'content-type': img.type } });
    }

    // עבודה חדשה ברקע / מצב עבודה
    if (url.pathname === '/jobs' && request.method === 'POST') {
      const { input, categories, quota, owner } = await request.json();
      const job = { id: crypto.randomUUID(), status: 'pending', createdAt: new Date().toISOString(), link: input.link, input, categories, quota, owner };
      await this.storage.put(`job:${job.id}`, job);
      await this.storage.setAlarm(Date.now());
      return json({ job: { id: job.id, status: job.status, link: job.link } }, 202);
    }
    if (url.pathname.startsWith('/jobs/') && request.method === 'GET') {
      const job = await this.storage.get(`job:${url.pathname.slice(6)}`);
      if (!job) return json({ error: 'not found' }, 404);
      const { input, categories, quota, ...pub } = job;
      void input; void categories; void quota;
      return json({ job: pub });
    }

    // מעקב עלויות AI לפי חודש: טוקנים, חיפושים ופעולות
    if (url.pathname === '/costs/add' && request.method === 'POST') {
      const { month, input = 0, output = 0, searches = 0, kind, first } = await request.json();
      const key = `costs:${month}`;
      const c = (await this.storage.get(key)) || { ops: 0, calls: 0, input: 0, output: 0, searches: 0 };
      Object.assign(c, { calls: c.calls + 1, input: c.input + input, output: c.output + output, searches: c.searches + searches });
      // פירוט לפי סוג פעולה (מתכון מסרטון, חיפוש ברשת…): כמה פעמים ומה נצרך
      const k = typeof kind === 'string' && /^[a-z-]{2,30}$/.test(kind) ? kind : 'other';
      const byKind = c.byKind || (c.byKind = {});
      const row = byKind[k] || (byKind[k] = { ops: 0, input: 0, output: 0, searches: 0 });
      Object.assign(row, { ops: row.ops + (first ? 1 : 0), input: row.input + input, output: row.output + output, searches: row.searches + searches });
      await this.storage.put(key, c);
      return json(c);
    }
    if (url.pathname.startsWith('/costs/') && request.method === 'GET') {
      return json((await this.storage.get(`costs:${url.pathname.slice(7)}`)) || { ops: 0, calls: 0, input: 0, output: 0, searches: 0 });
    }

    // תקציב יומי לפעולות AI של הספר: {day, limit, cost}. הבדיקה והספירה באותו צעד (בלי מרוץ)
    if (url.pathname === '/usage/take' && request.method === 'POST') {
      const { day, limit, cost = 1 } = await request.json();
      const usage = (await this.storage.get('usage')) || {};
      if (usage.day !== day) Object.assign(usage, { day, used: 0 });
      if (usage.used + cost > limit) return json({ error: 'limit', used: usage.used }, 429);
      usage.used += cost;
      await this.storage.put('usage', usage);
      const costsKey = `costs:${day.slice(0, 7)}`;
      const c = (await this.storage.get(costsKey)) || { ops: 0, calls: 0, input: 0, output: 0, searches: 0 };
      c.ops += cost;
      await this.storage.put(costsKey, c);
      return json({ used: usage.used, limit });
    }

    // תכנון הארוחות של הספר: { "2026-10-04": [{ id, recipeId?, title, note? }] }
    if (url.pathname === '/plan') {
      if (request.method === 'GET') return json({ plan: (await this.storage.get('plan')) || {} });
      if (request.method === 'PUT') {
        const { plan } = await request.json();
        await this.storage.put('plan', plan);
        return json({ plan });
      }
      return json({ error: 'method not allowed' }, 405);
    }

    // קטגוריות שהמשתמש הוסיף לספר
    if (url.pathname === '/categories') {
      if (request.method === 'GET') return json({ custom: (await this.storage.get('categories')) || [] });
      if (request.method === 'PUT') {
        const { custom } = await request.json();
        await this.storage.put('categories', custom);
        return json({ custom });
      }
      return json({ error: 'method not allowed' }, 405);
    }
    // סדר הקטגוריות במסך ומועדפות (משותף לכל מי שבספר)
    if (url.pathname === '/category-prefs') {
      if (request.method === 'GET') return json((await this.storage.get('categoryPrefs')) || { order: [], favorites: [] });
      if (request.method === 'PUT') {
        const prefs = await request.json();
        await this.storage.put('categoryPrefs', prefs);
        return json(prefs);
      }
      return json({ error: 'method not allowed' }, 405);
    }
    // מחיקת קטגוריה: המתכונים שבה עוברים ל"אחר"
    if (url.pathname === '/categories/remove' && request.method === 'POST') {
      const { name } = await request.json();
      const custom = ((await this.storage.get('categories')) || []).filter((c) => c !== name);
      await this.storage.put('categories', custom);
      const all = await this.storage.list({ prefix: PREFIX });
      let moved = 0;
      for (const r of all.values()) {
        const cats = Array.isArray(r.categories) ? r.categories : [r.category];
        if (cats.includes(name)) {
          const left = cats.filter((c) => c !== name);
          const fixed = left.length ? { category: left[0], categories: left } : { category: 'אחר', categories: ['אחר'] };
          await this.storage.put(PREFIX + r.id, { ...r, ...fixed, updatedAt: new Date().toISOString() });
          moved += 1;
        }
      }
      return json({ custom, moved });
    }

    // המלאי בבית: מה יש במקרר ובמזווה
    if (url.pathname === '/pantry') {
      if (request.method === 'GET') return json({ items: (await this.storage.get('pantry')) || [] });
      if (request.method === 'PUT') {
        const { items } = await request.json();
        await this.storage.put('pantry', items);
        return json({ items });
      }
      return json({ error: 'method not allowed' }, 405);
    }

    // רשימת הקניות של הספר
    if (url.pathname === '/shopping') {
      if (request.method === 'GET') return json({ items: (await this.storage.get('shopping')) || [] });
      if (request.method === 'PUT') {
        const { items } = await request.json();
        await this.storage.put('shopping', items);
        return json({ items });
      }
      return json({ error: 'method not allowed' }, 405);
    }

    if (request.method === 'GET' && !id) {
      const all = await this.storage.list({ prefix: PREFIX });
      const recipes = [...all.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      // פעם אחת לכל ספר: מתכונים מקישורים שנשמרו לפני שהיה מאגר קהילה נכנסים אליו
      if (!(await this.storage.get('community-bf'))) {
        const items = (await Promise.all(recipes.filter((r) => !r.community).map((r) => this.communityItem(r)))).filter(Boolean);
        if (items.length) await this.community('/community/add', { items });
        await this.storage.put('community-bf', true);
      }
      return json({ recipes });
    }

    // מתכון חדש (אחרי שהסוכן הוציא אותו). קישור שכבר נשמר מתעדכן במקום להיכפל.
    if (request.method === 'POST' && !id) {
      if (await this.storage.get('closed')) return json({ error: 'gone' }, 410); // ספר שנמחק
      const recipe = await request.json();
      // אותו מקור (קישור, או הודעת ווטסאפ לפי key) מתעדכן ולא נכפל. האינדקס src: חוסך מעבר על כל הספר
      await this.ensureSourceIndex();
      const key = sourceKey(recipe);
      const existingId = key && (await this.storage.get(SRC + key));
      const existing = existingId && (await this.storage.get(PREFIX + existingId));
      const now = new Date().toISOString();
      // רענון / אותו קישור שוב: מה שהמשתמש ערך או הוסיף בעצמו נשמר (בשחזור מגיבוי – הגיבוי קובע)
      const keep = {};
      if (existing && url.searchParams.get('replace') !== '1') {
        for (const k of ['favorite', 'myNotes', 'rating', ...Object.keys(existing.edited || {})]) {
          if (existing[k] !== undefined) keep[k] = existing[k];
        }
        if (existing.edited) keep.edited = existing.edited;
        if (!recipe.image && existing.image) keep.image = existing.image;
      }
      if (!existing) {
        const count = await this.recipeCount();
        if (count >= MAX_RECIPES) {
          return json({ error: `בספר כבר יש ${MAX_RECIPES} מתכונים – זה המקסימום` }, 413);
        }
        await this.storage.put('recipe-count', count + 1);
      }
      const saved = existing
        ? { ...recipe, ...keep, id: existing.id, createdAt: existing.createdAt, updatedAt: now }
        : { ...recipe, id: crypto.randomUUID(), createdAt: typeof recipe.createdAt === 'string' ? recipe.createdAt : now, updatedAt: now };
      // הקטגוריה הראשית תמיד ראשונה ברשימת הקטגוריות (גם כשהמשתמש ערך רק אותה)
      if (saved.category) saved.categories = [saved.category, ...(Array.isArray(saved.categories) ? saved.categories : []).filter((c) => c !== saved.category)].slice(0, 4);
      // "שוחזר ועוד לא נקרא מהמקור" – רק למתכון שלא היה בספר (שחזור לאותו ספר לא מחייב שוב במכסה)
      if (url.searchParams.get('replace') !== '1' || (existing && !existing.restored)) delete saved.restored;
      // שחזור לא מחליף את המקור של מתכון שכבר נקרא (אחרת "רענון" חינמי היה קורא טקסט חדש בלי מכסה)
      if (url.searchParams.get('replace') === '1' && existing && !existing.restored) saved.source = existing.source;
      // מתכון חדש בספר: נספר במאגר הקהילה (שחזור מגיבוי – רק נספר, בלי תוכן). community: כבר נספר
      const item = !existing && (await this.communityItem(saved, { fresh: url.searchParams.get('replace') !== '1' }));
      if (item || existing?.community) saved.community = true;
      await this.storage.put(PREFIX + saved.id, saved);
      if (existing && existing.image !== saved.image) await this.dropImage(existing.image);
      if (item) await this.community('/community/add', { items: [item] });
      if (key) await this.storage.put(SRC + key, saved.id);
      // counted: נוסף מתכון חדש (או שמתכון שרק שוחזר מגיבוי נקרא עכשיו לראשונה) – נספר במכסה
      // מתכון מטקסט חדש (טקסט אחר מזה שכבר נשמר לאותו מקור) הוא עבודה חדשה, ולכן גם הוא נספר
      const newText = Boolean(recipe.source?.text) && existing?.source?.text !== recipe.source.text;
      return json({ recipe: saved, updated: Boolean(existing), counted: !existing || Boolean(existing.restored) || newText });
    }

    // מחיקת כל הספר (כשמוחקים משתמש שהוזמן)
    if (request.method === 'DELETE' && !id) {
      await this.storage.deleteAll();
      await this.storage.put('closed', true); // עבודה ברקע שעוד רצה לא תכתוב לספר שנמחק
      return json({ ok: true });
    }

    const current = id && (await this.storage.get(PREFIX + id));
    if (!current) return json({ error: 'not found' }, 404);

    if (request.method === 'GET') return json({ recipe: current });

    if (request.method === 'PUT') {
      const patch = await request.json();
      const next = { ...current, updatedAt: new Date().toISOString() };
      // תמונה שהועלתה לספר שייכת למתכון אחד: אי אפשר לכוון מתכון לתמונה של מתכון אחר (ואז למחוק אותה)
      if (typeof patch.image === 'string' && /\/img\/[^/]+\/[0-9a-f-]{36}$/.test(patch.image) && patch.image !== current.image && !patch.imageFresh) delete patch.image;
      delete patch.imageFresh;
      for (const k of EDITABLE) if (k in patch) next[k] = patch[k];
      // קטגוריה ראשית בלבד (גרסה ישנה של האפליקציה): נכנסת ראשונה, ושאר הקטגוריות נשארות
      if ('category' in patch && !('categories' in patch)) {
        next.categories = [patch.category, ...(current.categories || []).filter((c) => c !== patch.category && c !== 'אחר')].slice(0, 4);
      }
      // סידור הקטגוריות על ידי הסוכן (פעם אחת לכל מתכון)
      if (patch.categorized) next.categorized = true;
      // שדות שהמשתמש ערך בעצמו – רענון מהמקור לא ידרוס אותם
      const edited = EDITABLE.filter((k) => k in patch && !['favorite', 'myNotes', 'rating', 'nutrition', 'published'].includes(k) && !patch.categorized);
      if (edited.length) next.edited = { ...(current.edited || {}), ...Object.fromEntries(edited.map((k) => [k, true])) };
      await this.storage.put(PREFIX + id, next);
      if ('image' in patch && current.image !== next.image) await this.dropImage(current.image);
      // דירוג (אחד לכל ספר) נספר בדירוג המשותף של המתכון
      const identity = 'rating' in patch && (current.rating || 0) !== (next.rating || 0) && communityIdentity(current);
      if (identity) await this.community('/community/rate', { key: await communityKey(identity), rater: this.state.id?.toString?.() || 'book', rating: next.rating || 0 });
      return json({ recipe: next });
    }

    if (request.method === 'DELETE') {
      await this.storage.delete(PREFIX + id);
      await this.storage.put('recipe-count', Math.max(0, (await this.recipeCount()) - 1));
      const identity = communityIdentity(current);
      if (identity) await this.community('/community/remove', { key: await communityKey(identity), rater: this.state.id?.toString?.() || 'book' });
      if (current.published) await this.community('/community/unpublish', { key: current.published });
      await this.dropImage(current.image);
      const key = sourceKey(current);
      if (key) await this.storage.delete(SRC + key);
      return json({ ok: true });
    }

    return json({ error: 'method not allowed' }, 405);
  }
}
