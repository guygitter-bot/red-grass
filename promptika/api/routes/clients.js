// לקוחות: רשימה, יצירה, קריאה, עדכון ומחיקה. כל לקוח במפתח client:<id>
import { fail, json, readBody } from '../lib/http.js';
import { clientSummary, safeClient, MAX_PROPOSALS } from '../lib/model.js';
import { aiClient, aiMessage, ask } from '../lib/ai.js';
import { SYSTEM, newVersion, proposeFromIntake } from '../lib/propose.js';

const MAX_CLIENTS = 2000;
// הגבלה: עד 10 הצעות בשעה (כל הצעה עולה כסף)
export const PROPOSE_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;
const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

async function loadClient(storage, id) {
  const c = await storage.get(`client:${id}`);
  if (!c) throw fail(404, 'הלקוח לא נמצא');
  return safeClient(c);
}

export async function clientRoutes({ method, path, request, storage, env }) {
  if (path === '/clients') {
    if (method === 'GET') {
      const all = [...(await storage.list({ prefix: 'client:' })).values()].map(safeClient);
      all.sort((a, b) => b.updatedAt - a.updatedAt);
      return json({ clients: all.map(clientSummary) });
    }
    if (method === 'POST') {
      const body = await readBody(request);
      const count = (await storage.list({ prefix: 'client:' })).size;
      if (count >= MAX_CLIENTS) throw fail(400, 'יותר מדי לקוחות');
      const now = Date.now();
      const client = safeClient({ ...body, id: newId(), createdAt: now, updatedAt: now, proposals: [] });
      if (!client.name && !client.business) throw fail(400, 'צריך שם או שם עסק');
      await storage.put(`client:${client.id}`, client);
      return json({ client }, 201);
    }
    return null;
  }

  // /clients/:id/propose – Claude ממליץ על כלים ומעריך שעות; נשמר כגרסה חדשה
  const propose = path.match(/^\/clients\/([a-z0-9]{1,40})\/propose$/);
  if (propose && method === 'POST') return proposeRoute(storage, env, propose[1]);

  const one = path.match(/^\/clients\/([a-z0-9]{1,40})$/);
  if (!one) return null;
  const id = one[1];
  if (method === 'GET') return json({ client: await loadClient(storage, id) });
  if (method === 'PUT') {
    const old = await loadClient(storage, id);
    const body = await readBody(request);
    // id ותאריך יצירה לא משתנים
    const client = safeClient({ ...old, ...(body.client || body), id, createdAt: old.createdAt, updatedAt: Date.now() });
    await storage.put(`client:${id}`, client);
    return json({ client });
  }
  if (method === 'DELETE') {
    await loadClient(storage, id);
    await storage.delete(`client:${id}`);
    return json({ ok: true });
  }
  return null;
}

async function proposeRoute(storage, env, id) {
  const client = await loadClient(storage, id);
  if (client.proposals.length >= MAX_PROPOSALS) throw fail(400, 'יש כבר יותר מדי גרסאות ללקוח הזה');
  const now = (env.NOW || Date.now)();
  const times = ((await storage.get('propose:times')) || []).filter((t) => now - t < HOUR_MS);
  if (times.length >= PROPOSE_PER_HOUR) throw fail(429, 'הגעת למגבלה של 10 הצעות בשעה. אפשר לנסות שוב מאוחר יותר');
  await storage.put('propose:times', [...times, now]);

  let answer;
  try {
    const client_ = aiClient(env);
    answer = await proposeFromIntake((q) => ask(client_, { system: SYSTEM, ...q }), client);
  } catch (e) {
    // בלי תוכן הקליטה בלוג – רק סוג התקלה
    console.error('propose failed', Number(e?.status) || e?.name || 'Error');
    throw fail(502, aiMessage(e));
  }
  if (!answer) throw fail(502, 'Claude החזיר תשובה לא תקינה פעמיים. נסו שוב.');

  // קוראים שוב לפני השמירה, כדי לא לדרוס שינוי שנשמר בזמן ש-Claude חשב
  const fresh = await loadClient(storage, id);
  const proposal = newVersion(fresh.proposals, answer, now, newId());
  // אין כלים – רק שאלות חסרות: לא שומרים גרסה, מחזירים את השאלות
  if (!proposal.tools.length) return json({ proposal: null, missingQuestions: proposal.missingQuestions, understanding: proposal.understanding });

  const saved = safeClient({ ...fresh, proposals: [...fresh.proposals, proposal], updatedAt: Date.now() });
  await storage.put(`client:${id}`, saved);
  return json({ proposal, missingQuestions: proposal.missingQuestions, client: saved });
}
