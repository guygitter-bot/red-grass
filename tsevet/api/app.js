// האפליקציה של הצוות (tsevet/web): שיחות, קבצים, זיכרון, עלויות והגדרות.
// הכול רץ בתוך ה-Durable Object (team.js קורא ל-handleApp); כאן אין Telegram.
//
// אחסון נוסף (מעבר למה שמתואר ב-team.js):
//   auth            -> הסיסמה והמכשירים המחוברים (auth.js)
//   convs           -> השיחות שנפתחו באפליקציה [{ id, title, at }]
//   titles          -> שמות שניתנו לשיחות שהגיעו מ-Telegram { <id>: title }
//   h:app:<id>      -> ההודעות של שיחה מהאפליקציה (שיחות Telegram נשארות ב-h:<chat>:<thread>)
//   f:<id>          -> פרטי קובץ שהועלה { id, kind, name, type, size, dur, w, h, poster, conv, at } (התוכן ב-R2: files/<id>)
//   fileKey         -> סוד לחתימה על קישורים זמניים לקבצים
//   settings        -> { models: { <agent>: 'haiku' | 'sonnet' | 'opus' } }
//   busy            -> { <מפתח שיחה>: { agent } } מי כותב עכשיו
//   r:<id>          -> עריכת וידאו ברקע (render.js)
//   g:<id>          -> סרטון שנוצר במחולל הווידאו, אחרי אישור (gen.js)
//   schedules       -> משימות קבועות (schedule.js); vapid / subs -> התראות לטלפון (notify.js)
//   skills          -> הסקילים שהספרן לימד את הצוות ממאגר AI (maagar.js)
import { AGENTS, AGENT_KEYS, TIERS } from './agents.js';
import * as auth from './auth.js';
import { approve as approveGen, cancel as cancelGen, dailyLimit, genReady, genView } from './gen.js';
import { renderView } from './render.js';
import { approveSkill, declineSkill } from './maagar.js';
import { BUDGETS, MAX_SCHEDULES, cleanSchedule, nextRun } from './schedule.js';
import { pushAll, subscribe, unsubscribe, vapidKeys } from './notify.js';

const { fail } = auth;
export const APP_PREFIX = 'h:app:';
export const MAX_TEXT = 8000;
const MAX_FILES = 6;
const MAX_TITLE = 60;
const MAX_CONVS = 200;
const ROOM_MIN = 2;
const ROOM_MAX = 6;

// חדר = שיחה עם בוטים נבחרים בלבד (2-6, אפשר עם המנהל). רק הם עונים, מעבירים ומקבלים שלבים בחדר
export function roomMembers(list) {
  if (!Array.isArray(list)) return null;
  const members = AGENT_KEYS.filter((k) => list.includes(k));
  if (members.length < ROOM_MIN) throw fail(400, `בחדר צריך לפחות ${ROOM_MIN} בוטים`);
  if (members.length > ROOM_MAX) throw fail(400, `בחדר אפשר עד ${ROOM_MAX} בוטים`);
  return members;
}
const HOUR = 60 * 60 * 1000;
const FILE_TTL = 6 * HOUR;
const ILS = 3.7;

export const newId = (n = 12) => crypto.randomUUID().replace(/-/g, '').slice(0, n);
export const israelDate = (t = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(t);

// מזהה שיחה <-> מפתח באחסון. שיחה מ-Telegram: tg:<chat>:<thread>
export function convKey(id) {
  id = String(id || '');
  if (/^tg:-?\d+:\d+$/.test(id)) return `h:${id.slice(3)}`;
  return /^[a-z0-9]{6,24}$/.test(id) ? `${APP_PREFIX}${id}` : null;
}
export const convId = (key) => (key.startsWith(APP_PREFIX) ? key.slice(APP_PREFIX.length) : `tg:${key.slice(2)}`);

// ---------- הגדרות ----------
export async function getSettings(storage) {
  const s = (await storage.get('settings')) || {};
  const models = {};
  for (const k of AGENT_KEYS) models[k] = TIERS.includes(s.models?.[k]) ? s.models[k] : AGENTS[k].tier;
  // notifyAll = התראה לטלפון גם כשמשימה רגילה מסתיימת (קבועות – תמיד)
  return { models, notifyAll: Boolean(s.notifyAll) };
}

// סקיל שהוצע בשיחה (מ-GitHub): מחכה / אושר / נמחק
function proposedView(names, skills) {
  return names.map((name) => {
    const s = skills.find((x) => x.name === name);
    if (!s) return { name, status: 'removed' };
    const v = s.next || s;
    return { name, title: v.title, when: v.when, agents: v.agents, origin: v.origin || null, update: Boolean(s.next), status: s.pending || s.next ? 'pending' : 'approved' };
  });
}

// משימות קבועות, עם הפעם הבאה שהן ירוצו
async function schedulesView(storage) {
  const now = Date.now();
  const list = (await storage.get('schedules')) || [];
  return {
    schedules: list.map((s) => ({ ...s, next: s.enabled ? nextRun(s, Math.max(now, s.lastRun || 0)) : null })),
    budgets: BUDGETS,
  };
}

// ---------- קבצים ----------
// קישור זמני לקובץ (חתום). התוקף מעוגל לשעה, כדי שהקישור לא ישתנה בכל רענון והסרטון לא ייטען מחדש
async function fileUrl(storage, origin, id) {
  let secret = await storage.get('fileKey');
  if (!secret) {
    secret = auth.randomHex();
    await storage.put('fileKey', secret);
  }
  const exp = Math.ceil((Date.now() + FILE_TTL) / HOUR) * HOUR;
  return `${origin}/file/${id}?e=${exp}&s=${await auth.sign(secret, `${id}:${exp}`)}`;
}

export async function checkFileUrl(storage, id, exp, sig) {
  const secret = await storage.get('fileKey');
  if (!secret || !(Number(exp) > Date.now())) return null;
  if (!auth.safeEqual(await auth.sign(secret, `${id}:${Number(exp)}`), String(sig || ''))) return null;
  return (await storage.get(`f:${id}`)) || null;
}

export async function fileView(storage, origin, f) {
  if (!f?.id) return null;
  return {
    id: f.id, kind: f.kind, name: f.name || '', size: f.size || 0, dur: f.dur || 0, w: f.w || 0, h: f.h || 0,
    url: await fileUrl(storage, origin, f.id),
    ...(f.poster ? { poster: await fileUrl(storage, origin, f.poster) } : {}),
  };
}

const KINDS = { image: /^image\/(jpeg|png|webp|gif)$/, video: /^video\//, audio: /^audio\// };
export const MAX_BYTES = { image: 8 * 1024 * 1024, video: 95 * 1024 * 1024, audio: 30 * 1024 * 1024 };

// סוג הקובץ לפי ה-type שהדפדפן שלח (null = לא מקבלים)
export const kindOf = (type) => Object.keys(KINDS).find((k) => KINDS[k].test(String(type || ''))) || null;

// נרשם אחרי שה-worker שמר את התוכן ב-R2
export async function addFile(storage, f) {
  const num = (v, max) => Math.min(Math.max(Number(v) || 0, 0), max);
  const rec = {
    id: f.id,
    kind: f.kind,
    name: String(f.name || '').replace(/[\r\n"]/g, ' ').slice(0, 120),
    type: String(f.type || ''),
    size: Number(f.size) || 0,
    dur: num(f.dur, 36_000),
    w: num(f.w, 20_000),
    h: num(f.h, 20_000),
    at: Date.now(),
  };
  if (f.poster && (await storage.get(`f:${f.poster}`))?.kind === 'image') rec.poster = f.poster;
  if (f.conv) rec.conv = f.conv;
  await storage.put(`f:${rec.id}`, rec);
  return rec;
}

// ---------- שיחות ----------
async function convList(t) {
  const { storage } = t;
  const convs = (await storage.get('convs')) || [];
  const titles = (await storage.get('titles')) || {};
  const q = (await storage.get('q')) || [];
  const busy = (key) => q.some((j) => t.jobKey(j) === key);
  const out = [];
  for (const c of convs) {
    const key = `${APP_PREFIX}${c.id}`;
    // שיחה שנפתחה ולא נכתב בה כלום – לא מופיעה ברשימה
    // שיחה ריקה לא מופיעה; חדר כן (נפתח בכוונה)
    if (!c.members && !busy(key) && !(await storage.get(key))?.length) continue;
    out.push({ id: c.id, title: c.title || (c.members ? 'חדר' : 'שיחה חדשה'), at: c.at, source: 'app', busy: busy(key), ...(c.members ? { members: c.members } : {}) });
  }
  // שיחות שהתנהלו ב-Telegram – ממשיכות כאן עם כל ההיסטוריה
  const all = await storage.list({ prefix: 'h:' });
  for (const [key, history] of all) {
    if (key.startsWith(APP_PREFIX) || !history?.length) continue;
    const id = convId(key);
    const thread = Number(key.split(':')[2]) || 0;
    out.push({ id, title: titles[id] || (thread ? `Telegram · נושא ${thread}` : 'Telegram'), at: history[history.length - 1].at || 0, source: 'tg', busy: busy(key) });
  }
  return out.sort((a, b) => b.at - a.at);
}

// שיחות ריקות (נפתחו ולא נכתב בהן כלום) נמחקות כשפותחים שיחה חדשה, כדי שלא יתמלא המקום. שיחה מהשעה האחרונה נשארת.
async function dropEmpty(storage, convs) {
  const keep = [];
  for (const c of convs) {
    if (c.members || Date.now() - c.at < 3600e3 || (await storage.get(`${APP_PREFIX}${c.id}`))?.length) keep.push(c);
  }
  return keep;
}

async function convView(t, id, origin) {
  const { storage } = t;
  const key = convKey(id);
  if (!key) throw fail(404, 'השיחה לא נמצאה');
  const history = (await storage.get(key)) || [];
  const convs = (await storage.get('convs')) || [];
  const meta = convs.find((c) => c.id === id);
  if (!meta && !history.length) throw fail(404, 'השיחה לא נמצאה');
  const allSkills = (await storage.get('skills')) || [];
  const messages = [];
  let pending = false;
  for (let i = 0; i < history.length; i++) {
    const h = history[i];
    const files = (await Promise.all((h.files || []).map((f) => fileView(storage, origin, f)))).filter(Boolean);
    const renders = [];
    for (const rid of h.renders || []) {
      const r = await renderView(t, rid, origin);
      if (r) renders.push(r);
      if (r?.status === 'queued') pending = true;
    }
    const gens = [];
    for (const gid of h.gens || []) {
      const g = await genView(t, gid, origin);
      if (g) gens.push(g);
      if (g?.status === 'working') pending = true;
    }
    messages.push({
      i, who: h.who, text: h.text || '', at: h.at || 0,
      ...(h.photo ? { photo: true } : {}),
      ...(h.handoff ? { handoff: h.handoff } : {}),
      ...(h.plan ? { plan: h.plan } : {}),
      ...(h.step ? { step: h.step } : {}),
      ...(h.skillsProposed ? { skills: proposedView(h.skillsProposed, allSkills) } : {}),
      ...(files.length ? { files } : {}),
      ...(renders.length ? { renders } : {}),
      ...(gens.length ? { gens } : {}),
    });
  }
  const job = ((await storage.get('q')) || []).find((j) => t.jobKey(j) === key);
  const now = ((await storage.get('busy')) || {})[key];
  const titles = (await storage.get('titles')) || {};
  return {
    id,
    title: meta?.title || titles[id] || (id.startsWith('tg:') ? 'Telegram' : meta?.members ? 'חדר' : 'שיחה חדשה'),
    source: id.startsWith('tg:') ? 'tg' : 'app',
    ...(meta?.members ? { members: meta.members } : {}),
    messages,
    // step = איפה התוכנית של המנהל עומדת (שלב n מתוך of)
    busy: job ? { agent: now?.agent || job.target || null, ...(job.plan?.length ? { step: { n: job.step, of: job.steps } } : {}) } : null,
    pending,
  };
}

async function setTitle(storage, id, title) {
  title = String(title || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE);
  if (!title) throw fail(400, 'צריך שם');
  if (id.startsWith('tg:')) {
    const titles = (await storage.get('titles')) || {};
    titles[id] = title;
    await storage.put('titles', titles);
    return;
  }
  const convs = (await storage.get('convs')) || [];
  const c = convs.find((x) => x.id === id);
  if (!c) throw fail(404, 'השיחה לא נמצאה');
  c.title = title;
  await storage.put('convs', convs);
}

async function deleteConv(t, id) {
  const { storage } = t;
  const key = convKey(id);
  if (!key) throw fail(404, 'השיחה לא נמצאה');
  await t.dropJobs(key);
  // הקבצים של השיחה (גם סרטונים שנערכו) נמחקים איתה
  const history = (await storage.get(key)) || [];
  const ids = new Set();
  for (const h of history) {
    for (const f of h.files || []) {
      ids.add(f.id);
      if (f.poster) ids.add(f.poster);
    }
    for (const gid of h.gens || []) {
      const g = await storage.get(`g:${gid}`);
      if (g?.file) ids.add(g.file);
      await storage.delete(`g:${gid}`);
    }
    for (const rid of h.renders || []) {
      const r = await storage.get(`r:${rid}`);
      if (r?.file) ids.add(r.file);
      await storage.delete(`r:${rid}`);
    }
  }
  for (const fid of ids) {
    await storage.delete(`f:${fid}`);
    await t.env.FILES?.delete(`files/${fid}`).catch(() => {});
  }
  await storage.delete(key);
  await storage.put('convs', ((await storage.get('convs')) || []).filter((c) => c.id !== id));
  const titles = (await storage.get('titles')) || {};
  if (titles[id]) {
    delete titles[id];
    await storage.put('titles', titles);
  }
}

async function send(t, body) {
  const { storage } = t;
  const id = String(body.id || '');
  const key = convKey(id);
  if (!key) throw fail(404, 'השיחה לא נמצאה');
  const convs = (await storage.get('convs')) || [];
  const meta = convs.find((c) => c.id === id);
  const history = (await storage.get(key)) || [];
  if (!meta && !history.length) throw fail(404, 'השיחה לא נמצאה');

  const text = String(body.text || '').trim().slice(0, MAX_TEXT);
  const files = [];
  for (const fid of (Array.isArray(body.files) ? body.files : []).slice(0, MAX_FILES)) {
    const f = await storage.get(`f:${String(fid)}`);
    if (!f) continue;
    if (!f.conv) await storage.put(`f:${f.id}`, { ...f, conv: id });
    files.push({ id: f.id, kind: f.kind, name: f.name, size: f.size, dur: f.dur, w: f.w, h: f.h, ...(f.poster ? { poster: f.poster } : {}) });
  }
  if (!text && !files.length) throw fail(400, 'אין מה לשלוח');

  await t.pushHistory(key, { who: 'owner', text, ...(files.length ? { files } : {}), at: Date.now() });
  if (meta) {
    meta.at = Date.now();
    // השיחה מקבלת שם מההודעה הראשונה
    if (!meta.title) meta.title = (text || files[0]?.name || 'שיחה').replace(/\s+/g, ' ').slice(0, 40);
    await storage.put('convs', convs);
  }
  const target = AGENT_KEYS.includes(body.to) ? body.to : null;
  await t.enqueue({ id: newId(), chan: 'app', key, target, turns: 0, attempts: 0 });
  return { ok: true };
}

// ---------- עלויות ----------
async function costs(storage, clipsLimit = 0) {
  const date = israelDate();
  const month = date.slice(0, 7);
  const prev = israelDate(new Date(`${month}-01T12:00:00Z`).getTime() - 5 * 24 * HOUR).slice(0, 7);
  const read = async (m) => {
    const c = (await storage.get(`cost:${m}`)) || {};
    return { month: m, usd: c.usd || 0, days: c.days || {}, agents: c.agents || {}, clips: c.clips || 0 };
  };
  const now = await read(month);
  return { today: now.days[date.slice(8)] || 0, now, prev: await read(prev), ils: ILS, clipsToday: (await storage.get(`clips:${date}`)) || 0, clipsLimit };
}

// ---------- הכתובות ----------
// מחזיר את התשובה (אובייקט), או זורק fail(status, הודעה)
export async function handleApp(t, path, body, headers, origin) {
  const { storage } = t;
  if (path === '/app/status') return { ready: await auth.isReady(storage) };
  if (path === '/app/setup') return { token: await auth.setup(storage, body.password) };
  if (path === '/app/login') return { token: await auth.login(storage, body.password) };

  await auth.authed(storage, headers);
  switch (path) {
    case '/app/auth':
      return { ok: true };
    case '/app/logout':
      await auth.logout(storage, headers);
      return { ok: true };
    case '/app/password':
      return { token: await auth.changePassword(storage, body.password, body.newPassword) };

    case '/app/team': {
      const settings = await getSettings(storage);
      const busy = Object.values((await storage.get('busy')) || {}).map((b) => b.agent);
      const c = await costs(storage);
      return {
        agents: AGENT_KEYS.map((k) => ({ key: k, name: AGENTS[k].name, emoji: AGENTS[k].emoji, short: AGENTS[k].short, tier: settings.models[k], busy: busy.includes(k) })),
        convs: await convList(t),
        costs: { today: c.today, month: c.now.usd, ils: ILS },
        video: Boolean(t.env.GITHUB_TOKEN && t.env.FILES),
        maagar: Boolean(t.env.MAAGAR),
        gen: genReady(t.env),
      };
    }
    case '/app/conv':
      return convView(t, String(body.id || ''), origin);
    case '/app/conv/new': {
      const convs = await dropEmpty(storage, (await storage.get('convs')) || []);
      const members = roomMembers(body.members);
      const conv = { id: newId(), title: String(body.title || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE), at: Date.now(), ...(members ? { members } : {}) };
      await storage.put('convs', [conv, ...convs].slice(0, MAX_CONVS));
      return { id: conv.id };
    }
    // מי בחדר (להוסיף / להוריד בוטים)
    case '/app/conv/members': {
      const convs = (await storage.get('convs')) || [];
      const c = convs.find((x) => x.id === String(body.id || ''));
      if (!c?.members) throw fail(404, 'החדר לא נמצא');
      c.members = roomMembers(body.members);
      await storage.put('convs', convs);
      return { ok: true, members: c.members };
    }
    case '/app/conv/rename':
      await setTitle(storage, String(body.id || ''), body.title);
      return { ok: true };
    case '/app/conv/delete':
      await deleteConv(t, String(body.id || ''));
      return { ok: true };
    case '/app/send':
      return send(t, body);
    case '/app/stop': {
      const key = convKey(body.id);
      if (key) await t.dropJobs(key);
      return { ok: true };
    }

    case '/app/memory':
      return { notes: (await storage.get('notes')) || [] };
    case '/app/memory/add': {
      const note = String(body.note || '').replace(/\s+/g, ' ').trim().slice(0, 300);
      if (!note) throw fail(400, 'אין מה לשמור');
      const notes = [...((await storage.get('notes')) || []), note].slice(-60);
      await storage.put('notes', notes);
      return { notes };
    }
    case '/app/memory/delete': {
      const notes = (await storage.get('notes')) || [];
      const i = Number(body.number) - 1;
      // text = מה שהמשתמש ראה, כדי שלא יימחק משפט אחר אם הרשימה השתנתה בינתיים
      if (!(i >= 0 && i < notes.length) || (body.text != null && notes[i] !== body.text)) throw fail(409, 'הרשימה השתנתה, נסו שוב');
      notes.splice(i, 1);
      await storage.put('notes', notes);
      return { notes };
    }

    // יצירת סרטון: רק אחרי אישור בכפתור (עולה כסף)
    case '/app/gen/approve':
      return approveGen(t, body.id);
    case '/app/gen/cancel':
      return cancelGen(storage, body.id);

    // משימות קבועות (schedule.js; ההרצה עצמה ב-team.js)
    case '/app/schedules':
      return schedulesView(storage);
    case '/app/schedules/save': {
      const list = (await storage.get('schedules')) || [];
      const old = body.id ? list.find((s) => s.id === body.id) : null;
      if (body.id && !old) throw fail(404, 'המשימה לא נמצאה');
      if (!old && list.length >= MAX_SCHEDULES) throw fail(400, `עד ${MAX_SCHEDULES} משימות קבועות`);
      const s = cleanSchedule(body, old || {});
      if (s.error) throw fail(400, s.error);
      // משימה חדשה (או שהזמן שלה השתנה) לא רצה מיד על "פעמים שפוספסו" – רק מהפעם הבאה
      const fresh = !old || old.time !== s.time || String(old.days) !== String(s.days) || (!old.enabled && s.enabled);
      const saved = old ? { ...s, ...(fresh ? { lastRun: Date.now() } : {}) } : { ...s, id: newId(), createdAt: Date.now(), lastRun: Date.now() };
      await storage.put('schedules', old ? list.map((x) => (x.id === old.id ? saved : x)) : [...list, saved]);
      await t.armSchedules();
      return schedulesView(storage);
    }
    case '/app/schedules/delete':
      await storage.put('schedules', ((await storage.get('schedules')) || []).filter((s) => s.id !== String(body.id || '')));
      return schedulesView(storage);
    case '/app/schedules/run': {
      const s = ((await storage.get('schedules')) || []).find((x) => x.id === String(body.id || ''));
      if (!s) throw fail(404, 'המשימה לא נמצאה');
      return { conv: await t.startSchedule(s) };
    }

    // התראות לטלפון (notify.js)
    case '/app/push/key':
      return { key: (await vapidKeys(storage)).publicKey };
    case '/app/push/subscribe':
      await subscribe(storage, body.sub);
      return { ok: true };
    case '/app/push/unsubscribe':
      await unsubscribe(storage, String(body.endpoint || ''));
      return { ok: true };
    case '/app/push/test':
      return { sent: await pushAll(t, { title: '🔔 התראות מהצוות פועלות', body: 'כשמשימה תסתיים – תקבל הודעה כאן', url: (t.env.APP_URL || 'https://tsevet-ai.pages.dev/'), tag: 'tsevet-test' }) };

    // מה שהספרן לימד את הצוות ממאגר AI
    case '/app/skills':
      return { skills: (await storage.get('skills')) || [] };
    // סקיל מ-GitHub מחכה לאישור; אחרי האישור הבוטים משתמשים בו
    // סקיל חדש מחכה לאישור; אחרי האישור הבוט שהציע אותו ממשיך לעבוד באותה שיחה, לפיו
    case '/app/skills/approve': {
      const r = approveSkill((await storage.get('skills')) || [], String(body.name || ''));
      if (!r) throw fail(404, 'אין סקיל כזה שמחכה לאישור');
      await storage.put('skills', r.skills);
      const p = r.proposedIn;
      if (p?.key && AGENTS[p.agent] && (await storage.get(p.key))) {
        await t.pushHistory(p.key, { who: 'system', text: `✅ הסקיל "${r.skill.title}" אושר – ${AGENTS[p.agent].emoji} ${AGENTS[p.agent].name} ממשיך לעבוד לפיו`, at: Date.now() });
        await t.enqueue({ id: newId(), chan: 'app', key: p.key, target: p.agent, turns: 0, attempts: 0, resume: r.skill.name });
      }
      return { skills: r.skills };
    }
    // "לא צריך": סקיל חדש נמחק, עדכון – הגרסה הקיימת נשארת
    case '/app/skills/decline': {
      const r = declineSkill((await storage.get('skills')) || [], String(body.name || ''));
      if (!r) throw fail(404, 'אין סקיל כזה שמחכה לאישור');
      await storage.put('skills', r.skills);
      const p = r.proposedIn;
      if (p?.key && AGENTS[p.agent] && (await storage.get(p.key))) {
        await t.pushHistory(p.key, { who: 'system', text: `❌ הסקיל "${r.skill.title}" לא אושר. אפשר לבקש מ${AGENTS[p.agent].name} להמשיך בלעדיו, או לחפש סקיל אחר.`, at: Date.now() });
      }
      return { skills: r.skills };
    }
    case '/app/skills/delete': {
      const skills = ((await storage.get('skills')) || []).filter((s) => s.name !== String(body.name || ''));
      await storage.put('skills', skills);
      return { skills };
    }

    case '/app/costs':
      return costs(storage, dailyLimit(t.env));
    case '/app/settings': {
      if (body.models && typeof body.models === 'object') {
        const current = await getSettings(storage);
        for (const k of AGENT_KEYS) if (TIERS.includes(body.models[k])) current.models[k] = body.models[k];
        await storage.put('settings', { ...((await storage.get('settings')) || {}), models: current.models });
      }
      if (typeof body.notifyAll === 'boolean') await storage.put('settings', { ...((await storage.get('settings')) || {}), notifyAll: body.notifyAll });
      return getSettings(storage);
    }
    default:
      throw fail(404, 'לא נמצא');
  }
}
