import { buildRecipe, failure } from './jobs.js';
import { trackedClient } from './deps.js';
// ספר המתכונים: Durable Object אחד שמחזיק את כל המתכונים (כל מתכון במפתח r:<id>).

const PREFIX = 'r:';
const EDITABLE = ['title', 'description', 'category', 'tags', 'servings', 'prepTime', 'cookTime', 'totalTime', 'ingredients', 'steps', 'tips', 'notes', 'favorite', 'myNotes', 'image', 'rating'];

const SRC = 'src:';
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
      const client = trackedClient(this.env, (u) => self('/costs/add', { month, ...u }));
      const recipe = await buildRecipe(this.env, client, job.input, job.categories);
      const res = await self('/recipes', recipe);
      const data = await res.json();
      if (!data.counted) await giveBack();
      return { status: 'done', recipeId: data.recipe.id, title: data.recipe.title, category: data.recipe.category, updated: data.updated };
    } catch (e) {
      await giveBack();
      await toAccounts('/errors/add', { where: 'job', message: String(e?.message || e).slice(0, 300), status: e?.status || null, user: job.quota?.userId || 'owner' });
      const f = failure(e, { owner: job.owner });
      return { status: 'error', error: f.error, code: f.status };
    }
  }

  // אינדקס מקור -> מתכון (נבנה פעם אחת לספרים שנוצרו לפניו)
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
      const { month, input = 0, output = 0, searches = 0 } = await request.json();
      const key = `costs:${month}`;
      const c = (await this.storage.get(key)) || { ops: 0, calls: 0, input: 0, output: 0, searches: 0 };
      Object.assign(c, { calls: c.calls + 1, input: c.input + input, output: c.output + output, searches: c.searches + searches });
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
        if (r.category === name) {
          await this.storage.put(PREFIX + r.id, { ...r, category: 'אחר', updatedAt: new Date().toISOString() });
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
      const saved = existing
        ? { ...recipe, ...keep, id: existing.id, createdAt: existing.createdAt, updatedAt: now }
        : { ...recipe, id: crypto.randomUUID(), createdAt: typeof recipe.createdAt === 'string' ? recipe.createdAt : now, updatedAt: now };
      // "שוחזר ועוד לא נקרא מהמקור" – רק למתכון שלא היה בספר (שחזור לאותו ספר לא מחייב שוב במכסה)
      if (url.searchParams.get('replace') !== '1' || (existing && !existing.restored)) delete saved.restored;
      await this.storage.put(PREFIX + saved.id, saved);
      if (existing && existing.image !== saved.image) await this.dropImage(existing.image);
      if (key) await this.storage.put(SRC + key, saved.id);
      // counted: נוסף מתכון חדש (או שמתכון שרק שוחזר מגיבוי נקרא עכשיו לראשונה) – נספר במכסה
      return json({ recipe: saved, updated: Boolean(existing), counted: !existing || Boolean(existing.restored) });
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
      // שדות שהמשתמש ערך בעצמו – רענון מהמקור לא ידרוס אותם
      const edited = EDITABLE.filter((k) => k in patch && !['favorite', 'myNotes', 'rating'].includes(k));
      if (edited.length) next.edited = { ...(current.edited || {}), ...Object.fromEntries(edited.map((k) => [k, true])) };
      await this.storage.put(PREFIX + id, next);
      if ('image' in patch && current.image !== next.image) await this.dropImage(current.image);
      return json({ recipe: next });
    }

    if (request.method === 'DELETE') {
      await this.storage.delete(PREFIX + id);
      await this.dropImage(current.image);
      const key = sourceKey(current);
      if (key) await this.storage.delete(SRC + key);
      return json({ ok: true });
    }

    return json({ error: 'method not allowed' }, 405);
  }
}
