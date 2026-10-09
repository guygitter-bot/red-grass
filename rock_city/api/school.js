// בית הספר כולו – Durable Object אחד ("main"). כל הנתונים כאן, והשרת בודק הרשאות לכל שינוי.
//
// אחסון:
//   meta      -> { v, admin: { username, salt, hash }, fails: { count, until } }
//                v (גרסה) עולה בכל שינוי – האפליקציה שואלת "יש משהו חדש מאז v?"
//   sessions  -> { <sha256 של סוד הכניסה>: תוקף }   כניסות של המנהל (שם משתמש + סיסמה)
//   settings, teachers, students, lessons, payments  (ראו model.js)
//   requests  -> [{ id, from, to, action, lessonId, data, status, at, doneAt, by }]
//                בקשה לשינוי בשיעור של מורה אחר. action: save | remove | occurrence. status: pending | approved | rejected
//   notes     -> [{ id, to, text, lessonId, requestId, at, read }]   התראות. to = מזהה מורה, או office (מנהל ומורים עם ניהול)
//   log       -> [{ at, who, text }]   יומן שינויים (למנהלים)
//   key:<sha256> -> מזהה מורה   הקישור האישי של כל מורה (הסוד עצמו לא נשמר)
//   ph:<id>   -> תמונת מורה (data URL), בנפרד כדי שלא נעבור את גבול הגודל
import {
  DEFAULT_ROOMS,
  DEFAULT_SUBJECTS,
  LEVELS,
  canEdit,
  cleanLesson,
  cleanOccurrence,
  cleanPayment,
  cleanPhoto,
  cleanSettings,
  cleanStudent,
  cleanTeacher,
  describeLesson,
  fullName,
  isId,
  isManager,
  text,
} from './model.js';

const SESSION_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 20;
const MAX_FAILS = 8;
const LOCK_MS = 15 * 60 * 1000;
const MAX_NOTES = 400;
const MAX_LOG = 600;
const MAX_REQUESTS = 400;
// PBKDF2 ב-Cloudflare Workers מוגבל ל-100,000 סבבים
const ITERATIONS = 100000;

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const fail = (status, error) => Object.assign(new Error(error), { status });

export async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: ITERATIONS }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function newSecret(bytes = 24) {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

const KEYS = ['meta', 'sessions', 'settings', 'teachers', 'students', 'lessons', 'payments', 'requests', 'notes', 'log'];

export class School {
  constructor(state, env = {}) {
    this.storage = state.storage;
    this.now = env.NOW || (() => Date.now());
    this.d = null;
  }

  // כל הנתונים בזיכרון (נטענים פעם אחת)
  async load() {
    if (this.d) return this.d;
    const got = await this.storage.get(KEYS);
    this.d = {
      meta: got.get('meta') || { v: 1, admin: null, fails: { count: 0, until: 0 } },
      sessions: got.get('sessions') || {},
      settings: got.get('settings') || { subjects: DEFAULT_SUBJECTS, rooms: DEFAULT_ROOMS },
      teachers: got.get('teachers') || [],
      students: got.get('students') || [],
      lessons: got.get('lessons') || [],
      payments: got.get('payments') || [],
      requests: got.get('requests') || [],
      notes: got.get('notes') || [],
      log: got.get('log') || [],
    };
    return this.d;
  }

  // שומר את מה שהשתנה ומעלה גרסה
  async save(...keys) {
    const d = this.d;
    d.meta.v += 1;
    const entries = {};
    for (const k of new Set(['meta', ...keys])) entries[k] = d[k];
    await this.storage.put(entries);
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'בקשה לא תקינה' });
    }
    try {
      await this.load();
      const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      if (path === '/status') return json(200, { ready: !!this.d.meta.admin });
      if (path === '/setup') return json(200, await this.setup(body));
      if (path === '/login') return json(200, await this.login(body));
      const me = await this.who(token);
      if (!me) return json(401, { error: 'צריך להתחבר מחדש' });
      const handler = {
        '/state': () => this.state(me, body),
        '/save': () => this.saveItem(me, body),
        '/remove': () => this.removeItem(me, body),
        '/occurrence': () => this.occurrence(me, body),
        '/answer': () => this.answer(me, body),
        '/read': () => this.markRead(me, body),
        '/invite': () => this.invite(me, body),
        '/revoke': () => this.revoke(me, body),
        '/account': () => this.account(me, body),
        '/logout': () => this.logout(token),
      }[path];
      if (!handler) return json(404, { error: 'לא נמצא' });
      return json(200, await handler());
    } catch (e) {
      if (e.status) return json(e.status, { error: e.message });
      throw e;
    }
  }

  // ---------- כניסה ----------

  // פעם ראשונה: מי שפותח ראשון קובע שם משתמש וסיסמה למנהל
  async setup({ username, password }) {
    if (this.d.meta.admin) throw fail(409, 'כבר הוגדר מנהל');
    username = text(username, 40);
    if (!username) throw fail(400, 'חסר שם משתמש');
    if (String(password || '').length < 6) throw fail(400, 'הסיסמה צריכה להיות לפחות 6 תווים');
    const salt = newSecret(16);
    this.d.meta.admin = { username, salt, hash: await hashPassword(String(password), salt) };
    return { token: await this.newSession(), ...(await this.saved('meta')) };
  }

  async login({ username, password }) {
    const { meta } = this.d;
    if (!meta.admin) throw fail(409, 'עוד לא הוגדר מנהל');
    if (meta.fails.until > this.now()) throw fail(429, 'יותר מדי ניסיונות. נסו שוב בעוד רבע שעה');
    const ok = (await hashPassword(String(password || ''), meta.admin.salt)) === meta.admin.hash;
    if (!ok || !safeEqual(text(username, 40).toLowerCase(), meta.admin.username.toLowerCase())) {
      meta.fails.count += 1;
      if (meta.fails.count >= MAX_FAILS) meta.fails = { count: 0, until: this.now() + LOCK_MS };
      await this.storage.put('meta', meta);
      throw fail(401, 'שם משתמש או סיסמה לא נכונים');
    }
    meta.fails = { count: 0, until: 0 };
    return { token: await this.newSession(), ...(await this.saved('meta')) };
  }

  async newSession() {
    const token = newSecret();
    const now = this.now();
    const live = Object.entries(this.d.sessions).filter(([, exp]) => exp > now);
    live.sort((a, b) => b[1] - a[1]);
    this.d.sessions = Object.fromEntries([[await sha256(token), now + SESSION_MS], ...live.slice(0, MAX_SESSIONS - 1)]);
    await this.storage.put('sessions', this.d.sessions);
    return token;
  }

  async saved(...keys) {
    await this.save(...keys);
    return { v: this.d.meta.v };
  }

  // מי שולח את הבקשה – המנהל, או מורה לפי הקישור האישי שלו
  async who(token) {
    if (!token || token.length < 20 || token.length > 100) return null;
    const hash = await sha256(token);
    if (this.d.sessions[hash] > this.now()) return { role: 'admin', name: 'המנהל' };
    const teacherId = await this.storage.get(`key:${hash}`);
    const t = teacherId && this.d.teachers.find((x) => x.id === teacherId);
    if (!t || t.keyHash !== hash) return null;
    return { role: 'teacher', id: t.id, level: LEVELS.includes(t.level) ? t.level : 'view', name: fullName(t) };
  }

  async logout(token) {
    const hash = await sha256(token);
    if (this.d.sessions[hash]) {
      delete this.d.sessions[hash];
      await this.storage.put('sessions', this.d.sessions);
    }
    return { ok: true };
  }

  // החלפת שם משתמש / סיסמה של המנהל (צריך את הסיסמה הנוכחית)
  async account(me, { password, username, newPassword }) {
    if (me.role !== 'admin') throw fail(403, 'רק למנהל');
    const { admin } = this.d.meta;
    if ((await hashPassword(String(password || ''), admin.salt)) !== admin.hash) throw fail(401, 'הסיסמה הנוכחית לא נכונה');
    if (username !== undefined) admin.username = text(username, 40) || admin.username;
    if (newPassword) {
      if (String(newPassword).length < 6) throw fail(400, 'הסיסמה צריכה להיות לפחות 6 תווים');
      admin.salt = newSecret(16);
      admin.hash = await hashPassword(String(newPassword), admin.salt);
    }
    return this.saved('meta');
  }

  // ---------- קריאה ----------

  async state(me, { v }) {
    const d = this.d;
    if (v === d.meta.v) return { same: true, v };
    const manager = isManager(me);
    const photos = await this.storage.get(d.teachers.map((t) => `ph:${t.id}`));
    const mine = (n) => n.to === me.id || (manager && n.to === 'office');
    return {
      v: d.meta.v,
      me: { role: me.role, id: me.id || null, level: me.role === 'admin' ? 'admin' : me.level, name: me.name, username: me.role === 'admin' ? d.meta.admin.username : undefined },
      settings: d.settings,
      teachers: d.teachers.map(({ keyHash, ...t }) => ({ ...t, hasLink: !!keyHash, photo: photos.get(`ph:${t.id}`) || '' })),
      students: d.students,
      lessons: d.lessons,
      // תשלומים ויומן – רק למנהלים
      payments: manager ? d.payments : [],
      log: manager ? d.log.slice(0, 200) : [],
      requests: d.requests.filter((r) => manager || r.to === me.id || r.from === me.id).slice(0, 100),
      notes: d.notes.filter(mine).slice(0, 100),
    };
  }

  // ---------- התראות ויומן ----------

  note(to, txt, extra = {}) {
    this.d.notes.unshift({ id: newSecret(9), to, text: txt, at: this.now(), read: false, ...extra });
    this.d.notes.length = Math.min(this.d.notes.length, MAX_NOTES);
  }

  // מודיעים למורים של השיעור (חוץ ממי ששינה), ולמשרד כשמורה משנה בעצמו
  notify(me, teacherIds, txt, extra) {
    for (const id of new Set(teacherIds)) if (id && id !== me.id) this.note(id, txt, extra);
    if (me.role === 'teacher' && !isManager(me)) this.note('office', txt, extra);
  }

  logIt(me, txt) {
    this.d.log.unshift({ at: this.now(), who: me.name, text: txt });
    this.d.log.length = Math.min(this.d.log.length, MAX_LOG);
  }

  // ---------- שינויים ----------

  async saveItem(me, { kind, item }) {
    const d = this.d;
    if (!item || typeof item !== 'object') throw fail(400, 'בקשה לא תקינה');
    if (kind === 'lesson') return this.lessonChange(me, 'save', item.id, item);

    if (kind === 'student') {
      if (!canEdit(me)) throw fail(403, 'אין הרשאה לעריכה');
      const s = cleanStudent(item);
      const i = d.students.findIndex((x) => x.id === s.id);
      if (i >= 0) d.students[i] = s;
      else d.students.push(s);
      this.logIt(me, `${i >= 0 ? 'עדכן' : 'הוסיף'} תלמיד: ${fullName(s)}`);
      return this.saved('students', 'log');
    }

    if (kind === 'payment') {
      if (!isManager(me)) throw fail(403, 'רק למנהלים');
      const p = cleanPayment(item, d);
      const i = d.payments.findIndex((x) => x.id === p.id);
      if (i >= 0) d.payments[i] = p;
      else d.payments.unshift(p);
      this.logIt(me, `${i >= 0 ? 'עדכן' : 'רשם'} תשלום ₪${p.amount} – ${fullName(d.students.find((s) => s.id === p.studentId))}`);
      return this.saved('payments', 'log');
    }

    if (kind === 'teacher') {
      const i = d.teachers.findIndex((x) => x.id === item.id);
      const old = d.teachers[i];
      const self = me.role === 'teacher' && me.id === item.id;
      if (!isManager(me) && !self) throw fail(403, 'אין הרשאה');
      const t = cleanTeacher(item);
      // רק המנהל קובע הרשאות; מורה שמעדכן את עצמו לא משנה את ההרשאה שלו
      if (me.role !== 'admin') t.level = old ? old.level : 'view';
      if (old?.keyHash) t.keyHash = old.keyHash;
      if (i >= 0) d.teachers[i] = t;
      else d.teachers.push(t);
      const photo = cleanPhoto(item.photo);
      if (photo === '') await this.storage.delete(`ph:${t.id}`);
      else if (photo) await this.storage.put(`ph:${t.id}`, photo);
      this.logIt(me, `${i >= 0 ? 'עדכן' : 'הוסיף'} מורה: ${fullName(t)}`);
      return this.saved('teachers', 'log');
    }

    if (kind === 'settings') {
      if (!isManager(me)) throw fail(403, 'רק למנהלים');
      d.settings = cleanSettings(item, d.settings);
      this.logIt(me, 'עדכן חדרים ונושאים');
      return this.saved('settings', 'log');
    }
    throw fail(400, 'סוג לא מוכר');
  }

  async removeItem(me, { kind, id }) {
    const d = this.d;
    if (!isId(id)) throw fail(400, 'מזהה לא תקין');
    if (kind === 'lesson') return this.lessonChange(me, 'remove', id);
    if (!isManager(me)) throw fail(403, 'רק למנהלים');

    if (kind === 'student') {
      const s = d.students.find((x) => x.id === id);
      if (!s) return { v: d.meta.v };
      if (d.lessons.some((l) => l.studentIds.includes(id))) throw fail(409, 'לתלמיד יש שיעורים. קודם למחוק אותם (או לסמן אותו "לא פעיל")');
      d.students = d.students.filter((x) => x.id !== id);
      d.payments = d.payments.filter((p) => p.studentId !== id);
      this.logIt(me, `מחק תלמיד: ${fullName(s)}`);
      return this.saved('students', 'payments', 'log');
    }
    if (kind === 'payment') {
      d.payments = d.payments.filter((p) => p.id !== id);
      this.logIt(me, 'מחק תשלום');
      return this.saved('payments', 'log');
    }
    if (kind === 'teacher') {
      if (me.role !== 'admin') throw fail(403, 'רק למנהל');
      const t = d.teachers.find((x) => x.id === id);
      if (!t) return { v: d.meta.v };
      if (d.lessons.some((l) => l.teacherId === id)) throw fail(409, 'למורה יש שיעורים. קודם להעביר אותם למורה אחר או למחוק');
      if (t.keyHash) await this.storage.delete(`key:${t.keyHash}`);
      await this.storage.delete(`ph:${id}`);
      d.teachers = d.teachers.filter((x) => x.id !== id);
      this.logIt(me, `מחק מורה: ${fullName(t)}`);
      return this.saved('teachers', 'log');
    }
    throw fail(400, 'סוג לא מוכר');
  }

  async occurrence(me, body) {
    const o = cleanOccurrence(body);
    return this.lessonChange(me, 'occurrence', body.lessonId, o);
  }

  // שינוי בשיעור. מנהל – מיד. מורה עם עריכה – בשיעורים שלו מיד, ובשיעור של מורה אחר נשלחת בקשה למורה ההוא
  async lessonChange(me, action, lessonId, data) {
    const d = this.d;
    if (!canEdit(me)) throw fail(403, 'אין הרשאה לעריכה');
    if (!isId(lessonId)) throw fail(400, 'מזהה לא תקין');
    const old = d.lessons.find((l) => l.id === lessonId);
    if (action !== 'save' && !old) throw fail(404, 'השיעור לא נמצא');
    if (action === 'save') data = cleanLesson(data, d);
    // של מי השיעור? (שיעור קיים – של המורה שלו; שיעור חדש או העברה – גם של המורה החדש)
    const owners = new Set([old?.teacherId, action === 'save' ? data.teacherId : null].filter(Boolean));
    const others = [...owners].filter((id) => id !== me.id);
    if (isManager(me) || others.length === 0) return this.applyLesson(me, action, lessonId, data);

    const to = old && old.teacherId !== me.id ? old.teacherId : data.teacherId;
    const req = { id: newSecret(9), from: me.id, to, action, lessonId, data, status: 'pending', at: this.now() };
    d.requests.unshift(req);
    d.requests.length = Math.min(d.requests.length, MAX_REQUESTS);
    const what = { save: old ? 'לשנות' : 'להוסיף', remove: 'למחוק', occurrence: 'לעדכן' }[action];
    const desc = describeLesson(action === 'save' ? data : old, d.students);
    this.note(to, `${me.name} מבקש/ת ${what} שיעור: ${desc}`, { requestId: req.id, lessonId });
    this.note('office', `${me.name} ביקש/ה ${what} שיעור של ${fullName(d.teachers.find((t) => t.id === to))}: ${desc}`, { requestId: req.id, lessonId });
    this.logIt(me, `ביקש/ה ${what} שיעור: ${desc}`);
    return { request: req.id, ...(await this.saved('requests', 'notes', 'log')) };
  }

  async applyLesson(me, action, lessonId, data, quiet = false) {
    const d = this.d;
    const i = d.lessons.findIndex((l) => l.id === lessonId);
    const old = d.lessons[i];
    let desc;
    if (action === 'save') {
      const lesson = { ...data, dates: old?.dates || {} };
      if (i >= 0) d.lessons[i] = lesson;
      else d.lessons.push(lesson);
      desc = `${old ? 'שינה' : 'הוסיף'} שיעור: ${describeLesson(lesson, d.students)}`;
      if (!quiet) this.notify(me, [old?.teacherId, lesson.teacherId], `${me.name} ${desc}`, { lessonId });
    } else if (action === 'remove') {
      if (i < 0) throw fail(404, 'השיעור לא נמצא');
      d.lessons.splice(i, 1);
      desc = `מחק שיעור: ${describeLesson(old, d.students)}`;
      if (!quiet) this.notify(me, [old.teacherId], `${me.name} ${desc}`);
    } else {
      if (i < 0) throw fail(404, 'השיעור לא נמצא');
      const dates = { ...(old.dates || {}) };
      if (data.status || data.note) dates[data.date] = { status: data.status, note: data.note };
      else delete dates[data.date];
      // לא שומרים היסטוריה ישנה מדי (שנה אחורה)
      const cutoff = new Date(this.now() - 400 * 86400000).toISOString().slice(0, 10);
      for (const k of Object.keys(dates)) if (k < cutoff) delete dates[k];
      d.lessons[i] = { ...old, dates };
      const label = { cancelled: 'ביטל', attended: 'סימן הגעה', absent: 'סימן היעדרות', '': 'עדכן' }[data.status];
      desc = `${label} ב־${data.date.split('-').reverse().join('/')}: ${describeLesson(old, d.students)}`;
      if (!quiet && data.status === 'cancelled') this.notify(me, [old.teacherId], `${me.name} ${desc}`, { lessonId });
    }
    this.logIt(me, desc);
    return this.saved('lessons', 'notes', 'log');
  }

  // אישור או דחייה של בקשה – המורה שהבקשה אליו, או מנהל
  async answer(me, { id, approve }) {
    const d = this.d;
    const req = d.requests.find((r) => r.id === id);
    if (!req) throw fail(404, 'הבקשה לא נמצאה');
    if (req.status !== 'pending') throw fail(409, 'כבר טיפלו בבקשה הזאת');
    if (!isManager(me) && req.to !== me.id) throw fail(403, 'אין הרשאה');
    const from = d.teachers.find((t) => t.id === req.from);
    const actor = { ...me, name: `${me.name} (בקשה של ${fullName(from)})` };
    if (approve) {
      try {
        if (req.action === 'save') req.data = cleanLesson(req.data, d);
        await this.applyLesson(actor, req.action, req.lessonId, req.data, true);
      } catch (e) {
        if (!e.status) throw e;
        req.status = 'failed';
        req.doneAt = this.now();
        await this.save('requests');
        throw fail(409, `אי אפשר לאשר: ${e.message}`);
      }
    }
    req.status = approve ? 'approved' : 'rejected';
    req.doneAt = this.now();
    req.by = me.name;
    // מסמנים את ההתראות על הבקשה כנקראו
    for (const n of d.notes) if (n.requestId === id) n.read = true;
    this.note(req.from, `${me.name} ${approve ? 'אישר/ה' : 'דחה/תה'} את הבקשה שלך`, { requestId: id, lessonId: req.lessonId });
    if (!approve) this.logIt(me, `דחה/תה בקשה של ${fullName(from)}`);
    return this.saved('requests', 'notes', 'log', 'lessons');
  }

  async markRead(me, { ids }) {
    const manager = isManager(me);
    const all = ids === 'all';
    const set = new Set(Array.isArray(ids) ? ids : []);
    for (const n of this.d.notes) if ((all || set.has(n.id)) && (n.to === me.id || (manager && n.to === 'office'))) n.read = true;
    return this.saved('notes');
  }

  // קישור אישי למורה: סוד חדש (הקודם מפסיק לעבוד). רק המנהל
  async invite(me, { teacherId, level }) {
    if (me.role !== 'admin') throw fail(403, 'רק למנהל');
    const t = this.d.teachers.find((x) => x.id === teacherId);
    if (!t) throw fail(404, 'המורה לא נמצא');
    if (t.keyHash) await this.storage.delete(`key:${t.keyHash}`);
    const key = newSecret();
    t.keyHash = await sha256(key);
    if (LEVELS.includes(level)) t.level = level;
    await this.storage.put(`key:${t.keyHash}`, t.id);
    this.logIt(me, `יצר קישור כניסה ל${fullName(t)}`);
    return { key, ...(await this.saved('teachers', 'log')) };
  }

  async revoke(me, { teacherId }) {
    if (me.role !== 'admin') throw fail(403, 'רק למנהל');
    const t = this.d.teachers.find((x) => x.id === teacherId);
    if (!t) throw fail(404, 'המורה לא נמצא');
    if (t.keyHash) await this.storage.delete(`key:${t.keyHash}`);
    delete t.keyHash;
    this.logIt(me, `ביטל את הגישה של ${fullName(t)}`);
    return this.saved('teachers', 'log');
  }
}
