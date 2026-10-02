// הרשאות: קישורי הזמנה חד-פעמיים ומכשירים מחוברים.
// בעל האפליקציה (עם קוד הגישה) יוצר קישור. מי שפותח אותו מקבל מפתח מכשיר קבוע משלו,
// והקישור מפסיק לעבוד. בשרת נשמר רק גיבוב (SHA-256) של הקישור ושל מפתח המכשיר.

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_INVITES = 50;
const MAX_DEVICES = 50;
const SEEN_EVERY_MS = 60 * 60 * 1000;

export async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 24) {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const cleanName = (n) => (typeof n === 'string' ? n.trim().slice(0, 40) : '');
const reply = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

async function readJson(request) {
  try {
    return (await request.json()) || {};
  } catch {
    return {};
  }
}

// נקרא מתוך ה-Durable Object, רק עם נתיבים פנימיים שה-worker בונה.
export async function handleAccess(storage, path, request) {
  const now = Date.now();

  if (path === '/access/auth') {
    const { hash } = await readJson(request);
    if (typeof hash !== 'string') return reply(400, { error: 'Bad request' });
    const device = await storage.get(`device:${hash}`);
    if (!device) return reply(401, { error: 'Unknown device' });
    if (now - (device.lastSeen || 0) > SEEN_EVERY_MS) await storage.put(`device:${hash}`, { ...device, lastSeen: now });
    return reply(200, { ok: true });
  }

  if (path === '/access/invite') {
    const { name } = await readJson(request);
    const invites = await storage.list({ prefix: 'invite:' });
    for (const [key, inv] of invites) if (inv.expires < now) await storage.delete(key);
    if (invites.size >= MAX_INVITES) return reply(429, { error: 'Too many open invites' });
    const token = randomToken();
    const expires = now + INVITE_TTL_MS;
    await storage.put(`invite:${await sha256(token)}`, { name: cleanName(name), created: now, expires });
    return reply(201, { token, expires });
  }

  if (path === '/access/redeem') {
    const { token, deviceName } = await readJson(request);
    if (typeof token !== 'string' || token.length < 16 || token.length > 100) return reply(400, { error: 'Bad invite' });
    const key = `invite:${await sha256(token)}`;
    const invite = await storage.get(key);
    if (!invite || invite.expires < now) {
      if (invite) await storage.delete(key);
      return reply(410, { error: 'Invite used or expired' });
    }
    await storage.delete(key); // חד-פעמי
    const devices = await storage.list({ prefix: 'device:', limit: MAX_DEVICES });
    if (devices.size >= MAX_DEVICES) return reply(429, { error: 'Too many devices' });
    const deviceKey = randomToken(32);
    const name = invite.name || cleanName(deviceName) || 'מכשיר';
    await storage.put(`device:${await sha256(deviceKey)}`, { name, created: now, lastSeen: now });
    return reply(201, { deviceKey, name });
  }

  if (path === '/access/devices' && request.method === 'GET') {
    const devices = await storage.list({ prefix: 'device:' });
    return reply(200, {
      devices: [...devices].map(([key, d]) => ({ id: key.slice('device:'.length), name: d.name, created: d.created, lastSeen: d.lastSeen })),
    });
  }

  if (path === '/access/devices' && request.method === 'DELETE') {
    const { id } = await readJson(request);
    if (typeof id !== 'string' || !/^[0-9a-f]{64}$/.test(id)) return reply(400, { error: 'Bad id' });
    return reply(200, { deleted: await storage.delete(`device:${id}`) });
  }

  return reply(404, { error: 'Not found' });
}
