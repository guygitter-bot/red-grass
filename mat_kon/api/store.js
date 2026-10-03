// ספר המתכונים: Durable Object אחד שמחזיק את כל המתכונים (כל מתכון במפתח r:<id>).

const PREFIX = 'r:';
const EDITABLE = ['title', 'description', 'category', 'tags', 'servings', 'prepTime', 'cookTime', 'totalTime', 'ingredients', 'steps', 'tips', 'notes', 'favorite', 'myNotes', 'image', 'rating'];

const LIST_LIMITS = { shopping: 500, pantry: 400, plan: 1500 };

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export class RecipeBook {
  constructor(state) {
    this.storage = state.storage;
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
      const recipe = await request.json();
      const all = await this.storage.list({ prefix: PREFIX });
      // אותו מקור (קישור, או הודעת ווטסאפ לפי key) מתעדכן ולא נכפל
      const sourceKey = (r) => r.source?.url || r.source?.key;
      const existing = [...all.values()].find((r) => sourceKey(r) && sourceKey(r) === sourceKey(recipe));
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
      await this.storage.put(PREFIX + saved.id, saved);
      return json({ recipe: saved, updated: Boolean(existing) });
    }

    // מחיקת כל הספר (כשמוחקים משתמש שהוזמן)
    if (request.method === 'DELETE' && !id) {
      await this.storage.deleteAll();
      return json({ ok: true });
    }

    const current = id && (await this.storage.get(PREFIX + id));
    if (!current) return json({ error: 'not found' }, 404);

    if (request.method === 'GET') return json({ recipe: current });

    if (request.method === 'PUT') {
      const patch = await request.json();
      const next = { ...current, updatedAt: new Date().toISOString() };
      for (const k of EDITABLE) if (k in patch) next[k] = patch[k];
      // שדות שהמשתמש ערך בעצמו – רענון מהמקור לא ידרוס אותם
      const edited = EDITABLE.filter((k) => k in patch && !['favorite', 'myNotes', 'rating'].includes(k));
      if (edited.length) next.edited = { ...(current.edited || {}), ...Object.fromEntries(edited.map((k) => [k, true])) };
      await this.storage.put(PREFIX + id, next);
      return json({ recipe: next });
    }

    if (request.method === 'DELETE') {
      await this.storage.delete(PREFIX + id);
      return json({ ok: true });
    }

    return json({ error: 'method not allowed' }, 405);
  }
}
