// מתי יוצאת כל תזכורת – אותו כלל כמו באפליקציה (seder/web/src/lib/store.js → reminderAt):
//   remindTime ("HH:MM") – בשעה שנבחרה, ביום של המשימה
//   בלי שעה למשימה – 9:00 בבוקר של אותו יום
//   עם שעה – remind דקות לפני
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

export function validTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return typeof tz === 'string' && tz.length < 64;
  } catch {
    return false;
  }
}
