// לקוחות: רשימה, יצירה, קריאה, עדכון ומחיקה. כל לקוח במפתח client:<id>
import { fail, json, readBody } from '../lib/http.js';
import { clientSummary, safeClient } from '../lib/model.js';

const MAX_CLIENTS = 2000;
const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

async function loadClient(storage, id) {
  const c = await storage.get(`client:${id}`);
  if (!c) throw fail(404, 'הלקוח לא נמצא');
  return safeClient(c);
}

export async function clientRoutes({ method, path, request, storage }) {
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

  // /clients/:id/propose – ה-AI יגיע בהמשך
  const propose = path.match(/^\/clients\/([a-z0-9]{1,40})\/propose$/);
  if (propose && method === 'POST') {
    await loadClient(storage, propose[1]);
    return json({ error: 'עוד לא זמין – ההצעות האוטומטיות יגיעו בהמשך' }, 501);
  }

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
