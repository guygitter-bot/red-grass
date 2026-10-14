import { test } from 'node:test';
import assert from 'node:assert/strict';
import { b64url, createVapidKeys, encryptPayload, fromB64url, validSubscription, vapidHeader } from './push.js';
import { reminderUtc, zonedToUtc } from './reminders.js';
import { Vault } from './vault.js';

const enc = new TextEncoder();
const hmac = async (key, data) => new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), data));
const concat = (...p) => Uint8Array.from(p.flatMap((x) => [...x]));

// "טלפון" מדומה: מפתחות כמו שהדפדפן יוצר בהרשמה להתראות
async function fakeDevice() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const p256dh = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return {
    pair,
    auth,
    subscription: { endpoint: `https://fcm.googleapis.com/fcm/send/${Math.random().toString(36).slice(2)}`, keys: { p256dh: b64url(p256dh), auth: b64url(auth) } },
  };
}

// פענוח כמו שהדפדפן עושה (RFC 8291) – כדי לוודא שההצפנה נכונה
async function decrypt(device, body) {
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const cipher = body.slice(21 + idlen);
  const uaPublic = fromB64url(device.subscription.keys.p256dh);
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, device.pair.privateKey, 256));
  const prkKey = await hmac(device.auth, secret);
  const ikm = await hmac(prkKey, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, [1]));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), [1]))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), [1]))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, cipher));
  assert.equal(plain[plain.length - 1], 2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

test('push payload is encrypted so only the device can read it', async () => {
  const device = await fakeDevice();
  const body = await encryptPayload(device.subscription, JSON.stringify({ title: '🔔 התייבות' }));
  assert.deepEqual([...body.slice(16, 20)], [0, 0, 16, 0]);
  assert.equal(JSON.parse(await decrypt(device, body)).title, '🔔 התייבות');
});

test('VAPID header is signed with the server key', async () => {
  const vapid = await createVapidKeys();
  const header = await vapidHeader('https://fcm.googleapis.com/fcm/send/abc', vapid, 'https://seder-tasks.pages.dev', 1_700_000_000_000);
  const [, jwt, k] = header.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(k, vapid.publicKey);
  const [h, c, sig] = jwt.split('.');
  const claims = JSON.parse(new TextDecoder().decode(fromB64url(c)));
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.equal(claims.exp, 1_700_000_000 + 12 * 3600);
  const pub = await crypto.subtle.importKey('raw', fromB64url(vapid.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, fromB64url(sig), enc.encode(`${h}.${c}`)));
});

test('only real push services are accepted', async () => {
  const device = await fakeDevice();
  assert.ok(validSubscription(device.subscription));
  assert.ok(!validSubscription({ ...device.subscription, endpoint: 'https://evil.example/x' }));
  assert.ok(!validSubscription({ ...device.subscription, endpoint: 'http://fcm.googleapis.com/x' }));
  assert.ok(!validSubscription({ endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'AA', auth: 'AA' } }));
});

test('reminder times use Israel time, including daylight saving', () => {
  // אוקטובר 2026 עדיין שעון קיץ (UTC+3), דצמבר שעון חורף (UTC+2)
  assert.equal(new Date(zonedToUtc('2026-10-05', '07:30', 'Asia/Jerusalem')).toISOString(), '2026-10-05T04:30:00.000Z');
  assert.equal(new Date(zonedToUtc('2026-12-01', '09:00', 'Asia/Jerusalem')).toISOString(), '2026-12-01T07:00:00.000Z');
  const iso = (t) => new Date(reminderUtc(t, 'Asia/Jerusalem')).toISOString();
  assert.equal(iso({ due: '2026-12-01', remind: 0 }), '2026-12-01T07:00:00.000Z');
  assert.equal(iso({ due: '2026-12-01', time: '20:00', remind: 30 }), '2026-12-01T17:30:00.000Z');
  assert.equal(iso({ due: '2026-12-01', time: '20:00', remind: 0, remindTime: '08:15' }), '2026-12-01T06:15:00.000Z');
  assert.equal(reminderUtc({ due: '2026-12-01', remind: null }, 'Asia/Jerusalem'), null);
  assert.equal(reminderUtc({ due: '2026-12-01', remind: 0, done: true }, 'Asia/Jerusalem'), null);
});

// אחסון Durable Object מדומה, כולל alarm
function fakeStorage() {
  const map = new Map();
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    alarm: null,
    async get(k) { return Array.isArray(k) ? new Map(k.filter((kk) => map.has(kk)).map((kk) => [kk, clone(map.get(kk))])) : clone(map.get(k)); },
    async put(k, v) {
      if (typeof k === 'object') for (const [kk, vv] of Object.entries(k)) map.set(kk, clone(vv));
      else map.set(k, clone(v));
    },
    async delete(k) { for (const kk of [k].flat()) map.delete(kk); },
    async list({ prefix = '', start = '', limit = Infinity } = {}) {
      const keys = [...map.keys()].filter((kk) => kk.startsWith(prefix) && kk >= start).sort().slice(0, limit);
      return new Map(keys.map((kk) => [kk, clone(map.get(kk))]));
    },
    async setAlarm(t) { this.alarm = t; },
    async deleteAlarm() { this.alarm = null; },
  };
}

test('the server sends the reminder at its time, once, to every device', async () => {
  const storage = fakeStorage();
  const vault = new Vault({ storage }, { SEDER_PASSWORD: 'pw' });
  const call = async (path, body) => (await vault.fetch(new Request(`https://vault${path}`, { method: 'POST', body: JSON.stringify(body) }))).json();
  const phone = await fakeDevice();
  const pushed = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    pushed.push({ url, body: new Uint8Array(init.body), auth: init.headers.authorization });
    return new Response(null, { status: url.includes('gone') ? 410 : 201 });
  };
  try {
    assert.match((await call('/push/key', {})).publicKey, /^[\w-]{87}$/);
    assert.equal((await call('/push/subscribe', { subscription: { endpoint: 'https://evil.example', keys: {} } })).error, 'מכשיר לא נתמך להתראות');
    assert.equal((await call('/push/subscribe', { subscription: phone.subscription, tz: 'UTC' })).devices, 1);

    // משימה עם תזכורת לפני 5 דקות (שעון UTC בבדיקה), ואחת מחר
    const past = new Date(Date.now() - 5 * 60000);
    const pad = (n) => String(n).padStart(2, '0');
    const today = past.toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const t1 = { id: 't1', title: 'התייבות', due: today, remind: 0, remindTime: `${pad(past.getUTCHours())}:${pad(past.getUTCMinutes())}` };
    const t2 = { id: 't2', title: 'מחר', due: tomorrow, remind: 0, remindTime: '10:00' };
    await call('/sync', { since: 0, changes: [t1, t2].map((d) => ({ kind: 'task', id: d.id, updatedAt: 1, data: d })) });
    assert.ok(storage.alarm <= Date.now() + 1000, 'alarm set for the due reminder');

    await vault.alarm();
    assert.equal(pushed.length, 1);
    assert.equal(JSON.parse(await decrypt(phone, pushed[0].body)).title, '🔔 התייבות');
    assert.equal(storage.alarm, zonedToUtc(tomorrow, '10:00', 'UTC'), 'next alarm is tomorrow');

    // לא נשלח שוב
    await vault.alarm();
    assert.equal(pushed.length, 1);

    // התראת בדיקה, ומכשיר שבוטל נמחק
    const gone = await fakeDevice();
    gone.subscription.endpoint = 'https://fcm.googleapis.com/fcm/send/gone';
    await call('/push/subscribe', { subscription: gone.subscription });
    const res = await call('/push/test', {});
    assert.deepEqual(res, { sent: 1, devices: 1 });
  } finally {
    globalThis.fetch = realFetch;
  }
});
