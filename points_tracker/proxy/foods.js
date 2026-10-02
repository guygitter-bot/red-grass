// מאגר מאכלים משותף לכל מי שמשתמש באפליקציה (Durable Object עם אחסון SQLite, חינמי).
// הוספה: כל מי שיש לו קוד גישה. מאכל שכבר קיים באותו שם לא נדרס.
// עריכה ומחיקה לכולם: רק עם קוד מנהל.

const MAX_FOODS = 5000;
const SOURCES = new Set(['user', 'ai', 'agent']);

// אותו נרמול כמו ב-web/src/lib/foodDb.js
export function normalize(text) {
  return String(text || '')
    .replace(/[֑-ׇ]/g, '')
    .replace(/["'`׳״]/g, '')
    .replace(/[()\-–/.,:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const num = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

// מקבל רק את השדות שהאפליקציה שולחת, בגבולות סבירים. מחזיר null אם משהו לא תקין.
export function cleanFood(input) {
  if (!input || typeof input !== 'object') return null;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 100 || !normalize(name)) return null;
  if (!num(input.points, 0, 200)) return null;
  const food = { name, points: Math.round(input.points * 10) / 10, source: SOURCES.has(input.source) ? input.source : 'user' };
  if (input.grams !== undefined && num(input.grams, 0, 5000)) food.grams = input.grams;
  if (input.per100 && typeof input.per100 === 'object') {
    const keys = ['kcal', 'protein', 'carbs', 'fat', 'fiber'];
    if (keys.every((k) => num(input.per100[k], 0, 1000))) {
      food.per100 = Object.fromEntries(keys.map((k) => [k, input.per100[k]]));
    }
  }
  if (Array.isArray(input.aliases)) {
    const aliases = input.aliases.filter((a) => typeof a === 'string' && a.length <= 100).slice(0, 10);
    if (aliases.length) food.aliases = aliases;
  }
  if (Array.isArray(input.sources)) {
    const sources = input.sources.filter((s) => typeof s === 'string' && /^https?:\/\//.test(s) && s.length <= 500).slice(0, 5);
    if (sources.length) food.sources = sources;
  }
  return food;
}

const reply = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export class SharedFoods {
  constructor(ctx) {
    this.storage = ctx.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const isAdmin = request.headers.get('x-is-admin') === '1';

    if (request.method === 'GET') {
      const all = await this.storage.list({ prefix: 'food:' });
      return reply(200, { foods: [...all.values()] });
    }

    if (request.method === 'POST' || request.method === 'PUT') {
      let food;
      try {
        food = cleanFood(await request.json());
      } catch {
        food = null;
      }
      if (!food) return reply(400, { error: 'Invalid food' });
      const key = `food:${normalize(food.name)}`;
      const existing = await this.storage.get(key);
      if (request.method === 'POST') {
        if (existing) return reply(200, { added: false, food: existing });
        const count = (await this.storage.list({ prefix: 'food:', limit: MAX_FOODS })).size;
        if (count >= MAX_FOODS) return reply(507, { error: 'Shared database is full' });
        const stored = { ...food, shared: true, added: new Date().toISOString().slice(0, 10) };
        await this.storage.put(key, stored);
        return reply(201, { added: true, food: stored });
      }
      // PUT = תיקון לכולם (מנהל בלבד). oldName מאפשר שינוי שם.
      if (!isAdmin) return reply(403, { error: 'Admin only' });
      const oldName = url.searchParams.get('oldName');
      if (oldName && normalize(oldName) !== normalize(food.name)) await this.storage.delete(`food:${normalize(oldName)}`);
      const stored = { ...(existing || {}), ...food, shared: true, added: existing?.added || new Date().toISOString().slice(0, 10) };
      await this.storage.put(key, stored);
      return reply(200, { food: stored });
    }

    if (request.method === 'DELETE') {
      if (!isAdmin) return reply(403, { error: 'Admin only' });
      const name = url.searchParams.get('name') || '';
      const deleted = await this.storage.delete(`food:${normalize(name)}`);
      return reply(200, { deleted });
    }

    return reply(405, { error: 'Method not allowed' });
  }
}
