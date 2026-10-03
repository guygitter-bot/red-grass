// ספר המתכונים: Durable Object אחד שמחזיק את כל המתכונים (כל מתכון במפתח r:<id>).

const PREFIX = 'r:';
const EDITABLE = ['title', 'description', 'category', 'tags', 'servings', 'prepTime', 'cookTime', 'totalTime', 'ingredients', 'steps', 'tips', 'notes', 'favorite', 'myNotes', 'image', 'rating'];

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export class RecipeBook {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const id = url.pathname.split('/')[2] || '';

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
      const saved = existing
        ? { ...recipe, id: existing.id, createdAt: existing.createdAt, updatedAt: now, favorite: existing.favorite, myNotes: existing.myNotes }
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
