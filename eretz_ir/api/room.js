// משחק אחד (Durable Object לכל קוד משחק).
//
// אחסון:
//   room      -> { code, v, hostId, phase, seconds, players, usedLetters, round, history, updated }
//                phase: lobby (מחכים לשחקנים) | playing (כותבים) | results (תוצאות ופסילות)
//                players: [{ id, token, name, joined }]   (token = סוד של השחקן, לא נשלח לאחרים)
//                round: { n, letter, startsAt, endsAt, answers: {<שחקן>: {...}}, done: [...], votes: {...} }
//                history: [{ n, letter, totals }]   ניקוד סיבובים קודמים (נקבע כשמתחיל סיבוב חדש)
//   ph:<id>   -> תמונת השחקן (data URL קטן), בנפרד כדי שהחדר לא יעבור את גבול הגודל
//
// v (גרסה) עולה בכל שינוי שהשחקנים האחרים צריכים לראות. האפליקציה שואלת כל שנייה וחצי
// "יש משהו חדש מאז v?" – ואם לא, מקבלת תשובה קצרה (בלי תמונות).
// משחק שלא נגעו בו שלושה ימים נמחק (alarm).
import { CATEGORIES, cleanAnswers, isCategory, pickLetter, scoreRound } from './game.js';

export const MAX_PLAYERS = 12;
export const TIMES = [60, 120, 180, 300, 480];
export const DEFAULT_SECONDS = 120;
// אחרי שהזמן נגמר מחכים עוד קצת לתשובות האחרונות שבדרך
export const GRACE_MS = 4000;
export const COUNTDOWN_MS = 3000;
const KEEP_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_NAME = 20;
const MAX_PHOTO = 20000;
const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const ID_RE = /^[\w-]{8,40}$/;
const TOKEN_RE = /^[\w-]{16,64}$/;

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const cleanName = (s) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);

export class Room {
  constructor(state, env = {}) {
    this.storage = state.storage;
    this.now = env.NOW || (() => Date.now());
    this.random = env.RANDOM || Math.random;
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'בקשה לא תקינה' });
    }
    const room = await this.storage.get('room');

    if (path === '/create') {
      if (room) return json(409, { error: 'הקוד תפוס' });
      const player = this.checkPlayer(body.player);
      if (player.error) return json(400, player);
      const fresh = {
        code: String(body.code),
        v: 1,
        hostId: player.id,
        phase: 'lobby',
        seconds: DEFAULT_SECONDS,
        players: [],
        usedLetters: [],
        round: null,
        history: [],
      };
      await this.addPlayer(fresh, player);
      await this.save(fresh);
      return json(200, await this.view(fresh, player.id));
    }

    if (!room) return json(404, { error: 'המשחק לא נמצא. אולי הקישור ישן?' });
    const changed = this.tick(room);

    if (path === '/join') {
      const player = this.checkPlayer(body.player);
      if (player.error) return json(400, player);
      const existing = room.players.find((p) => p.id === player.id);
      if (existing && existing.token !== player.token) return json(403, { error: 'השחקן הזה כבר במשחק ממכשיר אחר' });
      if (!existing && room.players.length >= MAX_PLAYERS) return json(409, { error: `המשחק מלא (עד ${MAX_PLAYERS} שחקנים)` });
      await this.addPlayer(room, player);
      await this.save(room);
      return json(200, await this.view(room, player.id));
    }

    const me = room.players.find((p) => p.id === body.playerId && p.token === body.token);
    if (!me) {
      if (changed) await this.save(room);
      return json(403, { error: 'את/ה כבר לא במשחק הזה', gone: true });
    }

    switch (path) {
      case '/state':
        if (changed) await this.save(room);
        if (!changed && body.v === room.v) return json(200, { same: true, v: room.v, now: this.now() });
        return json(200, await this.view(room, me.id));

      case '/settings': {
        const seconds = Number(body.seconds);
        if (!TIMES.includes(seconds)) return json(400, { error: 'זמן לא תקין' });
        room.seconds = seconds;
        room.v++;
        await this.save(room);
        return json(200, await this.view(room, me.id));
      }

      case '/start': {
        if (room.phase === 'playing') return json(200, await this.view(room, me.id));
        if (TIMES.includes(Number(body.seconds))) room.seconds = Number(body.seconds);
        if (room.phase === 'results' && room.round) {
          const { totals } = scoreRound(room.round, room.players.map((p) => p.id));
          room.history.push({ n: room.round.n, letter: room.round.letter, totals });
        }
        const letter = pickLetter(room.usedLetters, this.random);
        room.usedLetters = room.usedLetters.length >= 21 ? [letter] : [...room.usedLetters, letter];
        const startsAt = this.now() + COUNTDOWN_MS;
        room.round = {
          n: (room.round?.n || 0) + 1,
          letter,
          startsAt,
          endsAt: startsAt + room.seconds * 1000,
          answers: {},
          done: [],
          votes: {},
        };
        room.phase = 'playing';
        room.v++;
        await this.save(room);
        return json(200, await this.view(room, me.id));
      }

      case '/answers': {
        const round = room.round;
        if (room.phase !== 'playing' || !round || round.n !== body.round) {
          if (changed) await this.save(room);
          return json(409, { error: 'הזמן נגמר', late: true });
        }
        round.answers[me.id] = cleanAnswers(body.answers);
        if (body.done && !round.done.includes(me.id)) {
          round.done.push(me.id);
          room.v++;
        }
        this.tick(room);
        await this.save(room);
        return json(200, { ok: true, v: room.v });
      }

      case '/vote': {
        const round = room.round;
        if (room.phase !== 'results' || !round || round.n !== body.round) return json(409, { error: 'הסיבוב כבר נגמר' });
        if (!isCategory(body.category) || body.target === me.id || !room.players.some((p) => p.id === body.target)) {
          return json(400, { error: 'בקשה לא תקינה' });
        }
        const key = `${body.category}|${body.target}`;
        const voters = (round.votes[key] || []).filter((id) => id !== me.id);
        if (body.bad) voters.push(me.id);
        round.votes[key] = voters;
        room.v++;
        await this.save(room);
        return json(200, await this.view(room, me.id));
      }

      case '/leave': {
        room.players = room.players.filter((p) => p.id !== me.id);
        if (room.hostId === me.id) room.hostId = room.players[0]?.id || null;
        await this.storage.delete(`ph:${me.id}`);
        room.v++;
        this.tick(room);
        await this.save(room);
        return json(200, { ok: true });
      }

      default:
        return json(404, { error: 'לא נמצא' });
    }
  }

  // סוף הסיבוב: כשהזמן (ועוד קצת) עבר, או כשכל השחקנים לחצו "סיימתי". מחזיר true אם משהו השתנה
  tick(room) {
    const round = room.round;
    if (room.phase !== 'playing' || !round) return false;
    const allDone = room.players.length > 0 && room.players.every((p) => round.done.includes(p.id));
    if (!allDone && this.now() <= round.endsAt + GRACE_MS) return false;
    room.phase = 'results';
    room.v++;
    return true;
  }

  checkPlayer(raw) {
    const p = raw || {};
    if (!ID_RE.test(String(p.id || '')) || !TOKEN_RE.test(String(p.token || ''))) return { error: 'פרטי שחקן לא תקינים' };
    const name = cleanName(p.name);
    if (!name) return { error: 'צריך שם' };
    const photo = String(p.photo || '');
    if (photo && (photo.length > MAX_PHOTO || !PHOTO_RE.test(photo))) return { error: 'התמונה לא תקינה או גדולה מדי' };
    return { id: p.id, token: p.token, name, photo };
  }

  // הצטרפות, או עדכון שם/תמונה לשחקן שכבר במשחק
  async addPlayer(room, { id, token, name, photo }) {
    const existing = room.players.find((p) => p.id === id);
    if (existing) existing.name = name;
    else room.players.push({ id, token, name, joined: this.now() });
    if (!room.hostId) room.hostId = id;
    if (photo) await this.storage.put(`ph:${id}`, photo);
    else await this.storage.delete(`ph:${id}`);
    room.v++;
  }

  async save(room) {
    room.updated = this.now();
    await this.storage.put('room', room);
    await this.storage.setAlarm(room.updated + KEEP_MS);
  }

  async alarm() {
    const room = await this.storage.get('room');
    if (room && this.now() - room.updated < KEEP_MS) return this.storage.setAlarm(room.updated + KEEP_MS);
    await this.storage.deleteAll();
  }

  // מה ששחקן אחד רואה: כולם, הניקוד, והתשובות שלו (את של האחרים רק בתוצאות)
  async view(room, meId) {
    const ids = room.players.map((p) => p.id);
    const photos = await this.storage.get(ids.map((id) => `ph:${id}`));
    const round = room.round;
    const results = room.phase === 'results' && round ? scoreRound(round, ids) : null;
    const totals = Object.fromEntries(ids.map((id) => [id, 0]));
    for (const h of room.history) for (const id of ids) totals[id] += h.totals[id] || 0;
    if (results) for (const id of ids) totals[id] += results.totals[id];
    return {
      code: room.code,
      v: room.v,
      now: this.now(),
      me: meId,
      hostId: room.hostId,
      phase: room.phase,
      seconds: room.seconds,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        photo: photos.get(`ph:${p.id}`) || '',
        total: totals[p.id],
        done: !!round?.done.includes(p.id),
      })),
      round: round && {
        n: round.n,
        letter: round.letter,
        startsAt: round.startsAt,
        endsAt: round.endsAt,
        mine: round.answers[meId] || {},
      },
      results,
      history: room.history.map((h) => ({ n: h.n, letter: h.letter })),
      categories: CATEGORIES,
    };
  }
}
