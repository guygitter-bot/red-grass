// משחק אחד (Durable Object לכל קוד משחק).
//
// אחסון:
//   room    -> { code, v, hostId, phase, settings, players, game, used, error, updated }
//              phase: lobby (מחכים לשחקנים) | loading (מביאים את השירים) | question (שומעים ועונים)
//                     | reveal (התשובה הנכונה, כמה שניות) | over (סוף המשחק)
//              settings: { mode: solo|teams, era: all|60|70|...|20, lang: both|il|intl, count: 10|20 }
//              players: [{ id, token, name, team, joined }]   (token = סוד של השחקן, לא נשלח לאחרים)
//              game: { n, ids, options, correct, audio, art, q, startsAt, endsAt, revealUntil,
//                      picks: {<שחקן>: [{ c, t, ext, cut }]} }
//                    c = התשובה שנבחרה (0-3), t = אחרי כמה זמן, ext = ביקש הארכה, cut = שתי התשובות שנמחקו ב-50:50
//              used: שירים שכבר היו בחדר (כדי שלא יחזרו)
//   ph:<id> -> תמונת השחקן (data URL קטן), בנפרד כדי שהחדר לא יעבור את גבול הגודל
//
// v (גרסה) עולה בכל שינוי. האפליקציה שואלת כל שנייה "יש משהו חדש מאז v?".
// המעבר בין השאלות קורה כששואלים (tick) – לפי השעון של השרת, כך שלכולם זה קורה באותו רגע.
// משחק שלא נגעו בו שלושה ימים נמחק (alarm).
import { DEFAULT_SETTINGS, cleanSettings, makeOptions, pickSongs, pointsFor, scoreGame, songLabel, teamScores } from './game.js';
import { SONG_BY_ID } from './songs.js';

export const MAX_PLAYERS = 16;
// 30 שניות לכל שאלה
export const QUESTION_MS = 30000;
// ספירה לאחור לפני כל שאלה (גם כדי שהשיר הבא ייטען)
export const COUNTDOWN_MS = 3500;
// אחרי שהזמן נגמר – עוד רגע לתשובות שבדרך
export const GRACE_MS = 1000;
// כמה זמן רואים את התשובה הנכונה לפני השאלה הבאה
export const REVEAL_MS = 7000;
// אם הבאת השירים נתקעה – חוזרים לחדר ההמתנה
export const LOADING_MS = 45000;
// פחות מזה שירים – לא מתחילים
export const MIN_SONGS = 5;
const KEEP_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_NAME = 20;
const MAX_PHOTO = 20000;
const MAX_USED = 300;
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
    this.env = env;
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
      const fresh = { code: String(body.code), v: 1, hostId: player.id, phase: 'lobby', settings: { ...DEFAULT_SETTINGS }, players: [], game: null, used: [] };
      await this.addPlayer(fresh, player);
      await this.save(fresh);
      return json(200, await this.view(fresh, player.id));
    }

    if (!room) return json(404, { error: 'המשחק לא נמצא. אולי הקישור ישן?' });
    const changed = this.catchUp(room);

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
    const game = room.game;
    const reply = async () => {
      room.v++;
      this.tick(room);
      await this.save(room);
      return json(200, await this.view(room, me.id));
    };
    // שאלה שעכשיו אפשר לענות עליה
    const open = () => room.phase === 'question' && game && game.q === body.q && this.now() >= game.startsAt - 500;
    const myPick = () => {
      const picks = (game.picks[me.id] ||= []);
      return (picks[game.q] ||= { c: null });
    };

    switch (path) {
      case '/state':
        if (changed) await this.save(room);
        if (!changed && body.v === room.v) return json(200, { same: true, v: room.v, now: this.now() });
        return json(200, await this.view(room, me.id));

      // רק מי שפתח את המשחק קובע: לבד/קבוצות, שנים, שפה, כמה שאלות
      case '/settings': {
        if (me.id !== room.hostId) return json(403, { error: 'רק מי שפתח את המשחק יכול לשנות את ההגדרות' });
        if (room.phase !== 'lobby' && room.phase !== 'over') return json(409, { error: 'אי אפשר באמצע משחק' });
        room.settings = cleanSettings(body.settings, room.settings);
        return reply();
      }

      // מעבר לקבוצה האחרת (כל אחד לעצמו), או ערבוב קבוצות (מי שפתח)
      case '/team': {
        if (room.phase !== 'lobby' && room.phase !== 'over') return json(409, { error: 'אי אפשר באמצע משחק' });
        if (body.shuffle) {
          if (me.id !== room.hostId) return json(403, { error: 'רק מי שפתח את המשחק יכול לערבב' });
          const order = [...room.players].sort(() => this.random() - 0.5);
          order.forEach((p, i) => {
            p.team = i % 2;
          });
        } else if (body.team === 0 || body.team === 1) me.team = body.team;
        return reply();
      }

      // חזרה לחדר ההמתנה (לשנות הגדרות בסוף משחק)
      case '/lobby': {
        if (room.phase === 'over') room.phase = 'lobby';
        return reply();
      }

      // "מתחילים!" – בוחרים שירים, מוצאים לכל אחד קטע להשמעה, ומתחילים את השאלה הראשונה
      case '/start': {
        if (room.phase !== 'lobby' && room.phase !== 'over') return json(200, await this.view(room, me.id));
        if (room.settings.mode === 'teams' && [0, 1].some((t) => !room.players.some((p) => p.team === t))) {
          return json(409, { error: 'במשחק קבוצות צריך לפחות שחקן/ית אחד/ת בכל קבוצה' });
        }
        const loadId = `${this.now()}-${Math.floor(this.random() * 1e6)}`;
        room.phase = 'loading';
        room.loadId = loadId;
        room.loadAt = this.now();
        room.error = '';
        room.v++;
        await this.save(room);
        return this.load(loadId, me.id);
      }

      case '/extend': {
        if (!open()) return json(409, { error: 'השאלה כבר נגמרה', late: true });
        const pick = myPick();
        if (pick.c === null) pick.ext = true;
        return reply();
      }

      // 50:50 – רק למי שצבר מספיק נקודות, ורק לפני שענה
      case '/fifty': {
        if (!open()) return json(409, { error: 'השאלה כבר נגמרה', late: true });
        const score = scoreGame(game, [me.id], game.q)[me.id];
        const pick = myPick();
        if (pick.cut || pick.c !== null) return json(200, await this.view(room, me.id));
        if (score.jokers < 1) return json(409, { error: 'עוד אין לך 50:50' });
        const wrong = [0, 1, 2, 3].filter((i) => i !== game.correct[game.q]).sort(() => this.random() - 0.5);
        pick.cut = wrong.slice(0, 2).sort();
        return reply();
      }

      case '/answer': {
        if (!open() || this.now() > game.endsAt + GRACE_MS) return json(409, { error: 'הזמן נגמר', late: true });
        const choice = Number(body.choice);
        const pick = myPick();
        if (pick.c !== null) return json(200, await this.view(room, me.id));
        if (![0, 1, 2, 3].includes(choice) || pick.cut?.includes(choice)) return json(400, { error: 'תשובה לא תקינה' });
        pick.c = choice;
        pick.t = Math.max(0, this.now() - game.startsAt);
        return reply();
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

  // הבאת השירים (פונה לספרייה). בזמן ההמתנה יכולות להגיע בקשות אחרות – לכן קוראים שוב את החדר אחרי
  async load(loadId, meId) {
    const before = await this.storage.get('room');
    const candidates = pickSongs(before.settings, before.used, this.random);
    let found = {};
    try {
      found = await this.findSongs(candidates);
    } catch (e) {
      console.log('library failed', e?.message || e);
    }
    const room = await this.storage.get('room');
    if (!room || room.phase !== 'loading' || room.loadId !== loadId) return json(200, room ? await this.view(room, meId) : { ok: true });
    const songs = candidates.filter((s) => found[s.id]).slice(0, room.settings.count);
    if (songs.length < Math.min(MIN_SONGS, room.settings.count)) {
      room.phase = 'lobby';
      room.error = 'לא הצלחתי להביא שירים כרגע. נסו שוב עוד רגע 🙏';
    } else {
      const sets = songs.map((s) => makeOptions(s, this.random));
      room.game = {
        n: (room.game?.n || 0) + 1,
        ids: songs.map((s) => s.id),
        options: sets.map((o) => o.options),
        correct: sets.map((o) => o.correct),
        audio: songs.map((s) => found[s.id].src),
        art: songs.map((s) => found[s.id].art || ''),
        q: 0,
        startsAt: this.now() + COUNTDOWN_MS,
        endsAt: this.now() + COUNTDOWN_MS + QUESTION_MS,
        revealUntil: 0,
        picks: {},
      };
      room.used = [...room.used.filter((id) => !room.game.ids.includes(id)), ...room.game.ids].slice(-MAX_USED);
      room.phase = 'question';
    }
    room.v++;
    await this.save(room);
    return json(200, await this.view(room, meId));
  }

  // הספרייה (library.js) – Durable Object אחד שזוכר איפה כל שיר נמצא
  async findSongs(songs) {
    if (this.env.FIND_SONGS) return this.env.FIND_SONGS(songs);
    const lib = this.env.LIBRARY.get(this.env.LIBRARY.idFromName('lib'));
    const res = await lib.fetch(new Request('https://lib/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ songs: songs.map(({ id, title, artist, lang }) => ({ id, title, artist, lang })) }),
    }));
    if (!res.ok) throw new Error(`library ${res.status}`);
    return (await res.json()).found || {};
  }

  // כמה מעברים ברצף (למשל אם אף אחד לא שאל כמה שניות)
  catchUp(room) {
    let changed = false;
    for (let i = 0; i < 5 && this.tick(room); i++) changed = true;
    return changed;
  }

  // המעברים לפי השעון: סוף שאלה -> תשובה נכונה -> שאלה הבאה -> סוף המשחק. מחזיר true אם משהו השתנה
  tick(room) {
    const now = this.now();
    const game = room.game;
    if (room.phase === 'loading' && now - room.loadAt > LOADING_MS) {
      room.phase = 'lobby';
      room.error = 'לא הצלחתי להביא שירים כרגע. נסו שוב עוד רגע 🙏';
      room.v++;
      return true;
    }
    if (room.phase === 'question' && game) {
      const all = room.players.length > 0 && room.players.every((p) => (game.picks[p.id]?.[game.q]?.c ?? null) !== null);
      if (!all && now <= game.endsAt + GRACE_MS) return false;
      room.phase = 'reveal';
      game.revealUntil = now + REVEAL_MS;
      room.v++;
      return true;
    }
    if (room.phase === 'reveal' && game && now >= game.revealUntil) {
      if (game.q + 1 >= game.ids.length) {
        room.phase = 'over';
      } else {
        game.q++;
        game.startsAt = now + COUNTDOWN_MS;
        game.endsAt = game.startsAt + QUESTION_MS;
        room.phase = 'question';
      }
      room.v++;
      return true;
    }
    return false;
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

  // הצטרפות (לקבוצה הקטנה יותר), או עדכון שם/תמונה לשחקן שכבר במשחק
  async addPlayer(room, { id, token, name, photo }) {
    const existing = room.players.find((p) => p.id === id);
    if (existing) existing.name = name;
    else {
      const sizes = [0, 1].map((t) => room.players.filter((p) => p.team === t).length);
      room.players.push({ id, token, name, team: sizes[1] < sizes[0] ? 1 : 0, joined: this.now() });
    }
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

  // מה ששחקן אחד רואה. התשובה הנכונה נשלחת רק אחרי שהשאלה נגמרה
  async view(room, meId) {
    const ids = room.players.map((p) => p.id);
    const photos = await this.storage.get(ids.map((id) => `ph:${id}`));
    const game = room.game;
    const playing = game && ['question', 'reveal', 'over'].includes(room.phase);
    const revealed = room.phase === 'reveal' || room.phase === 'over';
    // הניקוד כולל את השאלה הנוכחית רק אחרי שרואים את התשובה
    const scores = playing ? scoreGame(game, ids, revealed ? game.q + 1 : game.q) : {};
    const totals = Object.fromEntries(ids.map((id) => [id, scores[id]?.total || 0]));
    const pickOf = (id) => (playing ? game.picks[id]?.[game.q] : null);
    const view = {
      code: room.code,
      v: room.v,
      now: this.now(),
      me: meId,
      hostId: room.hostId,
      phase: room.phase,
      settings: room.settings,
      error: room.error || '',
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        photo: photos.get(`ph:${p.id}`) || '',
        team: p.team ?? 0,
        total: totals[p.id],
        right: scores[p.id]?.right || 0,
        jokers: scores[p.id]?.jokers || 0,
        answered: (pickOf(p.id)?.c ?? null) !== null,
      })),
      teams: room.settings.mode === 'teams' ? teamScores(room.players, totals) : null,
      game: null,
    };
    if (!playing) return view;
    const q = game.q;
    const mine = game.picks[meId]?.[q] || { c: null };
    view.game = {
      n: game.n,
      q,
      count: game.ids.length,
      startsAt: game.startsAt,
      endsAt: game.endsAt,
      revealUntil: game.revealUntil,
      audio: game.audio[q],
      // השיר הבא – כדי שייטען מראש
      next: game.audio[q + 1] || null,
      options: game.options[q].map(songLabel),
      mine: { c: mine.c, ext: !!mine.ext, cut: mine.cut || null },
      reveal: revealed
        ? {
            correct: game.correct[q],
            song: { ...songLabel(game.ids[q]), decade: SONG_BY_ID.get(game.ids[q])?.decade || '', art: game.art[q] },
            picks: Object.fromEntries(ids.map((id) => {
              const p = game.picks[id]?.[q];
              return [id, { c: p?.c ?? null, ext: !!p?.ext, pts: pointsFor(p, game.correct[q]), t: p?.t ?? null }];
            })),
          }
        : null,
    };
    return view;
  }
}
