// קריאת קובץ ייצוא מ-CareLink של מדטרוניק (דוחות ← ייצוא נתונים CSV) – הכול במכשיר, בלי שרת.
// מבנה הקובץ: כמה שורות פרטים, ואז קטעים שכל אחד מתחיל בשורה "-------,<מערכת>,<Pump/Sensor>,..." ובשורת כותרות
// שמתחילה ב-"Index". המפריד פסיק (או נקודה-פסיק בחלק מהגרסאות). מה שלוקחים:
//   Sensor Glucose (mg/dL) – מדידות החיישן (כל 5 דקות) → רשומת cgm ליום
//   BG Reading (mg/dL)     – מדידה מהאצבע (אם יש) → מדידה רגילה
// שאר העמודות (מנות אינסולין, פחמימות) – כשיגיע קובץ עם עט/משאבה חכמים.

// שורת CSV אחת → שדות (כולל שדות במרכאות)
export function splitLine(line, sep) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

// תאריך מהקובץ → YYYY-MM-DD. "2026/11/04", "2026-11-04", "04/11/2026", "04.11.26"
export function parseDate(s) {
  let m = String(s || '').match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = String(s || '').match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return '';
}

// שעה → דקה ביום
export function parseMinute(s) {
  const m = String(s || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return -1;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v < 1440 ? v : -1;
}

const num = (s) => {
  const n = Number(String(s || '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

// קריאת הקובץ: { days: Map(תאריך → [[דקה, ערך]]), bg: [{date, time, value}], from, to, count }
export function readCarelink(text) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/);
  const days = new Map();
  const bg = [];
  let cols = null;
  let sep = ',';
  for (const line of lines) {
    if (/^Index[,;]/.test(line)) {
      sep = line[5];
      const head = splitLine(line, sep);
      cols = { date: head.indexOf('Date'), time: head.indexOf('Time'), sg: head.indexOf('Sensor Glucose (mg/dL)'), bg: head.indexOf('BG Reading (mg/dL)') };
      continue;
    }
    if (!cols || !line || line.startsWith('-------')) continue;
    const f = splitLine(line, sep);
    const date = parseDate(f[cols.date]);
    const minute = parseMinute(f[cols.time]);
    if (!date || minute < 0) continue;
    const sg = cols.sg >= 0 ? num(f[cols.sg]) : null;
    if (sg && sg < 1000) {
      if (!days.has(date)) days.set(date, new Map());
      days.get(date).set(minute, Math.round(sg));
    }
    const b = cols.bg >= 0 ? num(f[cols.bg]) : null;
    if (b && b < 1000) bg.push({ date, time: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`, value: Math.round(b) });
  }
  if (!cols) throw new Error('הקובץ לא נראה כמו ייצוא מ-CareLink (לא נמצאה שורת כותרות)');
  const out = new Map([...days.entries()].sort().map(([d, m]) => [d, [...m.entries()].sort((a, b) => a[0] - b[0])]));
  const dates = [...out.keys()];
  return { days: out, bg, from: dates[0] || '', to: dates[dates.length - 1] || '', count: [...out.values()].reduce((a, p) => a + p.length, 0) };
}

// מיזוג עם מה שכבר יש ביומן (ייבוא חוזר לא מכפיל): רשומות cgm לשמירה
export function cgmRecords(parsed, existing = new Map()) {
  const recs = [];
  for (const [date, pts] of parsed.days) {
    const merged = new Map(existing.get(date) || []);
    for (const [m, v] of pts) merged.set(m, v);
    recs.push({ id: `cgm:${date}`, t: 'cgm', date, points: [...merged.entries()].sort((a, b) => a[0] - b[0]) });
  }
  return recs;
}
