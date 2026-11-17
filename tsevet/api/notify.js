// התראות לטלפון (Web Push, push.js): משימה שהסתיימה, ומה שמחכה לאישור (סרטון מהמחולל).
//   vapid -> מפתחות השרת (נוצרים פעם אחת)   subs -> המכשירים שהפעילו התראות [{ endpoint, keys, at }]
// משימה קבועה – תמיד. משימה רגילה – רק אם הופעל בהגדרות (settings.notifyAll).
import { convId } from './app.js';
import { createVapidKeys, sendPush, validSubscription } from './push.js';
import { AGENTS } from './agents.js';

const MAX_SUBS = 10;
const APP = (env) => (env.APP_URL || 'https://tsevet-ai.pages.dev/').replace(/\/?$/, '/');

export async function vapidKeys(storage) {
  let vapid = await storage.get('vapid');
  if (!vapid) {
    vapid = await createVapidKeys();
    await storage.put('vapid', vapid);
  }
  return vapid;
}

export async function subscribe(storage, sub) {
  if (!sub || !validSubscription(sub)) throw Object.assign(new Error('המכשיר הזה לא תומך בהתראות'), { status: 400 });
  const clean = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, at: Date.now() };
  const subs = ((await storage.get('subs')) || []).filter((s) => s.endpoint !== clean.endpoint);
  await storage.put('subs', [...subs, clean].slice(-MAX_SUBS));
}

export async function unsubscribe(storage, endpoint) {
  await storage.put('subs', ((await storage.get('subs')) || []).filter((s) => s.endpoint !== endpoint));
}

// שליחה לכל המכשירים. מחזיר כמה קיבלו
export async function pushAll(t, payload) {
  const { storage, env } = t;
  const subs = (await storage.get('subs')) || [];
  if (!subs.length) return 0;
  const vapid = await vapidKeys(storage);
  let sent = 0;
  const gone = [];
  await Promise.all(subs.map(async (s) => {
    try {
      const r = await sendPush(s, payload, vapid, APP(env), env.FETCH || fetch);
      if (r === 'ok') sent++;
      if (r === 'gone') gone.push(s.endpoint);
    } catch (e) {
      console.error('push', e?.message || e);
    }
  }));
  if (gone.length) await storage.put('subs', subs.filter((s) => !gone.includes(s.endpoint)));
  return sent;
}

const firstLine = (text) => String(text || '').replace(/[*#]/g, '').split('\n').map((l) => l.trim()).find(Boolean)?.slice(0, 140) || '';

// אחרי שמשימה הסתיימה
export async function notifyOwner(t, job) {
  const settings = (await t.storage.get('settings')) || {};
  if (!job.notify && !settings.notifyAll) return 0;
  const history = (await t.storage.get(job.key)) || [];
  const last = [...history].reverse().find((h) => h.who !== 'owner');
  if (!last) return 0;
  const waiting = history.slice(-12).some((h) => (h.gens || []).length);
  const who = AGENTS[last.who] ? `${AGENTS[last.who].emoji} ${AGENTS[last.who].name}` : '';
  return pushAll(t, {
    title: job.notify ? `⏰ ${job.notify} – הסתיים` : `${who || 'הצוות'} סיים`,
    body: `${waiting ? 'יש סרטון שמחכה לאישור שלך. ' : ''}${firstLine(last.text)}`.trim() || 'יש תשובה בשיחה',
    url: `${APP(t.env)}#/c/${convId(job.key)}`,
    tag: `tsevet-${convId(job.key)}`,
  });
}
