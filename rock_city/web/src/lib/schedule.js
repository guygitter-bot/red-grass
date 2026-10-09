// תאריכים, שיעורים, התנגשויות ותשלומים. תאריך = מחרוזת 'YYYY-MM-DD' לפי השעון המקומי.

export const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const SHORT_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
export const LEVELS = {
  view: 'צפייה בלבד',
  edit: 'עריכת השיעורים שלו',
  manage: 'ניהול מלא',
};
export const LEVEL_HELP = {
  view: 'רואה את מערכת השעות, התלמידים והמורים. לא יכול לשנות כלום (אבל יכול לאשר בקשות על השיעורים שלו).',
  edit: 'משנה את השיעורים שלו ומסמן נוכחות. שינוי בשיעור של מורה אחר נשלח אליו כבקשה.',
  manage: 'כמו מנהל: כל השיעורים, תלמידים, תשלומים, חדרים ונושאים. (רק המנהל נותן הרשאות.)',
};
export const STATUS = {
  attended: { label: 'הגיע', icon: '✅' },
  absent: { label: 'לא הגיע', icon: '❌' },
  cancelled: { label: 'בוטל', icon: '🚫' },
};
export const METHODS = ['מזומן', 'אשראי', 'העברה', 'ביט', 'צ׳ק', 'אחר'];
export const COLORS = ['#f5b800', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#6366f1', '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16', '#78716c', '#334155'];

const pad = (n) => String(n).padStart(2, '0');
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// בצהריים – כדי ששעון קיץ לא יזיז יום
export const fromKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
export const today = () => toKey(new Date());
export const addDays = (k, n) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
};
export const addMonths = (k, n) => {
  const d = fromKey(k);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return toKey(d);
};
export const dayOf = (k) => fromKey(k).getDay();
export const weekStart = (k) => addDays(k, -dayOf(k));
export const daysBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 86400000);
export const showDate = (k) => (k ? k.split('-').reverse().join('/') : '');
export const shortDate = (k) => (k ? `${Number(k.slice(8))}/${Number(k.slice(5, 7))}` : '');

export const toMinutes = (t) => {
  const [h, m] = (t || '0:0').split(':').map(Number);
  return h * 60 + m;
};
export const fromMinutes = (n) => `${pad(Math.floor(n / 60) % 24)}:${pad(n % 60)}`;
export const endTime = (l) => fromMinutes(toMinutes(l.start) + (l.minutes || 45));

export const fullName = (p) => [p?.first, p?.last].filter(Boolean).join(' ') || '?';

// האם השיעור מתקיים בתאריך הזה (לפי ההגדרה – לפני ביטולים)
export function occursOn(l, k) {
  if (l.kind === 'once') return l.date === k;
  return l.day === dayOf(k) && (!l.from || k >= l.from) && (!l.until || k <= l.until);
}

export const statusOn = (l, k) => l.dates?.[k]?.status || '';

export function lessonsOn(lessons, k) {
  return lessons.filter((l) => occursOn(l, k)).sort((a, b) => a.start.localeCompare(b.start));
}

// "כל יום שני, 16:00 עד 16:45" / "שני 12/10/2026, 16:00 עד 16:45"
export function whenText(l) {
  const hours = `${l.start} עד ${endTime(l)}`;
  if (l.kind === 'once') return `${DAYS[dayOf(l.date)]} ${showDate(l.date)}, ${hours}`;
  return `כל יום ${DAYS[l.day]}, ${hours}`;
}

export function describeLesson(l, students) {
  const names = (l.studentIds || []).map((id) => fullName(students.find((s) => s.id === id))).join(', ');
  return `${l.subject ? `${l.subject} – ` : ''}${names}, ${whenText(l)}`;
}

// התאריכים הקרובים שבהם השיעור מתקיים (לבדיקת התנגשויות)
export function nextDates(l, from = today(), count = 12) {
  if (l.kind === 'once') return l.date ? [l.date] : [];
  const out = [];
  let k = l.from && l.from > from ? l.from : from;
  k = addDays(k, (l.day - dayOf(k) + 7) % 7);
  while (out.length < count && (!l.until || k <= l.until)) {
    out.push(k);
    k = addDays(k, 7);
  }
  return out;
}

// התנגשויות של שיעור (חדש או אחרי שינוי) עם שיעורים אחרים: אותו חדר, אותו מורה או אותו תלמיד באותה שעה
export function conflicts(lesson, lessons, { students = [], teachers = [], rooms = [], from = today() } = {}) {
  const a1 = toMinutes(lesson.start);
  const a2 = a1 + (lesson.minutes || 45);
  const found = new Map();
  for (const k of nextDates(lesson, from)) {
    for (const o of lessons) {
      if (o.id === lesson.id || found.has(o.id) || !occursOn(o, k) || statusOn(o, k) === 'cancelled') continue;
      const b1 = toMinutes(o.start);
      const b2 = b1 + (o.minutes || 45);
      if (a1 >= b2 || b1 >= a2) continue;
      const why = [];
      if (lesson.roomId && o.roomId === lesson.roomId) why.push(`${rooms.find((r) => r.id === o.roomId)?.name || 'החדר'} תפוס`);
      if (o.teacherId === lesson.teacherId) why.push(`ל${fullName(teachers.find((t) => t.id === o.teacherId))} יש שיעור אחר`);
      const both = o.studentIds.filter((id) => lesson.studentIds.includes(id));
      for (const id of both) why.push(`ל${fullName(students.find((s) => s.id === id))} יש שיעור אחר`);
      if (why.length) found.set(o.id, { lesson: o, date: k, why });
    }
  }
  return [...found.values()];
}

// מצב התשלום של תלמיד: עד מתי שילם, כמה ימים נשארו, והתשלום האחרון
export function paymentStatus(studentId, payments, now = today()) {
  const mine = payments.filter((p) => p.studentId === studentId).sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  const last = mine[0] || null;
  const paidUntil = mine.reduce((max, p) => (p.until && p.until > max ? p.until : max), '');
  if (!paidUntil) return { state: last ? 'ok' : 'none', last, paidUntil: '', daysLeft: null, payments: mine };
  const daysLeft = daysBetween(now, paidUntil);
  const state = daysLeft < 0 ? 'late' : daysLeft <= 7 ? 'soon' : 'ok';
  return { state, last, paidUntil, daysLeft, payments: mine };
}

export const PAY_STATE = {
  late: { label: 'לא שולם', dot: 'bg-danger', text: 'text-danger' },
  soon: { label: 'תשלום בקרוב', dot: 'bg-orange', text: 'text-orange' },
  ok: { label: 'שולם', dot: 'bg-ok', text: 'text-ok' },
  none: { label: 'אין תשלום', dot: 'bg-muted', text: 'text-muted' },
};

export function payText(st) {
  if (st.state === 'none') return 'עוד לא נרשם תשלום';
  if (!st.paidUntil) return `שולם ₪${st.last.amount} ב־${showDate(st.last.date)}`;
  if (st.daysLeft < 0) return `התשלום הבא היה צריך להגיע לפני ${-st.daysLeft} ימים (${showDate(st.paidUntil)})`;
  if (st.daysLeft === 0) return 'התשלום הבא – היום';
  return `התשלום הבא בעוד ${st.daysLeft} ימים (${showDate(st.paidUntil)})`;
}

// טלפון ישראלי -> קישור וואטסאפ
export function whatsapp(phone, msg = '') {
  let p = String(phone || '').replace(/\D/g, '');
  if (!p) return '';
  if (p.startsWith('0')) p = `972${p.slice(1)}`;
  return `https://wa.me/${p}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
}

export const newId = (prefix) => `${prefix}-${crypto.randomUUID().slice(0, 13)}`;
