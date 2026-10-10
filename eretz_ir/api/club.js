// קהילת חברים (Durable Object לכל קהילה, לפי קוד בן 6 תווים).
// מי שבקהילה יכול "לקרוא לכולם": כל החברים שהפעילו התראות מקבלים לטלפון
// "🎲 שגיא רוצה לשחק ארץ עיר! בואו להצטרף – קוד ABCDE", ולחיצה עליה מכניסה ישר למשחק.
//
// אחסון:
//   club   -> { code, name, created, members: [{ id, token, name, joined, sub? }], invite?, updated }
//             sub = מנוי התראות של המכשיר (Web Push). invite = הקריאה האחרונה { by, name, game, at }
//   vapid  -> רק באובייקט המיוחד "~vapid": מפתחות ההתראות של השרת (נוצרים פעם אחת, אחד לכל הקהילות,
//             כי מכשיר נרשם להתראות עם מפתח אחד)
// קהילה שלא נגעו בה חצי שנה נמחקת (alarm).
import { createVapidKeys, sendPush, validSubscription } from './push.js';

export const MAX_MEMBERS = 50;
const MAX_NAME = 30;
// קריאה לכולם – לכל היותר פעם בדקה לקהילה (שלא יציפו את החברים)
export const INVITE_GAP_MS = 60 * 1000;
// "שגיא מחכה במשחק" מוצג בקהילה חצי שעה
export const INVITE_SHOW_MS = 30 * 60 * 1000;
const KEEP_MS = 180 * 24 * 60 * 60 * 1000;
const ID_RE = /^[\w-]{8,40}$/;
const TOKEN_RE = /^[\w-]{16,64}$/;
const GAME_RE = /^[A-HJKMNP-Z2-9]{5}$/;

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

export class Club {
  constructor(state, env = {}) {
    this.storage = state.storage;
    this.env = env;
    this.now = env.NOW || (() => Date.now());
    this.pushFetch = env.PUSH_FETCH || ((...a) => fetch(...a));
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'בקשה לא תקינה' });
    }

    // רק באובייקט "~vapid" (השרת לא מעביר את הנתיב הזה מבחוץ)
    if (path === '/vapid') return json(200, await this.vapid());

    const club = await this.storage.get('club');
    if (path === '/create') {
      if (club) return json(409, { error: 'הקוד תפוס' });
      const player = checkPlayer(body.player);
      if (player.error) return json(400, player);
      const name = clean(body.name, MAX_NAME);
      if (!name) return json(400, { error: 'צריך שם לקהילה' });
      const fresh = { code: String(body.club), name, created: this.now(), members: [] };
      addMember(fresh, player, this.now());
      await this.save(fresh);
      return json(200, this.view(fresh, player.id));
    }

    if (!club) return json(404, { error: 'הקהילה לא נמצאה. אולי הקישור ישן?' });

    if (path === '/join') {
      const player = checkPlayer(body.player);
      if (player.error) return json(400, player);
      const existing = club.members.find((m) => m.id === player.id);
      if (existing && existing.token !== player.token) return json(403, { error: 'השחקן הזה כבר בקהילה ממכשיר אחר' });
      if (!existing && club.members.length >= MAX_MEMBERS) return json(409, { error: `הקהילה מלאה (עד ${MAX_MEMBERS})` });
      addMember(club, player, this.now());
      await this.save(club);
      return json(200, this.view(club, player.id));
    }

    const me = club.members.find((m) => m.id === body.playerId && m.token === body.token);
    if (!me) return json(403, { error: 'את/ה כבר לא בקהילה הזאת', gone: true });

    switch (path) {
      case '/get':
        return json(200, this.view(club, me.id));

      case '/subscribe': {
        if (body.subscription === null) delete me.sub;
        else if (validSubscription(body.subscription || {})) {
          const { endpoint, keys } = body.subscription;
          me.sub = { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
        } else return json(400, { error: 'ההתראות לא נתמכות במכשיר הזה' });
        await this.save(club);
        return json(200, this.view(club, me.id));
      }

      case '/invite': {
        const game = String(body.game || '').toUpperCase();
        if (!GAME_RE.test(game)) return json(400, { error: 'קוד משחק לא תקין' });
        const last = club.invite;
        if (last && this.now() - last.at < INVITE_GAP_MS) {
          // לאותו משחק כבר קראו הרגע – לא שולחים שוב
          if (last.game === game) return json(200, { ...this.view(club, me.id), sent: 0, again: true });
          return json(429, { error: 'מישהו כבר קרא לכולם ממש עכשיו. נסו שוב בעוד דקה' });
        }
        club.invite = { by: me.id, name: me.name, game, at: this.now() };
        const sent = await this.notifyAll(club, me, game);
        await this.save(club);
        return json(200, { ...this.view(club, me.id), sent });
      }

      case '/leave':
        club.members = club.members.filter((m) => m.id !== me.id);
        await this.save(club);
        return json(200, { ok: true });

      default:
        return json(404, { error: 'לא נמצא' });
    }
  }

  // התראה לכל מי שהפעיל התראות (חוץ ממי שקרא). מכשיר שביטל – נמחק מהרשימה
  async notifyAll(club, me, game) {
    const targets = club.members.filter((m) => m.id !== me.id && m.sub);
    if (!targets.length) return 0;
    const vapid = await this.sharedVapid();
    const app = (this.env.APP_URL || 'https://eretz-ir.pages.dev/').replace(/\/?$/, '/');
    const payload = {
      title: `🎲 ${me.name} רוצה לשחק ארץ עיר!`,
      body: `בואו להצטרף – קוד ${game} (${club.name})`,
      url: `${app}?g=${game}`,
      tag: `eir-${club.code}`,
    };
    let sent = 0;
    await Promise.all(targets.map(async (m) => {
      try {
        const result = await sendPush(m.sub, payload, vapid, app, this.pushFetch);
        if (result === 'ok') sent++;
        if (result === 'gone') delete m.sub;
      } catch (e) {
        console.log('push failed', e?.message || e);
      }
    }));
    return sent;
  }

  // המפתחות המשותפים נמצאים באובייקט "~vapid"
  async sharedVapid() {
    const ns = this.env.CLUBS;
    const res = await ns.get(ns.idFromName('~vapid')).fetch(new Request('https://club/vapid', { method: 'POST', body: '{}' }));
    return res.json();
  }

  async vapid() {
    let vapid = await this.storage.get('vapid');
    if (!vapid) {
      vapid = await createVapidKeys();
      await this.storage.put('vapid', vapid);
    }
    return vapid;
  }

  async save(club) {
    club.updated = this.now();
    await this.storage.put('club', club);
    await this.storage.setAlarm(club.updated + KEEP_MS);
  }

  async alarm() {
    const club = await this.storage.get('club');
    if (club && this.now() - club.updated < KEEP_MS) return this.storage.setAlarm(club.updated + KEEP_MS);
    if (club) await this.storage.deleteAll();
  }

  view(club, meId) {
    const invite = club.invite && this.now() - club.invite.at < INVITE_SHOW_MS ? club.invite : null;
    return {
      code: club.code,
      name: club.name,
      me: meId,
      members: club.members.map((m) => ({ id: m.id, name: m.name, notify: !!m.sub })),
      invite: invite && { by: invite.by, name: invite.name, game: invite.game, at: invite.at },
      now: this.now(),
    };
  }
}

function checkPlayer(raw) {
  const p = raw || {};
  if (!ID_RE.test(String(p.id || '')) || !TOKEN_RE.test(String(p.token || ''))) return { error: 'פרטי שחקן לא תקינים' };
  const name = clean(p.name, 20);
  if (!name) return { error: 'צריך שם' };
  return { id: p.id, token: p.token, name };
}

function addMember(club, { id, token, name }, now) {
  const existing = club.members.find((m) => m.id === id);
  if (existing) existing.name = name;
  else club.members.push({ id, token, name, joined: now });
}
