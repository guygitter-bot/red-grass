// Kidzfinder – שרת. worker.js רק מסדר כתובות ו-CORS; הלוגיקה ב-src/*.
export { Family } from './src/family.js';
export { Directory } from './src/directory.js';

const dirStub = (env) => env.DIR.get(env.DIR.idFromName('directory'));
async function dirCall(env, path, body) {
  const res = await dirStub(env).fetch('https://do.local' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    // יצירת משפחה חדשה → אובייקט חדש, מחזיר את המזהה שלו
    if (url.pathname === '/api/family/create' && request.method === 'POST') {
      const id = env.FAMILY.newUniqueId();
      const res = await forward(env, id, '/create', request);
      return withCors(await addFamilyId(res, id.toString()), cors);
    }

    // הילד מצטרף עם קוד בלבד: מוצאים את המשפחה במדריך ואז מעבירים אליה
    if (url.pathname === '/api/pair' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const resolved = await dirCall(env, '/resolve', { code: body.code });
      if (resolved.error) return withCors(json({ error: 'bad_code' }, 400), cors);
      let id;
      try { id = env.FAMILY.idFromString(resolved.familyId); } catch { return withCors(json({ error: 'bad_code' }, 400), cors); }
      const res = await env.FAMILY.get(id).fetch('https://do.local/pair', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      return withCors(await addFamilyId(res, resolved.familyId), cors);
    }

    // /api/family/:id/<path> → האובייקט של אותה משפחה
    const m = url.pathname.match(/^\/api\/family\/([a-f0-9]+)(\/.*)$/);
    if (m) {
      let id;
      try {
        id = env.FAMILY.idFromString(m[1]);
      } catch {
        return withCors(json({ error: 'bad_id' }, 400), cors);
      }
      const res = await forward(env, id, m[2], request);
      // כשהורה מייצר קוד – רושמים אותו במדריך כדי שהילד ימצא את המשפחה
      if (m[2] === '/pair-code' && res.status === 200) {
        const data = await res.clone().json().catch(() => ({}));
        if (data.code) await dirCall(env, '/register', { code: data.code, familyId: m[1] });
      }
      return withCors(res, cors);
    }

    return withCors(json({ error: 'not_found' }, 404), cors);
  },
};

async function forward(env, id, path, request) {
  const stub = env.FAMILY.get(id);
  const init = { method: request.method, headers: request.headers };
  if (request.method === 'POST') init.body = await request.text();
  return stub.fetch('https://do.local' + path, init);
}

// מוסיף את מזהה המשפחה לתשובת היצירה (כדי שההורה יידע לאן לפנות)
async function addFamilyId(res, familyId) {
  const data = await res.json();
  return json({ ...data, familyId }, res.status);
}

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());
  const ok = allowed.some((a) =>
    a.includes('*') ? new RegExp('^' + a.replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$').test(origin) : a === origin
  );
  return {
    'access-control-allow-origin': ok ? origin : allowed[0] || '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400',
  };
}

function withCors(res, cors) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
