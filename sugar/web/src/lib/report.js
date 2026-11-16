// דוח לתקופה (שבוע עד שנה, או תאריכים חופשיים) – כל הנתונים שהמצגת צריכה, בפונקציות טהורות (בדיקות ב-report.test.js).
// המצגת עצמה: ReportView.jsx (תצוגה במסך + PDF בהדפסה) ו-pptx.js (קובץ PowerPoint). שתיהן מציגות את אותו דוח.
import { SLOTS, addDays, allPoints, byDayPart, insights, level, patternsByMeal, stats } from './diary';

export const PERIODS = [
  [7, 'שבוע'],
  [14, 'שבועיים'],
  [30, 'חודש'],
  [90, '3 חודשים'],
  [180, 'חצי שנה'],
  [365, 'שנה'],
];

// כמה ימים בין שני תאריכים (כולל שניהם)
export function daysBetween(from, to) {
  let n = 1;
  while (n < 4000 && addDays(from, n - 1) < to) n++;
  return n;
}

export const shortDate = (d) => `${Number(d.slice(8))}.${Number(d.slice(5, 7))}`;
export const longDate = (d) => `${Number(d.slice(8))}.${Number(d.slice(5, 7))}.${d.slice(0, 4)}`;

const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : '');
const round = (v, d = 0) => (v === '' ? '' : Math.round(v * 10 ** d) / 10 ** d);

// חלוקה לקבוצות זמן לגרפים: עד חודשיים – יום, עד חצי שנה – שבוע, יותר – חודש
export function buckets(from, to) {
  const days = daysBetween(from, to);
  const size = days <= 62 ? 1 : days <= 200 ? 7 : 0;
  const out = [];
  if (size === 0) {
    let start = from;
    while (start <= to) {
      const [y, m] = start.split('-').map(Number);
      const next = `${m === 12 ? y + 1 : y}-${String((m % 12) + 1).padStart(2, '0')}-01`;
      const end = addDays(next, -1) < to ? addDays(next, -1) : to;
      out.push({ from: start, to: end, label: `${m}.${String(y).slice(2)}` });
      start = next;
    }
    return { unit: 'month', list: out };
  }
  for (let d = from; d <= to; d = addDays(d, size)) {
    const end = addDays(d, size - 1) < to ? addDays(d, size - 1) : to;
    out.push({ from: d, to: end, label: shortDate(d) });
  }
  return { unit: size === 1 ? 'day' : 'week', list: out };
}

// אינסולין ביום: ארוחות + תיקונים במדידות
function insulinOn(data, date) {
  let total = 0;
  for (const m of data.meals) if (m.date === date && m.insulin !== '') total += m.insulin;
  for (const r of data.readings) if (r.date === date && r.insulin !== '' && r.insulin != null) total += r.insulin;
  return total;
}

// שינוי מהתקופה הקודמת: { diff, better } – better לפי הכיוון הטוב של כל מדד
function change(cur, prev, goodDirection) {
  if (cur === '' || prev === '' || cur == null || prev == null) return null;
  const diff = round(cur - prev, 1);
  if (!diff) return { diff: 0, better: null };
  return { diff, better: goodDirection === 0 ? null : (diff > 0) === (goodDirection > 0) };
}

// המסקנות על השינוי בין התקופות, במשפטים
function changeSentences(k, p, s) {
  const out = [];
  if (!p.count) return out;
  if (k.inRange !== '' && p.inRange !== '') {
    const d = k.inRange - p.inRange;
    if (Math.abs(d) >= 3) out.push({ kind: d > 0 ? 'good' : 'high', text: `הזמן בטווח (${s.low}-${s.dayHigh}) ${d > 0 ? 'עלה' : 'ירד'} מ-${p.inRange}% ל-${k.inRange}%.` });
    else out.push({ kind: 'info', text: `הזמן בטווח יציב: ${k.inRange}% (בתקופה הקודמת ${p.inRange}%).` });
  }
  if (k.mean !== '' && p.mean !== '' && Math.abs(k.mean - p.mean) >= 5) out.push({ kind: k.mean < p.mean ? 'good' : 'high', text: `הסוכר הממוצע ${k.mean < p.mean ? 'ירד' : 'עלה'} מ-${p.mean} ל-${k.mean}.` });
  if (k.lowPct !== '' && p.lowPct !== '' && Math.abs(k.lowPct - p.lowPct) >= 1) out.push({ kind: k.lowPct < p.lowPct ? 'good' : 'low', text: `הזמן מתחת ל-${s.low} ${k.lowPct < p.lowPct ? 'ירד' : 'עלה'} מ-${p.lowPct}% ל-${k.lowPct}%.` });
  if (k.sd !== '' && p.sd !== '' && Math.abs(k.sd - p.sd) >= 5) out.push({ kind: k.sd < p.sd ? 'good' : 'info', text: `התנודות (סטיית תקן) ${k.sd < p.sd ? 'קטנו' : 'גדלו'}: ${p.sd} → ${k.sd}.` });
  return out;
}

function kpisFor(data, from, to) {
  const days = daysBetween(from, to);
  const st = stats(data, days, to);
  const meals = data.meals.filter((m) => m.date >= from && m.date <= to);
  let insulin = 0;
  let insulinDays = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const v = insulinOn(data, d);
    if (v > 0) {
      insulin += v;
      insulinDays++;
    }
  }
  return {
    ...st,
    lowPct: st.count ? round((st.low / st.count) * 100, 1) : '',
    highPct: st.count ? round((st.high / st.count) * 100, 1) : '',
    meals: meals.length,
    mealsPerDay: round(meals.length / days, 1),
    insulinPerDay: insulinDays ? round(insulin / insulinDays, 1) : '',
  };
}

export function buildReport(data, from, to) {
  const s = data.settings;
  const days = daysBetween(from, to);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -days + 1);
  const k = kpisFor(data, from, to);
  const p = kpisFor(data, prevFrom, prevTo);

  // מגמה: ממוצע, זמן בטווח ואינסולין לכל קבוצת זמן
  const { unit, list } = buckets(from, to);
  const trend = list.map((b) => {
    const vals = allPoints(data, b.from, b.to).map((x) => x.value);
    const lv = (name) => vals.filter((v) => level(v, s) === name).length;
    let insulin = 0;
    let n = 0;
    for (let d = b.from; d <= b.to; d = addDays(d, 1)) {
      const v = insulinOn(data, d);
      if (v > 0) {
        insulin += v;
        n++;
      }
    }
    return {
      label: b.label,
      count: vals.length,
      mean: vals.length ? Math.round(avg(vals)) : '',
      low: vals.length ? round((lv('low') / vals.length) * 100) : '',
      ok: vals.length ? round((lv('ok') / vals.length) * 100) : '',
      high: vals.length ? round(((lv('high') + lv('veryHigh')) / vals.length) * 100) : '',
      insulin: n ? round(insulin / n, 1) : '',
    };
  });

  const meals = patternsByMeal(data, days, to)
    .slice(0, 8)
    .map((m) => ({ name: m.name, slot: SLOTS[m.slot] || '', count: m.count, portion: m.portion, dose: m.dose, before: m.before, after2h: m.after2h, inRange: m.inRange, measured: m.measured, lows: m.lows }));

  return {
    from,
    to,
    days,
    prev: { from: prevFrom, to: prevTo },
    person: s.person,
    settings: s,
    kpis: k,
    prevKpis: p,
    changes: {
      inRange: change(k.inRange, p.inRange, 1),
      mean: change(k.mean, p.mean, -1),
      lowPct: change(k.lowPct, p.lowPct, -1),
      sd: change(k.sd, p.sd, -1),
      gmi: change(k.gmi, p.gmi, -1),
      insulinPerDay: change(k.insulinPerDay, p.insulinPerDay, 0),
    },
    unit,
    trend,
    dayParts: byDayPart(data, days, to),
    meals,
    findings: [...changeSentences(k, p, s), ...insights(data, Math.max(days, 7), to)],
    sensorDays: [...(data.cgm?.keys() || [])].filter((d) => d >= from && d <= to).length,
  };
}

// טקסט קצר של הדוח ל-AI (סיכום לשקופית האחרונה)
export function reportText(r) {
  const k = r.kpis;
  const p = r.prevKpis;
  const lines = [
    `תקופה: ${longDate(r.from)} עד ${longDate(r.to)} (${r.days} ימים). טווח לאורך היום ${r.settings.low}-${r.settings.dayHigh}, לפני ארוחה ${r.settings.low}-${r.settings.high}.`,
    `מדדים: ${k.count} מדידות (${r.sensorDays} ימים עם חיישן), ממוצע ${k.mean}, בטווח ${k.inRange}%, מתחת לטווח ${k.lowPct}%, מעל ${k.highPct}%, סטיית תקן ${k.sd}, GMI ${k.gmi}%, אינסולין ממוצע ליום ${k.insulinPerDay}, ${k.meals} ארוחות.`,
    p.count ? `התקופה הקודמת (${longDate(r.prev.from)}-${longDate(r.prev.to)}): ממוצע ${p.mean}, בטווח ${p.inRange}%, מתחת ${p.lowPct}%, סטיית תקן ${p.sd}.` : 'אין נתונים לתקופה הקודמת.',
    `לפי שעות: ${r.dayParts.filter((d) => d.count).map((d) => `${d.label} ${d.mean}`).join(', ')}.`,
    `ארוחות: ${r.meals.map((m) => `${m.name} – ${m.count} פעמים, אינסולין ${m.dose || '?'}, שעתיים אחרי ${m.after2h || '?'}`).join('; ')}.`,
    `ממצאים: ${r.findings.map((f) => f.text).join(' ')}`,
  ];
  return lines.join('\n');
}
