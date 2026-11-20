// מדריך גלובלי: קוד חיבור (6 ספרות) → מזהה המשפחה. אובייקט אחד לכל השרת.
// נחוץ כי הילד מקליד רק קוד קצר, בלי לדעת לאיזו משפחה הוא שייך.
const now = () => Date.now();
const TTL = 10 * 60 * 1000; // קוד תקף 10 דקות

export class Directory {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    if (url.pathname === '/register') {
      const code = String(body.code || '');
      if (!/^\d{6}$/.test(code) || !body.familyId) return json({ error: 'bad' }, 400);
      await this.storage.put('code:' + code, { familyId: body.familyId, expires: now() + TTL });
      return json({ ok: true });
    }

    if (url.pathname === '/resolve') {
      const code = String(body.code || '');
      const rec = await this.storage.get('code:' + code);
      if (!rec || rec.expires < now()) return json({ error: 'bad_code' }, 400);
      // הקוד לשימוש חד-פעמי – מוחקים אחרי שנמצא
      await this.storage.delete('code:' + code);
      return json({ ok: true, familyId: rec.familyId });
    }

    return json({ error: 'unknown' }, 404);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
