// הנתונים של בית הספר: ניקוי ובדיקה של כל מה שמגיע מהאפליקציה, והרשאות.
//
// teacher  -> { id, first, last, phone, email, subjects: [..], color, notes, level, hasLink }
//             level: view (צפייה בלבד) | edit (עריכת השיעורים שלו; שינוי אצל מורה אחר = בקשה) | manage (ניהול מלא)
// student  -> { id, first, last, phone, address, contactName, contactPhone, birth, fee, notes, active }
//             fee = מחיר לחודש (לא חובה)
// lesson   -> { id, teacherId, studentIds: [..], subject, roomId, kind, day, date, start, minutes, from, until, notes, dates }
//             kind: weekly (כל שבוע ביום day, מ-from עד until) | once (פעם אחת בתאריך date)
//             dates: { 'YYYY-MM-DD': { status: cancelled | attended | absent, note } } – מה קרה בשיעור מסוים
// payment  -> { id, studentId, amount, date, until, method, note }   until = התשלום מכסה עד התאריך הזה
// settings -> { subjects: [..], rooms: [{ id, name }] }

export const LEVELS = ['view', 'edit', 'manage'];
export const DEFAULT_SUBJECTS = ['גיטרה', 'תופים', 'פסנתר', 'שירה ופיתוח קול'];
export const DEFAULT_ROOMS = [
  { id: 'room-1', name: 'חדר 1' },
  { id: 'room-2', name: 'חדר 2' },
  { id: 'room-3', name: 'חדר 3' },
];
export const STATUSES = ['cancelled', 'attended', 'absent'];
export const METHODS = ['מזומן', 'אשראי', 'העברה', 'ביט', 'צ׳ק', 'אחר'];
export const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const MAX_PHOTO = 60000;

const ID_RE = /^[\w-]{4,40}$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

export const text = (s, max = 80) =>
  String(s ?? '')
    .replace(/[\u0000-\u0008\u000b-\u001f]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);
const line = (s, max) => text(s, max).replace(/\n/g, ' ');
const date = (s) => (DATE_RE.test(String(s ?? '')) ? String(s) : '');
const num = (n, min, max) => {
  const x = Math.round(Number(n));
  return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : min;
};
export const isId = (s) => ID_RE.test(String(s ?? ''));
export const isDate = (s) => DATE_RE.test(String(s ?? ''));

function need(cond, msg) {
  if (!cond) throw Object.assign(new Error(msg), { status: 400 });
}

export function cleanTeacher(t) {
  need(isId(t?.id), 'מזהה לא תקין');
  const out = {
    id: t.id,
    first: line(t.first, 40),
    last: line(t.last, 40),
    phone: line(t.phone, 20),
    email: line(t.email, 80),
    subjects: [...new Set((Array.isArray(t.subjects) ? t.subjects : []).map((s) => line(s, 40)).filter(Boolean))].slice(0, 12),
    color: COLOR_RE.test(t.color) ? t.color : '#f5b800',
    notes: text(t.notes, 1000),
    level: LEVELS.includes(t.level) ? t.level : 'view',
  };
  need(out.first, 'חסר שם פרטי');
  return out;
}

// תמונה: '' = למחוק, undefined = לא לגעת
export function cleanPhoto(p) {
  if (p === undefined || p === null) return undefined;
  if (p === '') return '';
  need(typeof p === 'string' && p.length <= MAX_PHOTO && PHOTO_RE.test(p), 'התמונה לא תקינה או גדולה מדי');
  return p;
}

export function cleanStudent(s) {
  need(isId(s?.id), 'מזהה לא תקין');
  const out = {
    id: s.id,
    first: line(s.first, 40),
    last: line(s.last, 40),
    phone: line(s.phone, 20),
    address: line(s.address, 120),
    contactName: line(s.contactName, 60),
    contactPhone: line(s.contactPhone, 20),
    birth: date(s.birth),
    fee: s.fee === '' || s.fee == null ? null : num(s.fee, 0, 100000),
    notes: text(s.notes, 1000),
    active: s.active !== false,
  };
  need(out.first, 'חסר שם פרטי');
  return out;
}

export function cleanLesson(l, { teachers, students, settings }) {
  need(isId(l?.id), 'מזהה לא תקין');
  need(teachers.some((t) => t.id === l.teacherId), 'צריך לבחור מורה');
  const studentIds = [...new Set(Array.isArray(l.studentIds) ? l.studentIds : [])].filter((id) => students.some((s) => s.id === id)).slice(0, 12);
  need(studentIds.length, 'צריך לבחור תלמיד');
  const kind = l.kind === 'once' ? 'once' : 'weekly';
  const out = {
    id: l.id,
    teacherId: l.teacherId,
    studentIds,
    subject: line(l.subject, 40),
    roomId: settings.rooms.some((r) => r.id === l.roomId) ? l.roomId : '',
    kind,
    day: kind === 'weekly' ? num(l.day, 0, 6) : null,
    date: kind === 'once' ? date(l.date) : '',
    start: TIME_RE.test(l.start) ? l.start : '',
    minutes: num(l.minutes || 45, 10, 300),
    from: kind === 'weekly' ? date(l.from) : '',
    until: kind === 'weekly' ? date(l.until) : '',
    notes: text(l.notes, 1000),
  };
  need(out.start, 'צריך לבחור שעה');
  need(kind === 'weekly' || out.date, 'צריך לבחור תאריך');
  need(!out.until || !out.from || out.until >= out.from, 'תאריך הסיום לפני תאריך ההתחלה');
  return out;
}

export function cleanOccurrence(o) {
  need(isDate(o?.date), 'תאריך לא תקין');
  const status = STATUSES.includes(o.status) ? o.status : '';
  return { date: o.date, status, note: text(o.note, 300) };
}

export function cleanPayment(p, { students }) {
  need(isId(p?.id), 'מזהה לא תקין');
  need(students.some((s) => s.id === p.studentId), 'צריך לבחור תלמיד');
  const out = {
    id: p.id,
    studentId: p.studentId,
    amount: num(p.amount, 0, 1000000),
    date: date(p.date),
    until: date(p.until),
    method: METHODS.includes(p.method) ? p.method : 'אחר',
    note: text(p.note, 300),
  };
  need(out.date, 'חסר תאריך תשלום');
  return out;
}

export function cleanSettings(s, old) {
  const subjects = [...new Set((Array.isArray(s?.subjects) ? s.subjects : old.subjects).map((x) => line(x, 40)).filter(Boolean))].slice(0, 40);
  const rooms = (Array.isArray(s?.rooms) ? s.rooms : old.rooms)
    .filter((r) => isId(r?.id))
    .map((r) => ({ id: r.id, name: line(r.name, 40) || 'חדר' }))
    .slice(0, 40);
  need(subjects.length, 'צריך לפחות נושא אחד');
  need(rooms.length, 'צריך לפחות חדר אחד');
  return { subjects, rooms };
}

// מי מחובר: { role: 'admin' } או { role: 'teacher', id, level }
export const isManager = (me) => me.role === 'admin' || me.level === 'manage';
export const canEdit = (me) => isManager(me) || me.level === 'edit';

export const fullName = (p) => [p?.first, p?.last].filter(Boolean).join(' ') || '?';

// תיאור קצר של שיעור להתראות: "גיטרה – דני כהן, יום שני 16:00"
export function describeLesson(l, students) {
  const names = (l.studentIds || []).map((id) => fullName(students.find((s) => s.id === id))).join(', ');
  const when = l.kind === 'once' ? `${l.date.split('-').reverse().join('/')} ${l.start}` : `יום ${DAYS[l.day]} ${l.start}`;
  return `${l.subject ? `${l.subject} – ` : ''}${names}, ${when}`;
}
