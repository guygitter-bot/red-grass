// השרת של mat-kon (Cloudflare Worker): מחזיק את מפתח ה-API של Anthropic ואת ספר המתכונים.
// האפליקציה שולחת קישור, השרת קורא אותו (גם סרטונים), הסוכן מסדר מתכון בעברית עם קטגוריה,
// והמתכון נשמר בספר המשותף. הגישה בקוד גישה, כך שהמפתח לא נמצא באף טלפון.
import Anthropic from '@anthropic-ai/sdk';
import { RecipeBook } from './store.js';
import { gatherSource, normalizeUrl } from './source.js';
import { NoRecipeError, extractRecipe } from './extract.js';
import { CATEGORIES } from './categories.js';

export { RecipeBook };

// נקודות הזרקה לבדיקות
export const deps = {
  anthropic: (env) => new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }),
  fetch: (...args) => fetch(...args),
};

const MAX_EDIT_BYTES = 200 * 1024;

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  const headers = {
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, x-access-code',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
  if (allowed.includes(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

// השוואה בזמן קבוע, כדי שלא יהיה אפשר לנחש את הקוד לפי זמני תגובה.
function sameCode(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const reply = (status, data) =>
      new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json' } });
    const fail = (status, message) => reply(status, { error: message });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!env.ANTHROPIC_API_KEY || !env.ACCESS_CODE || !env.BOOK) return fail(500, 'השרת לא מוגדר');
    if (!sameCode(request.headers.get('x-access-code') || '', env.ACCESS_CODE)) return fail(401, 'קוד גישה שגוי');

    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const book = env.BOOK.get(env.BOOK.idFromName('book'));
    const toBook = async (method, path, body) => {
      const res = await book.fetch(new Request(`https://book${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }));
      return reply(res.status, await res.json());
    };

    // בדיקת קוד הגישה מהאפליקציה
    if (url.pathname === '/check') return reply(200, { ok: true, categories: CATEGORIES });

    if (parts[0] !== 'recipes' || parts.length > 3) return fail(404, 'Not found');
    const id = parts[1];
    if (id && !/^[\w-]{1,64}$/.test(id)) return fail(404, 'Not found');

    // הוספת מתכון מקישור, או רענון מתכון קיים מהמקור שלו
    const isAdd = request.method === 'POST' && parts.length === 1;
    const isRefresh = request.method === 'POST' && parts[2] === 'refresh';
    if (isAdd || isRefresh) {
      let link;
      if (isAdd) {
        const text = await request.text();
        if (text.length > 4000) return fail(413, 'הבקשה גדולה מדי');
        let body;
        try {
          body = JSON.parse(text);
        } catch {
          return fail(400, 'בקשה לא תקינה');
        }
        link = normalizeUrl(body?.url);
        if (!link) return fail(400, 'זה לא נראה כמו קישור תקין');
      } else {
        const res = await book.fetch(new Request(`https://book/recipes/${id}`));
        if (!res.ok) return fail(404, 'המתכון לא נמצא');
        link = (await res.json()).recipe.source.url;
      }
      try {
        const src = await gatherSource(link, deps.fetch);
        const recipe = await extractRecipe(deps.anthropic(env), src);
        return toBook('POST', '/recipes', recipe);
      } catch (e) {
        if (e instanceof NoRecipeError) return fail(422, e.message);
        console.error('extract failed', link, e);
        return fail(502, `לא הצלחתי להוציא מתכון: ${e.message || e}`);
      }
    }

    if (parts.length === 1 && request.method === 'GET') return toBook('GET', '/recipes');
    if (parts.length === 2 && request.method === 'GET') return toBook('GET', `/recipes/${id}`);
    if (parts.length === 2 && request.method === 'DELETE') return toBook('DELETE', `/recipes/${id}`);
    if (parts.length === 2 && request.method === 'PUT') {
      const text = await request.text();
      if (text.length > MAX_EDIT_BYTES) return fail(413, 'הבקשה גדולה מדי');
      let patch;
      try {
        patch = JSON.parse(text);
      } catch {
        return fail(400, 'בקשה לא תקינה');
      }
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return fail(400, 'בקשה לא תקינה');
      if ('category' in patch && !CATEGORIES.includes(patch.category)) return fail(400, 'קטגוריה לא מוכרת');
      return toBook('PUT', `/recipes/${id}`, patch);
    }
    return fail(405, 'Method not allowed');
  },
};
