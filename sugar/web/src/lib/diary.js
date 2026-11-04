// החישובים של יומן הסוכר – פונקציות טהורות (בלי React), עם בדיקות ב-diary.test.js.
//
// רשומות (כולן עם id ו-updatedAt, ומסתנכרנות בין כל המכשירים של כל מי שמשתף):
//   settings – { id: 'settings', t: 'settings', person, low, high, icr, cf, target }
//              טווח יעד (mg/dL), ואם הצוות נתן: יחס פחמימות (גרם ליחידה), פקטור תיקון (כמה יחידה מורידה) ויעד לתיקון
//   template – ארוחה קבועה בתפריט: { t: 'template', name, slot, time: 'HH:MM', food, portion, carbs, dose, days: [0-6] (ריק = כל יום), archived }
//   meal     – ארוחה ביום: { t: 'meal', date: 'YYYY-MM-DD', time, templateId, name, slot, food, portion, carbs,
//              before (סוכר לפני), insulin (יחידות), readings: [{ time, value }] (מדידות אחרי), tags: [], note, by }
//   reading  – מדידה בלי ארוחה (בוקר, לילה, ספורט): { t: 'reading', date, time, value, note, by }
//   chat     – הודעה בשיחה עם ה-AI (משותפת לכולם): { t: 'chat', role: 'user' | 'assistant', text, at, by }
// רשומה ישנה בלי שדה מסוים מקבלת ברירת מחדל (safeMeal, safeTemplate, safeSettings).

export const SLOTS = {
  breakfast: 'בוקר',
  ten: 'עשר',
  lunch: 'צהריים',
  four: 'ארבע',
  dinner: 'ערב',
  night: 'לילה',
  other: 'אחר',
};
const SLOT_TIMES = { breakfast: '07:30', ten: '10:00', lunch: '13:00', four: '16:00', dinner: '19:00', night: '21:30', other: '12:00' };

export const TAGS = {
  sport: '🏃 ספורט',
  sick: '🤒 חולה',
  stress: '😟 לחץ',
  fat: '🍕 שומני',
  late: '⏰ אינסולין באיחור',
  hypo: '🍬 טיפול בהיפו',
  party: '🎉 אירוע',
};

export const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const isTime = (t) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

// מספר או ריק ('' = לא נרשם). "1,5" נקרא כ-1.5
export function numOrEmpty(v) {
  if (v === '' || v == null) return '';
  const n = Number(String(v).replace(',', '.').trim());
  return Number.isFinite(n) ? n : '';
}

export function today(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function nowTime(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  return today(new Date(y, m - 1, d + n));
}

export function weekday(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function dayLabel(date, base = today()) {
  if (date === base) return 'היום';
  if (date === addDays(base, -1)) return 'אתמול';
  if (date === addDays(base, 1)) return 'מחר';
  const [y, m, d] = date.split('-').map(Number);
  return `יום ${DAY_NAMES[weekday(date)]}, ${d}.${m}${y !== Number(base.slice(0, 4)) ? `.${y}` : ''}`;
}

export const minutes = (t) => (isTime(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : 0);

export function safeSettings(r = {}) {
  const low = numOrEmpty(r.low);
  const high = numOrEmpty(r.high);
  return {
    id: 'settings',
    t: 'settings',
    person: typeof r.person === 'string' ? r.person : '',
    low: low === '' ? 70 : low,
    high: high === '' ? 180 : high,
    icr: numOrEmpty(r.icr),
    cf: numOrEmpty(r.cf),
    target: numOrEmpty(r.target),
    note: typeof r.note === 'string' ? r.note : '',
  };
}

export function safeTemplate(r) {
  const slot = SLOTS[r.slot] ? r.slot : 'other';
  return {
    ...r,
    name: String(r.name || 'ארוחה'),
    slot,
    time: isTime(r.time) ? r.time : SLOT_TIMES[slot],
    food: String(r.food || ''),
    portion: numOrEmpty(r.portion) === '' ? 1 : numOrEmpty(r.portion),
    carbs: numOrEmpty(r.carbs),
    dose: numOrEmpty(r.dose),
    days: Array.isArray(r.days) ? r.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [],
    archived: !!r.archived,
  };
}

export function safeReadingList(list) {
  return (Array.isArray(list) ? list : [])
    .map((x) => ({ time: isTime(x?.time) ? x.time : '', value: numOrEmpty(x?.value) }))
    .filter((x) => x.time && x.value !== '');
}

export function safeMeal(r) {
  const slot = SLOTS[r.slot] ? r.slot : 'other';
  return {
    ...r,
    date: isDate(r.date) ? r.date : today(),
    time: isTime(r.time) ? r.time : SLOT_TIMES[slot],
    templateId: r.templateId || '',
    name: String(r.name || 'ארוחה'),
    slot,
    food: String(r.food || ''),
    portion: numOrEmpty(r.portion) === '' ? 1 : numOrEmpty(r.portion),
    carbs: numOrEmpty(r.carbs),
    before: numOrEmpty(r.before),
    insulin: numOrEmpty(r.insulin),
    readings: safeReadingList(r.readings),
    tags: Array.isArray(r.tags) ? r.tags.filter((x) => TAGS[x]) : [],
    note: String(r.note || ''),
    by: String(r.by || ''),
  };
}

export function safeReading(r) {
  return { ...r, date: isDate(r.date) ? r.date : today(), time: isTime(r.time) ? r.time : '00:00', value: numOrEmpty(r.value), note: String(r.note || ''), by: String(r.by || '') };
}

const byTime = (a, b) => (a.date === b.date ? minutes(a.time) - minutes(b.time) : a.date < b.date ? -1 : 1);

// כל הרשומות → מבנה נוח למסכים
export function prepare(records) {
  const live = records.filter((r) => r && !r.deleted);
  const settings = safeSettings(live.find((r) => r.t === 'settings'));
  const templates = live
    .filter((r) => r.t === 'template')
    .map(safeTemplate)
    .sort((a, b) => minutes(a.time) - minutes(b.time) || a.name.localeCompare(b.name, 'he'));
  const meals = live.filter((r) => r.t === 'meal').map(safeMeal).sort(byTime);
  const readings = live
    .filter((r) => r.t === 'reading')
    .map(safeReading)
    .filter((r) => r.value !== '')
    .sort(byTime);
  const chats = live.filter((r) => r.t === 'chat' && r.text).sort((a, b) => (a.at || 0) - (b.at || 0));
  return { settings, templates, meals, readings, chats };
}

// רמת הסוכר: low (מתחת לטווח), ok, high (מעל), veryHigh (מעל 250)
export function level(value, settings) {
  if (value === '' || value == null) return '';
  if (value < settings.low) return 'low';
  if (value > 250 && settings.high < 250) return 'veryHigh';
  if (value > settings.high) return 'high';
  return 'ok';
}

export const LEVEL_TEXT = { low: 'נמוך', ok: 'בטווח', high: 'גבוה', veryHigh: 'גבוה מאוד' };

// כמה דקות אחרי הארוחה נמדד (מדידה אחרי חצות של ארוחת ערב = היום הבא)
export function minutesAfter(mealTime, readingTime) {
  let diff = minutes(readingTime) - minutes(mealTime);
  if (diff < -60) diff += 24 * 60;
  return diff;
}

// מה קרה אחרי הארוחה: המדידה הקרובה ל-2 שעות (בין 90 ל-180 דקות), השיא, הנמוך, ושינוי מלפני
export function outcome(meal) {
  const after = meal.readings.map((r) => ({ ...r, mins: minutesAfter(meal.time, r.time) })).filter((r) => r.mins > 0 && r.mins <= 6 * 60);
  const near2h = after.filter((r) => r.mins >= 90 && r.mins <= 180).sort((a, b) => Math.abs(a.mins - 120) - Math.abs(b.mins - 120))[0];
  const peak = after.length ? after.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const lowest = after.length ? after.reduce((a, b) => (b.value < a.value ? b : a)) : null;
  const last = after.length ? after.reduce((a, b) => (b.mins > a.mins ? b : a)) : null;
  const after2h = near2h ? near2h.value : '';
  return {
    after: after.sort((a, b) => a.mins - b.mins),
    after2h,
    peak: peak ? peak.value : '',
    lowest: lowest ? lowest.value : '',
    last: last ? last.value : '',
    rise: after2h !== '' && meal.before !== '' ? after2h - meal.before : '',
  };
}

// הארוחות הקודמות מאותו סוג (אותה ארוחה קבועה, או אותו שם) – הכי חדשות קודם
export function similarMeals(data, meal, limit = 30) {
  const name = meal.name.trim();
  return data.meals
    .filter((m) => m.id !== meal.id && ((meal.templateId && m.templateId === meal.templateId) || (!meal.templateId && name && m.name.trim() === name)))
    .filter((m) => m.date < meal.date || (m.date === meal.date && minutes(m.time) < minutes(meal.time)))
    .reverse()
    .slice(0, limit);
}

const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : '');
const round = (v, d = 0) => (v === '' ? '' : Math.round(v * 10 ** d) / 10 ** d);

// דפוס לכל ארוחה: כמה פעמים, ממוצע מנה/אינסולין/לפני/אחרי שעתיים, כמה הסתיימו בטווח, ומה עבד הכי טוב
export function pattern(data, list) {
  const s = data.settings;
  const rows = list.map((m) => ({ m, o: outcome(m) }));
  const withAfter = rows.filter((r) => r.o.after2h !== '');
  const inRange = withAfter.filter((r) => level(r.o.after2h, s) === 'ok');
  const lows = rows.filter((r) => r.o.lowest !== '' && r.o.lowest < s.low);
  const doses = rows.map((r) => r.m.insulin).filter((x) => x !== '');
  const perPortion = rows.filter((r) => r.m.insulin !== '' && r.m.portion > 0).map((r) => r.m.insulin / r.m.portion);
  // מה עבד: ארוחות שהסתיימו בטווח בלי נפילה – לפי מנה ואינסולין
  const good = inRange.filter((r) => !(r.o.lowest !== '' && r.o.lowest < s.low)).map((r) => r.m);
  return {
    count: rows.length,
    measured: withAfter.length,
    inRange: inRange.length,
    lows: lows.length,
    portion: round(avg(rows.map((r) => r.m.portion)), 1),
    dose: round(avg(doses), 1),
    dosePerPortion: round(avg(perPortion), 1),
    before: round(avg(rows.map((r) => r.m.before).filter((x) => x !== ''))),
    after2h: round(avg(withAfter.map((r) => r.o.after2h))),
    rise: round(avg(withAfter.map((r) => r.o.rise).filter((x) => x !== ''))),
    good,
  };
}

// לכל ארוחה קבועה (ולארוחות בלי תבנית – לפי שם): הדפוס ב-N הימים האחרונים
export function patternsByMeal(data, days = 30, base = today()) {
  const from = addDays(base, -days + 1);
  const recent = data.meals.filter((m) => m.date >= from && m.date <= base);
  const groups = new Map();
  for (const m of recent) {
    const key = m.templateId || `name:${m.name.trim()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const tpl = data.templates.find((t) => t.id === key);
      return { key, name: tpl?.name || list[list.length - 1].name, slot: tpl?.slot || list[0].slot, list, ...pattern(data, list) };
    })
    .sort((a, b) => b.count - a.count);
}

// כל המדידות (לפני ארוחה, אחרי ארוחה, ובנפרד) – לגרף היומי ולסטטיסטיקה
export function allPoints(data, from = '0000-00-00', to = '9999-99-99') {
  const pts = [];
  for (const m of data.meals) {
    if (m.date < from || m.date > to) continue;
    if (m.before !== '') pts.push({ date: m.date, time: m.time, value: m.before, kind: 'before', meal: m });
    for (const r of m.readings) {
      const mins = minutesAfter(m.time, r.time);
      // מדידה אחרי חצות של ארוחת ערב שייכת ליום הבא
      const date = minutes(r.time) < minutes(m.time) && mins > 0 ? addDays(m.date, 1) : m.date;
      pts.push({ date, time: r.time, value: r.value, kind: 'after', meal: m });
    }
  }
  for (const r of data.readings) if (r.date >= from && r.date <= to) pts.push({ date: r.date, time: r.time, value: r.value, kind: 'reading', reading: r });
  return pts.filter((p) => p.date >= from && p.date <= to).sort(byTime);
}

// סטטיסטיקה לתקופה: ממוצע, אחוז בטווח, נמוכים/גבוהים, ו-GMI (הערכה של המוגלובין מסוכרר לפי הממוצע – הערכה בלבד)
export function stats(data, days = 14, base = today()) {
  const s = data.settings;
  const pts = allPoints(data, addDays(base, -days + 1), base);
  const values = pts.map((p) => p.value);
  const count = (lv) => pts.filter((p) => level(p.value, s) === lv).length;
  const mean = avg(values);
  const sd = values.length > 1 ? Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1)) : '';
  return {
    count: values.length,
    mean: round(mean),
    sd: round(sd),
    inRange: values.length ? Math.round((count('ok') / values.length) * 100) : '',
    low: count('low'),
    high: count('high') + count('veryHigh'),
    veryHigh: count('veryHigh'),
    gmi: mean === '' ? '' : round(3.31 + 0.02392 * mean, 1),
    min: values.length ? Math.min(...values) : '',
    max: values.length ? Math.max(...values) : '',
  };
}

// לפי שעות היום: ממוצע בכל חלק של היום (לראות איפה בעיקר גבוה/נמוך)
export function byDayPart(data, days = 14, base = today()) {
  const parts = [
    ['לילה (0-6)', 0, 6],
    ['בוקר (6-11)', 6, 11],
    ['צהריים (11-16)', 11, 16],
    ['אחה״צ (16-19)', 16, 19],
    ['ערב (19-24)', 19, 24],
  ];
  const pts = allPoints(data, addDays(base, -days + 1), base);
  return parts.map(([label, a, b]) => {
    const vals = pts.filter((p) => minutes(p.time) >= a * 60 && minutes(p.time) < b * 60).map((p) => p.value);
    return { label, count: vals.length, mean: round(avg(vals)), low: vals.filter((v) => v < data.settings.low).length };
  });
}

// הארוחות הקבועות של יום מסוים שעוד לא נוספו אליו
export function missingFixed(data, date) {
  const wd = weekday(date);
  const have = new Set(data.meals.filter((m) => m.date === date).map((m) => m.templateId));
  return data.templates.filter((t) => !t.archived && (!t.days.length || t.days.includes(wd)) && !have.has(t.id));
}

// ארוחה חדשה מארוחה קבועה
export function mealFromTemplate(t, date) {
  return { t: 'meal', date, time: t.time, templateId: t.id, name: t.name, slot: t.slot, food: t.food, portion: t.portion, carbs: t.carbs, before: '', insulin: '', readings: [], tags: [], note: '' };
}

// חישוב לפי ההגדרות שהצוות נתן (יחס פחמימות + פקטור תיקון). רק כשיש את הנתונים – ומוצג כ"חישוב", לא הוראה
export function suggestByRatio(settings, carbs, before) {
  if (settings.icr === '' || !(settings.icr > 0) || carbs === '' || carbs < 0) return null;
  const food = carbs / settings.icr;
  let correction = 0;
  if (settings.cf > 0 && settings.target !== '' && before !== '' && before > settings.target) correction = (before - settings.target) / settings.cf;
  return { food: round(food, 1), correction: round(correction, 1), total: round(food + correction, 1) };
}

// ארוחות של היום שקיבלו אינסולין ועבר זמן – אבל אין מדידה שעתיים אחרי (תזכורת במסך)
export function waitingForCheck(data, date = today(), time = nowTime()) {
  return data.meals.filter((m) => {
    if (m.date !== date || m.insulin === '') return false;
    const passed = minutes(time) - minutes(m.time);
    if (passed < 110 || passed > 5 * 60) return false;
    return !m.readings.some((r) => minutesAfter(m.time, r.time) >= 90);
  });
}

const fmt = (v) => (v === '' ? '?' : String(v));

// סיכום טקסט של היומן ל-AI: הגדרות, סטטיסטיקה, דפוס לכל ארוחה ופירוט מלא של הימים האחרונים
export function aiContext(data, base = today(), detailDays = 21) {
  const s = data.settings;
  const lines = [];
  lines.push(`היום: ${base} (${dayLabel(base, base)})`);
  lines.push(`הגדרות: ${s.person ? `שם: ${s.person}. ` : ''}טווח יעד ${s.low}-${s.high} mg/dL.` + (s.icr !== '' ? ` יחס פחמימות (לפי הצוות): ${s.icr} גרם ליחידה.` : '') + (s.cf !== '' ? ` פקטור תיקון: יחידה מורידה ${s.cf}.` : '') + (s.target !== '' ? ` יעד לתיקון: ${s.target}.` : ''));
  if (s.note) lines.push(`הערות קבועות: ${s.note}`);
  for (const d of [7, 30]) {
    const st = stats(data, d, base);
    if (st.count) lines.push(`${d} ימים אחרונים: ${st.count} מדידות, ממוצע ${st.mean}, סטיית תקן ${st.sd}, בטווח ${st.inRange}%, נמוכים ${st.low}, גבוהים ${st.high} (מעל 250: ${st.veryHigh}), טווח ${st.min}-${st.max}.`);
  }
  const parts = byDayPart(data, 30, base).filter((p) => p.count);
  if (parts.length) lines.push(`ממוצע לפי שעות (30 יום): ${parts.map((p) => `${p.label}: ${p.mean} (${p.count} מדידות${p.low ? `, ${p.low} נמוכים` : ''})`).join('; ')}`);
  if (data.templates.length) {
    lines.push('\nהתפריט הקבוע:');
    for (const t of data.templates.filter((x) => !x.archived)) lines.push(`- ${t.name} (${SLOTS[t.slot]}, ${t.time}): ${t.food || 'בלי פירוט'}; מנה רגילה ${t.portion}${t.carbs !== '' ? `, ${t.carbs} גרם פחמימה` : ''}${t.dose !== '' ? `, בדרך כלל ${t.dose} יחידות` : ''}`);
  }
  const pats = patternsByMeal(data, 60, base);
  if (pats.length) {
    lines.push('\nדפוס לכל ארוחה (60 יום):');
    for (const p of pats) lines.push(`- ${p.name}: ${p.count} פעמים, מנה ממוצעת ${fmt(p.portion)}, אינסולין ממוצע ${fmt(p.dose)} (${fmt(p.dosePerPortion)} למנה), לפני ${fmt(p.before)}, אחרי שעתיים ${fmt(p.after2h)} (נמדד ב-${p.measured}, בטווח ${p.inRange}), נפילות מתחת ל-${s.low}: ${p.lows}`);
  }
  lines.push(`\nפירוט ${detailDays} הימים האחרונים (שעה | ארוחה | מנה | פחמימה | סוכר לפני | אינסולין | מדידות אחרי):`);
  const from = addDays(base, -detailDays + 1);
  for (let d = from; d <= base; d = addDays(d, 1)) {
    const meals = data.meals.filter((m) => m.date === d);
    const loose = data.readings.filter((r) => r.date === d);
    if (!meals.length && !loose.length) continue;
    lines.push(`${d} (${DAY_NAMES[weekday(d)]}):`);
    for (const m of meals) {
      const after = outcome(m).after.map((r) => `${r.time}=${r.value} (+${r.mins} דק׳)`).join(', ');
      lines.push(`  ${m.time} | ${m.name}${m.food ? ` (${m.food})` : ''} | ${m.portion} | ${fmt(m.carbs)} | ${fmt(m.before)} | ${fmt(m.insulin)} | ${after || 'אין'}${m.tags.length ? ` | ${m.tags.map((x) => TAGS[x]).join(' ')}` : ''}${m.note ? ` | הערה: ${m.note}` : ''}`);
    }
    for (const r of loose) lines.push(`  ${r.time} | מדידה ${r.value}${r.note ? ` (${r.note})` : ''}`);
  }
  return lines.join('\n');
}

// ייצוא לאקסל (CSV) – לרופא/ה או לדיאטנית
export function toCsv(data) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['תאריך', 'שעה', 'סוג', 'ארוחה', 'מה אכל', 'מנה', 'פחמימה (גרם)', 'סוכר לפני', 'אינסולין', 'מדידות אחרי', 'אחרי שעתיים', 'שיא', 'סימונים', 'הערה', 'נרשם ע״י']];
  const all = [...data.meals.map((m) => ({ ...m, kind: 'meal' })), ...data.readings.map((r) => ({ ...r, kind: 'reading' }))].sort(byTime);
  for (const x of all) {
    if (x.kind === 'reading') rows.push([x.date, x.time, 'מדידה', '', '', '', '', x.value, '', '', '', '', '', x.note, x.by]);
    else {
      const o = outcome(x);
      rows.push([x.date, x.time, 'ארוחה', x.name, x.food, x.portion, x.carbs, x.before, x.insulin, o.after.map((r) => `${r.time}: ${r.value}`).join(' · '), o.after2h, o.peak, x.tags.map((t) => TAGS[t]).join(' '), x.note, x.by]);
    }
  }
  return `﻿${rows.map((r) => r.map(q).join(',')).join('\n')}`;
}
