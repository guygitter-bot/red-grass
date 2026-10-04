// סנכרון ליומן: קישור "הוסף ליומן גוגל" לכל משימה, וקובץ ‎.ics‎ (יומן אפל / אאוטלוק / גוגל)
// עם תזכורת מובנית – כך שההתראה מגיעה מהיומן של הטלפון גם כשהאפליקציה סגורה.
import { addDays, dueDate, fromKey } from './dates';
import { contactsText, reminderAt } from './store';

const pad = (n) => String(n).padStart(2, '0');

function stamp(d) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function utcStamp(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function dateOnly(key) {
  return key.replace(/-/g, '');
}

function escapeIcs(text) {
  return String(text || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);
}

// שורות ארוכות מקופלות לפי התקן (75 בתים) – בלי לחתוך תו עברי באמצע
function fold(line) {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const parts = [];
  let current = '';
  for (const ch of line) {
    if (bytes.encode(current + ch).length > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function description(task) {
  const lines = [];
  if (task.notes) lines.push(task.notes);
  for (const link of task.links || []) if (!task.notes?.includes(link.url)) lines.push(link.url);
  const people = contactsText(task);
  if (people) lines.push(`לבירור עם: ${people}`);
  return lines.join('\n');
}

function eventLines(task, now) {
  const start = dueDate(task);
  const lines = [
    'BEGIN:VEVENT',
    `UID:${task.id}@seder`,
    `DTSTAMP:${utcStamp(now)}`,
    `SUMMARY:${escapeIcs(task.title)}`,
  ];
  if (task.time) {
    const end = new Date(start.getTime() + (task.duration || 60) * 60000);
    lines.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(task.due)}`, `DTEND;VALUE=DATE:${dateOnly(addDays(task.due, 1))}`);
  }
  const desc = description(task);
  if (desc) lines.push(`DESCRIPTION:${escapeIcs(desc)}`);
  if (task.links?.[0]) lines.push(`URL:${task.links[0].url}`);
  const remindAt = reminderAt(task);
  if (remindAt) {
    // ביחס לתחילת האירוע (בלי שעה: חצות של אותו יום)
    const diff = Math.round((remindAt - (task.time ? start : fromKey(task.due))) / 60000);
    const trigger = diff < 0 ? `-PT${-diff}M` : `PT${diff}M`;
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeIcs(task.title)}`, `TRIGGER:${trigger}`, 'END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines;
}

export function toIcs(tasks, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//seder//tasks//HE', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:סדר'];
  for (const task of tasks) if (task.due) lines.push(...eventLines(task, now));
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

export function googleCalendarUrl(task) {
  const params = new URLSearchParams({ action: 'TEMPLATE', text: task.title });
  if (task.time) {
    const start = dueDate(task);
    const end = new Date(start.getTime() + (task.duration || 60) * 60000);
    params.set('dates', `${stamp(start)}/${stamp(end)}`);
  } else if (task.due) {
    params.set('dates', `${dateOnly(task.due)}/${dateOnly(addDays(task.due, 1))}`);
  }
  const desc = description(task);
  if (desc) params.set('details', desc);
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function downloadIcs(tasks, name = 'seder') {
  const blob = new Blob([toIcs(tasks)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
