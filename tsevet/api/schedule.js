// משימות קבועות: "כל לילה ב-2:00 – ..." נשלח לבוט (בדרך כלל למנהל) בזמן שנקבע, גם כשהאפליקציה סגורה.
// הזמנים בשעון ישראל (כולל שעון קיץ). השרת מעיר את עצמו בזמן הבא (Durable Object alarm – team.js).
//   schedules -> [{ id, title, text, to, days: [0-6, ראשון=0], time: 'HH:MM', budget, enabled, conv, lastRun, createdAt }]
import { AGENT_KEYS } from './agents.js';

const TZ = 'Asia/Jerusalem';
export const MAX_SCHEDULES = 20;
export const BUDGETS = [0.5, 1, 2, 5];
export const DEFAULT_BUDGET = 2;
const DAY = 24 * 60 * 60 * 1000;

const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// הזמן בישראל של רגע מסוים
export function israelParts(ms) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, wd: WEEKDAYS[p.weekday], hh: +p.hour % 24, mm: +p.minute };
}

// שעה בישראל -> הרגע (UTC). שני סבבים מספיקים גם ביום המעבר לשעון קיץ
export function israelToUtc(y, m, d, hh, mm) {
  const want = Date.UTC(y, m - 1, d, hh, mm);
  let t = want;
  for (let i = 0; i < 2; i++) {
    const p = israelParts(t);
    t += want - Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
  }
  return t;
}

// הפעם הבאה אחרי הרגע after (או null אם אין ימים)
export function nextRun(s, after) {
  if (!s?.days?.length) return null;
  const [hh, mm] = String(s.time).split(':').map(Number);
  const start = israelParts(after);
  for (let i = 0; i <= 7; i++) {
    const p = israelParts(Date.UTC(start.y, start.m - 1, start.d, 12) + i * DAY);
    if (!s.days.includes(p.wd)) continue;
    const t = israelToUtc(p.y, p.m, p.d, hh, mm);
    if (t > after) return t;
  }
  return null;
}

// מתי היא צריכה לרוץ עכשיו? (פעם אחת, גם אם השרת "פספס" כמה פעמים)
export const isDue = (s, now) => s.enabled && (nextRun(s, s.lastRun || s.createdAt) ?? Infinity) <= now;

export function nextOf(schedules, now) {
  const times = schedules.filter((s) => s.enabled).map((s) => nextRun(s, Math.max(now, s.lastRun || 0))).filter(Boolean);
  return times.length ? Math.min(...times) : null;
}

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// מה שהאפליקציה שלחה -> משימה קבועה תקינה, או { error }
export function cleanSchedule(input, old = {}) {
  const text = String(input.text ?? old.text ?? '').trim().slice(0, 4000);
  const title = clean(input.title ?? old.title, 60) || clean(text, 40);
  const days = [...new Set((Array.isArray(input.days) ? input.days : old.days || []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  const time = String(input.time ?? old.time ?? '');
  const to = input.to === null || input.to === '' ? null : AGENT_KEYS.includes(input.to) ? input.to : old.to === undefined ? 'manager' : old.to;
  const budget = BUDGETS.includes(Number(input.budget)) ? Number(input.budget) : old.budget || DEFAULT_BUDGET;
  if (text.length < 5) return { error: 'צריך לכתוב מה לעשות' };
  if (!days.length) return { error: 'צריך לבחור לפחות יום אחד' };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: 'שעה לא תקינה' };
  return { ...old, title, text, days, time, to, budget, enabled: input.enabled === undefined ? old.enabled ?? true : Boolean(input.enabled) };
}
