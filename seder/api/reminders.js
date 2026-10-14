// מתי יוצאת כל תזכורת – אותו כלל כמו באפליקציה (seder/web/src/lib/store.js → reminderAt):
//   remindTime ("HH:MM") – בשעה שנבחרה, ביום של המשימה
//   בלי שעה למשימה – 9:00 בבוקר של אותו יום
//   עם שעה – remind דקות לפני
//   repeat (כל יום / שבוע / חודש) – אותה תזכורת חוזרת בכל פעם (reminderTimes)
// השעות הן שעון מקומי של המשתמשת (למשל Asia/Jerusalem), והשרת רץ לפי UTC – לכן ההמרה כאן.

// ההפרש (בדקות) בין שעון האזור ל-UTC ברגע נתון, כולל שעון קיץ
function offsetMinutes(utcMs, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

// "2026-10-05" + "07:30" באזור הזמן -> רגע ב-UTC (מילישניות)
export function zonedToUtc(dateKey, time, timeZone) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, h, min);
  let guess = naive - offsetMinutes(naive, timeZone) * 60000;
  guess = naive - offsetMinutes(guess, timeZone) * 60000; // סיבוב שני – למקרה של מעבר שעון
  return guess;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function reminderUtc(task, timeZone) {
  if (!task || task.done || task.remind == null || typeof task.due !== 'string' || !DATE_RE.test(task.due)) return null;
  if (typeof task.remindTime === 'string' && TIME_RE.test(task.remindTime)) return zonedToUtc(task.due, task.remindTime, timeZone);
  if (typeof task.time !== 'string' || !TIME_RE.test(task.time)) return zonedToUtc(task.due, '09:00', timeZone);
  const minutes = Number(task.remind) || 0;
  return zonedToUtc(task.due, task.time, timeZone) - minutes * 60000;
}

// ---- תזכורת חוזרת (repeat: 'daily' / 'weekly' / 'monthly') ----
// אותו כלל כמו באפליקציה (store.js → occurrenceKey): הפעם ה-k אחרי due. בחודשי – אותו יום בחודש,
// וכשאין יום כזה (31 בפברואר) – היום האחרון בחודש
export const REPEATS = ['daily', 'weekly', 'monthly'];
const pad = (n) => String(n).padStart(2, '0');

export function occurrenceKey(dueKey, repeat, k) {
  const [y, m, d] = dueKey.split('-').map(Number);
  if (repeat === 'monthly') {
    const first = new Date(Date.UTC(y, m - 1 + k, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(Math.min(d, last))}`;
  }
  const at = new Date(Date.UTC(y, m - 1, d + k * (repeat === 'weekly' ? 7 : 1)));
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
}

// כל התזכורות שכדאי לשקול עכשיו: במשימה רגילה – אחת. במשימה חוזרת – האחרונה שכבר הגיעה (אם יש) והבאה אחריה
export function reminderTimes(task, timeZone, now = Date.now()) {
  const first = reminderUtc(task, timeZone);
  if (first == null || !REPEATS.includes(task.repeat)) return first == null ? [] : [first];
  const at = (k) => reminderUtc({ ...task, due: occurrenceKey(task.due, task.repeat, k) }, timeZone);
  // קפיצה קרובה למקום (בלי לעבור על שנים של ימים אחד־אחד)
  const days = Math.floor((now - first) / 86400000);
  let k = Math.max(0, task.repeat === 'monthly' ? Math.floor(days / 31) - 1 : Math.floor(days / (task.repeat === 'weekly' ? 7 : 1)) - 1);
  while (k > 0 && at(k) > now) k -= 1;
  while (at(k + 1) <= now) k += 1;
  return at(k) <= now ? [at(k), at(k + 1)] : [at(k)];
}

export function validTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return typeof tz === 'string' && tz.length < 64;
  } catch {
    return false;
  }
}
