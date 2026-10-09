// שיתוף שיעורים ליומן גוגל: קישור "הוספה ליומן" לשיעור אחד, וקובץ יומן (ics) עם כל השיעורים של מורה או תלמיד
import { endTime, fullName, nextDates, today } from './schedule';

const TZ = 'Asia/Jerusalem';
const stamp = (k, t) => `${k.replace(/-/g, '')}T${t.replace(':', '')}00`;

// הכותרת: למורה – מי התלמידים; לתלמיד – מי המורה
export function eventTitle(l, app, forStudent = false) {
  if (forStudent) return `${l.subject || 'שיעור'} עם ${app.teacherMap[l.teacherId]?.first || 'המורה'} – רוק סיטי`;
  const names = l.studentIds.map((id) => fullName(app.studentMap[id])).join(', ');
  return `${l.subject ? `${l.subject} – ` : ''}${names}`;
}

const place = (l, app) => ['רוק סיטי', app.roomMap[l.roomId]?.name].filter(Boolean).join(' – ');

// התאריך הראשון של השיעור (שבועי – הקרוב מהיום, או מתחילת השיעור אם עוד לא התחיל)
function firstDate(l, date) {
  if (l.kind === 'once') return l.date;
  return date || nextDates(l, l.from && l.from > today() ? l.from : today(), 1)[0] || l.from || today();
}

// קישור שפותח את יומן גוגל עם השיעור מוכן לשמירה (שיעור שבועי – חוזר כל שבוע)
export function gcalLink(l, app, { forStudent = false, date = '' } = {}) {
  const k = firstDate(l, date);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle(l, app, forStudent),
    dates: `${stamp(k, l.start)}/${stamp(k, endTime(l))}`,
    ctz: TZ,
    location: place(l, app),
    details: l.notes || '',
  });
  if (l.kind === 'weekly' && !date) p.set('recur', `RRULE:FREQ=WEEKLY${l.until ? `;UNTIL=${l.until.replace(/-/g, '')}T235959Z` : ''}`);
  return `https://calendar.google.com/calendar/render?${p}`;
}

const esc = (s) => String(s || '').replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

// קובץ יומן עם כל השיעורים (גוגל, אייפון ואאוטלוק יודעים לייבא). שיעורים שבוטלו לא מופיעים בתאריך שלהם
export function icsFile(lessons, app, { forStudent = false, name = 'רוק סיטי' } = {}) {
  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rock City//Schedule//HE', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(name)}`, `X-WR-TIMEZONE:${TZ}`];
  for (const l of lessons) {
    const k = l.kind === 'once' ? l.date : nextDates(l, l.from || today(), 1)[0];
    if (!k) continue;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${l.id}@rock-city`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=${TZ}:${stamp(k, l.start)}`,
      `DTEND;TZID=${TZ}:${stamp(k, endTime(l))}`,
      `SUMMARY:${esc(eventTitle(l, app, forStudent))}`,
      `LOCATION:${esc(place(l, app))}`,
    );
    if (l.notes) lines.push(`DESCRIPTION:${esc(l.notes)}`);
    if (l.kind === 'weekly') {
      lines.push(`RRULE:FREQ=WEEKLY${l.until ? `;UNTIL=${l.until.replace(/-/g, '')}T235959Z` : ''}`);
      const cancelled = Object.entries(l.dates || {}).filter(([, v]) => v.status === 'cancelled').map(([d]) => d);
      if (cancelled.length) lines.push(`EXDATE;TZID=${TZ}:${cancelled.map((d) => stamp(d, l.start)).join(',')}`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// שולחים את הקובץ (שיתוף בטלפון – וואטסאפ, מייל...) או מורידים אותו
export async function shareIcs(text, filename) {
  const file = new File([text], filename, { type: 'text/calendar' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
