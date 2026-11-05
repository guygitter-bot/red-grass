// החישובים של יומן הסוכר – פונקציות טהורות (בלי React), עם בדיקות ב-diary.test.js.
//
// רשומות (כולן עם id ו-updatedAt, ומסתנכרנות בין כל המכשירים של כל מי שמשתף):
//   settings – { id: 'settings', t: 'settings', person, low, high, icr, cf, target }
//              טווח יעד לפני ארוחה (mg/dL, ברירת מחדל 70-110), dayHigh – גבול עליון לאורך היום (אחרי ארוחה, חיישן, מעקב;
//              ברירת מחדל 180; הגבול התחתון – low), יחס פחמימות (גרם ליחידה, ברירת מחדל 15),
//              ואם הצוות נתן: פקטור תיקון (כמה יחידה מורידה) ויעד לתיקון
//   food     – פריט בטבלת הפחמימות של המחשבון: { t: 'food', name, unit, carbs (גרם לכל יחידה) }
//              יש רשימה מובנית (DEFAULT_FOODS, מזהים food:*); עריכה נשמרת כרשומה עם אותו מזהה, ומחיקה = deleted
//   template – ארוחה קבועה בתפריט: { t: 'template', name, slot, time: 'HH:MM', food, portion, carbs, dose, days: [0-6] (ריק = כל יום), archived }
//   meal     – ארוחה ביום: { t: 'meal', date: 'YYYY-MM-DD', time, templateId, name, slot, food, portion, carbs,
//              items: [{ foodId, name, qty, carbs }] (מה נבחר במחשבון), site (מיקום הזריקה, SITES),
//              before (סוכר לפני), insulin (יחידות), readings: [{ time, value }] (מדידות אחרי), tags: [], note, by }
//   reading  – מדידה בלי ארוחה (בוקר, לילה, ספורט): { t: 'reading', date, time, value, note, by }
//   cgm      – מדידות החיישן ליום אחד (מיובא מקובץ CareLink, ראו carelink.js): { id: 'cgm:YYYY-MM-DD', t: 'cgm', date,
//              points: [[דקה ביום, ערך], ...] } – רשומה אחת ליום (כ-288 מדידות), כדי שלא יהיו עשרות אלפי רשומות
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

// מיקום הזריקה
export const SITES = {
  bellyR: 'בטן ימין',
  bellyL: 'בטן שמאל',
  armR: 'יד ימין',
  armL: 'יד שמאל',
  legR: 'רגל ימין',
  legL: 'רגל שמאל',
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
    high: high === '' ? 110 : high,
    // לאורך היום (אחרי אוכל, חיישן, אחוז בטווח) – עד 180 אם לא נקבע אחרת
    dayHigh: numOrEmpty(r.dayHigh) === '' ? Math.max(180, high === '' ? 110 : high) : numOrEmpty(r.dayHigh),
    // יחס פחמימות: 15 גרם ליחידה אם לא נקבע אחרת (שדה שנמחק בכוונה נשאר ריק)
    icr: r.icr === undefined ? 15 : numOrEmpty(r.icr),
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
    items: safeItems(r.items),
    site: SITES[r.site] ? r.site : '',
    note: String(r.note || ''),
    by: String(r.by || ''),
  };
}

export function safeItems(list) {
  return (Array.isArray(list) ? list : [])
    .map((x) => ({ foodId: String(x?.foodId || ''), name: String(x?.name || ''), qty: numOrEmpty(x?.qty), carbs: numOrEmpty(x?.carbs) }))
    .filter((x) => x.name && x.qty !== '' && x.qty > 0);
}

// טבלת הפחמימות המובנית (מה שהמשתמשת נתנה). כל פריט: כמה גרם פחמימה ביחידה אחת
export const DEFAULT_FOODS = [
  { id: 'food:rice', name: 'אורז', unit: 'כוס חד פעמית', carbs: 30 },
  { id: 'food:pasta', name: 'פסטה', unit: 'כוס חד פעמית', carbs: 30 },
  { id: 'food:couscous', name: 'קוסקוס', unit: 'כוס חד פעמית', carbs: 30 },
  { id: 'food:ptitim', name: 'פתיתים', unit: 'כוס חד פעמית', carbs: 40 },
  { id: 'food:schnitzel', name: 'שניצלונים', unit: '3-4 יחידות', carbs: 30 },
  { id: 'food:chicken', name: 'עוף', unit: 'מנה', carbs: 0 },
  { id: 'food:meatballs', name: 'קציצות', unit: 'מנה', carbs: 0 },
  { id: 'food:shawarma', name: 'שווארמה', unit: 'מנה', carbs: 0 },
].map((f) => ({ ...f, t: 'food' }));

export function safeFood(r) {
  const carbs = numOrEmpty(r.carbs);
  return { ...r, t: 'food', name: String(r.name || 'מאכל'), unit: String(r.unit || 'מנה'), carbs: carbs === '' || carbs < 0 ? 0 : carbs };
}

// הרשימה המובנית + מה שנוסף/נערך, בלי מה שנמחק
export function foodsOf(records) {
  const deleted = new Set(records.filter((r) => r?.t === 'food' && r.deleted).map((r) => r.id));
  const mine = new Map(records.filter((r) => r?.t === 'food' && !r.deleted).map((r) => [r.id, r]));
  const list = DEFAULT_FOODS.filter((f) => !deleted.has(f.id)).map((f) => safeFood({ ...f, ...mine.get(f.id) }));
  for (const [id, r] of mine) if (!id.startsWith('food:') || !DEFAULT_FOODS.some((f) => f.id === id)) list.push(safeFood(r));
  return list;
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
  return { settings, templates, meals, readings, chats, foods: foodsOf(records), cgm: cgmOf(live) };
}

// מדידות החיישן: מפה מתאריך לרשימת [דקה, ערך] ממוינת
export function cgmOf(records) {
  const map = new Map();
  for (const r of records) {
    if (r.t !== 'cgm' || !isDate(r.date) || !Array.isArray(r.points)) continue;
    const pts = r.points.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[0] >= 0 && p[0] < 1440 && p[1] > 0).sort((a, b) => a[0] - b[0]);
    if (pts.length) map.set(r.date, pts);
  }
  return map;
}

const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// ערך החיישן הקרוב לשעה מסוימת (עד tol דקות), כולל מעבר לחצות (דקה 1440+ = היום הבא)
export function cgmAt(data, date, minute, tol = 10) {
  if (!data?.cgm?.size) return '';
  let d = date;
  let m = minute;
  if (m >= 1440) {
    d = addDays(date, 1);
    m -= 1440;
  }
  const pts = data.cgm.get(d);
  if (!pts) return '';
  let best = null;
  for (const p of pts) if (Math.abs(p[0] - m) <= tol && (!best || Math.abs(p[0] - m) < Math.abs(best[0] - m))) best = p;
  return best ? best[1] : '';
}

// כל מדידות החיישן בין שתי נקודות זמן (דקות מתחילת היום של date, אפשר מעבר לחצות)
function cgmRange(data, date, from, to) {
  const out = [];
  for (const [d, base] of [[date, 0], [addDays(date, 1), 1440]]) {
    const pts = data?.cgm?.get(d);
    if (!pts) continue;
    for (const [m, v] of pts) if (m + base > from && m + base <= to) out.push({ mins: m + base, value: v });
  }
  return out;
}

// רמת הסוכר: low (מתחת לטווח), ok, high (מעל), veryHigh (מעל 250)
// before = ערך לפני ארוחה (נבדק מול הטווח לפני ארוחה); אחרת – מול הטווח לאורך היום
export function level(value, settings, before = false) {
  if (value === '' || value == null) return '';
  if (value < settings.low) return 'low';
  const high = before ? settings.high : settings.dayHigh ?? settings.high;
  if (value > 250 && high < 250) return 'veryHigh';
  if (value > high) return 'high';
  return 'ok';
}

export const LEVEL_TEXT = { low: 'נמוך', ok: 'בטווח', high: 'גבוה', veryHigh: 'גבוה מאוד' };

// כמה דקות אחרי הארוחה נמדד (מדידה אחרי חצות של ארוחת ערב = היום הבא)
export function minutesAfter(mealTime, readingTime) {
  let diff = minutes(readingTime) - minutes(mealTime);
  if (diff < -60) diff += 24 * 60;
  return diff;
}

// מה קרה אחרי הארוחה: המדידה הקרובה ל-2 שעות (בין 90 ל-180 דקות), השיא, הנמוך, ושינוי מלפני.
// כשיש נתוני חיישן (data.cgm) – הם משלימים: סוכר לפני (אם לא הוזן), שעה/שעתיים/שלוש אחרי, ושיא ונמוך מכל 4 השעות.
// מדידה ידנית קודמת לחיישן.
export function outcome(meal, data) {
  const start = minutes(meal.time);
  const after = meal.readings.map((r) => ({ ...r, mins: minutesAfter(meal.time, r.time) })).filter((r) => r.mins > 0 && r.mins <= 6 * 60);
  const sensor = data ? cgmRange(data, meal.date, start, start + 240) : [];
  if (sensor.length) {
    for (const off of [60, 120, 180]) {
      if (after.some((r) => Math.abs(r.mins - off) <= 20)) continue;
      const v = cgmAt(data, meal.date, start + off);
      if (v !== '') after.push({ time: hhmm((start + off) % 1440), value: v, mins: off, cgm: true });
    }
  }
  const near2h = after.filter((r) => r.mins >= 90 && r.mins <= 180).sort((a, b) => Math.abs(a.mins - 120) - Math.abs(b.mins - 120))[0];
  const all = [...after, ...sensor];
  const peak = all.length ? all.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const lowest = all.length ? all.reduce((a, b) => (b.value < a.value ? b : a)) : null;
  const last = after.length ? after.reduce((a, b) => (b.mins > a.mins ? b : a)) : null;
  const after2h = near2h ? near2h.value : '';
  const before = meal.before !== '' ? meal.before : data ? cgmAt(data, meal.date, start, 15) : '';
  return {
    after: after.sort((a, b) => a.mins - b.mins),
    after2h,
    before,
    beforeCgm: meal.before === '' && before !== '',
    peak: peak ? peak.value : '',
    lowest: lowest ? lowest.value : '',
    last: last ? last.value : '',
    rise: after2h !== '' && before !== '' ? after2h - before : '',
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
  const rows = list.map((m) => ({ m, o: outcome(m, data) }));
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
    before: round(avg(rows.map((r) => r.o.before).filter((x) => x !== ''))),
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

// המדידות לסטטיסטיקה: ביום שיש בו נתוני חיישן – מדידות החיישן (מדויקות ורציפות), ובשאר הימים – המדידות הידניות
export function allPoints(data, from = '0000-00-00', to = '9999-99-99') {
  const manual = manualPoints(data, from, to).filter((p) => !data.cgm?.has(p.date));
  return [...manual, ...cgmPoints(data, from, to)].sort(byTime);
}

export function cgmPoints(data, from = '0000-00-00', to = '9999-99-99') {
  const out = [];
  for (const [date, pts] of data.cgm || []) if (date >= from && date <= to) for (const [m, v] of pts) out.push({ date, time: hhmm(m), value: v, kind: 'cgm' });
  return out.sort(byTime);
}

// המדידות הידניות (לפני ארוחה, אחרי ארוחה, ובנפרד) – לגרף היומי
export function manualPoints(data, from = '0000-00-00', to = '9999-99-99') {
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

// ארוחה קבועה חדשה מארוחה שנרשמה ("להוסיף לתפריט הקבוע")
export function templateFromMeal(m) {
  return { t: 'template', name: m.name, slot: m.slot, time: m.time, food: m.food, portion: numOrEmpty(m.portion) || 1, carbs: numOrEmpty(m.carbs), dose: numOrEmpty(m.insulin), days: [] };
}

// ארוחה חדשה מארוחה קבועה
export function mealFromTemplate(t, date) {
  return { t: 'meal', date, time: t.time, templateId: t.id, name: t.name, slot: t.slot, food: t.food, portion: t.portion, carbs: t.carbs, before: '', insulin: '', readings: [], tags: [], note: '' };
}

// מחשבון אינסולין לפי ההגדרות: פחמימות ÷ יחס פחמימות, ותיקון אם הסוכר לפני מעל הטווח (רק אם הוזן פקטור תיקון).
// התיקון מוריד עד היעד לתיקון, ואם לא נקבע – עד הגבול העליון של הטווח. מתחת לטווח – בלי תוספת, עם אזהרה.
// זה חישוב בלבד – ההחלטה של המשפחה ושל הצוות.
export const roundHalf = (v) => Math.round(v * 2) / 2;

export function calcDose(settings, carbs, before) {
  if (settings.icr === '' || !(settings.icr > 0) || carbs === '' || !(carbs >= 0)) return null;
  const food = carbs / settings.icr;
  const status = before === '' ? '' : before < settings.low ? 'low' : before > settings.high ? 'high' : 'ok';
  const target = settings.target !== '' ? settings.target : settings.high;
  let correction = 0;
  const canCorrect = settings.cf > 0;
  if (status === 'high' && canCorrect && before > target) correction = (before - target) / settings.cf;
  const total = food + correction;
  return { carbs: round(carbs, 1), food: round(food, 1), correction: round(correction, 1), total: round(total, 1), rounded: roundHalf(total), status, needsCf: status === 'high' && !canCorrect, target };
}

// תאימות לשם הישן
export function suggestByRatio(settings, carbs, before) {
  const r = calcDose(settings, carbs, before);
  return r && { food: r.food, correction: r.correction, total: r.total };
}

// סה"כ פחמימות ממה שנבחר במחשבון
export const itemsCarbs = (items) => round(items.reduce((a, x) => a + (Number(x.qty) || 0) * (Number(x.carbs) || 0), 0), 1);
export const itemsText = (items) => items.map((x) => `${x.name} ×${x.qty}`).join(', ');

// ארוחות של היום שקיבלו אינסולין ועבר זמן – אבל אין מדידה שעתיים אחרי (תזכורת במסך)
export function waitingForCheck(data, date = today(), time = nowTime()) {
  return data.meals.filter((m) => {
    if (m.date !== date || m.insulin === '') return false;
    const passed = minutes(time) - minutes(m.time);
    if (passed < 110 || passed > 5 * 60) return false;
    return !m.readings.some((r) => minutesAfter(m.time, r.time) >= 90);
  });
}

// מיקום הזריקה האחרון לפני הארוחה הזו (להחלפת מקומות)
export function lastSite(data, meal) {
  const prev = data.meals.filter((m) => m.id !== meal.id && m.site && (m.date < meal.date || (m.date === meal.date && minutes(m.time) <= minutes(meal.time))));
  return prev.length ? prev[prev.length - 1].site : '';
}

// סיכום יומי של החיישן (ל-AI): ממוצע, אחוז בטווח, מינימום ומקסימום
export function cgmDaySummary(data, date) {
  const pts = data.cgm?.get(date);
  if (!pts?.length) return null;
  const vals = pts.map((p) => p[1]);
  const s = data.settings;
  return {
    count: vals.length,
    mean: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    inRange: Math.round((vals.filter((v) => v >= s.low && v <= s.dayHigh).length / vals.length) * 100),
    low: vals.filter((v) => v < s.low).length,
    min: Math.min(...vals),
    max: Math.max(...vals),
  };
}

const fmt = (v) => (v === '' ? '?' : String(v));

// סיכום טקסט של היומן ל-AI: הגדרות, סטטיסטיקה, דפוס לכל ארוחה ופירוט מלא של הימים האחרונים
export function aiContext(data, base = today(), detailDays = 21) {
  const s = data.settings;
  const lines = [];
  lines.push(`היום: ${base} (${dayLabel(base, base)})`);
  lines.push(`הגדרות: ${s.person ? `שם: ${s.person}. ` : ''}טווח תקין לפני ארוחה ${s.low}-${s.high} mg/dL, ולאורך היום (אחרי אוכל, חיישן, אחוז בטווח) ${s.low}-${s.dayHigh}.` + (s.icr !== '' ? ` יחס פחמימות (שהמשפחה הזינה): יחידה לכל ${s.icr} גרם.` : '') + (s.cf !== '' ? ` פקטור תיקון: יחידה מורידה ${s.cf}.` : '') + (s.target !== '' ? ` יעד לתיקון: ${s.target}.` : ''));
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
  if (data.foods?.length) lines.push(`טבלת הפחמימות של המשפחה: ${data.foods.map((f) => `${f.name} (${f.unit}) = ${f.carbs} גר׳`).join('; ')}`);
  const auto = insights(data, 30, base);
  if (auto.length) lines.push(`ממצאים אוטומטיים (30 יום): ${auto.map((x) => x.text).join(' | ')}`);
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
    if (!meals.length && !loose.length && !data.cgm?.has(d)) continue;
    lines.push(`${d} (${DAY_NAMES[weekday(d)]}):`);
    for (const m of meals) {
      const o = outcome(m, data);
      const after = o.after.map((r) => `${r.time}=${r.value}${r.cgm ? ' (חיישן)' : ''} (+${r.mins} דק׳)`).join(', ');
      lines.push(`  ${m.time} | ${m.name}${m.food ? ` (${m.food})` : ''}${m.items.length ? ` [מחשבון: ${itemsText(m.items)}]` : ''} | ${m.portion} | ${fmt(m.carbs)} | ${m.before !== '' ? m.before : o.before !== '' ? `${o.before} (חיישן)` : '?'} | ${fmt(m.insulin)}${m.site ? ` (${SITES[m.site]})` : ''} | ${after || 'אין'}${m.tags.length ? ` | ${m.tags.map((x) => TAGS[x]).join(' ')}` : ''}${m.note ? ` | הערה: ${m.note}` : ''}`);
    }
    for (const r of loose) lines.push(`  ${r.time} | מדידה ${r.value}${r.note ? ` (${r.note})` : ''}`);
    const c = cgmDaySummary(data, d);
    if (c) lines.push(`  חיישן: ${c.count} מדידות, ממוצע ${c.mean}, בטווח ${c.inRange}%, ${c.low} מדידות נמוכות, טווח ${c.min}-${c.max}`);
  }
  return lines.join('\n');
}

// ייצוא לאקסל (CSV) – לרופא/ה או לדיאטנית
export function toCsv(data) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['תאריך', 'שעה', 'סוג', 'ארוחה', 'מה אכל', 'מנה', 'פחמימה (גרם)', 'סוכר לפני', 'אינסולין', 'מיקום הזריקה', 'מדידות אחרי', 'אחרי שעתיים', 'שיא', 'סימונים', 'הערה', 'נרשם ע״י']];
  const all = [...data.meals.map((m) => ({ ...m, kind: 'meal' })), ...data.readings.map((r) => ({ ...r, kind: 'reading' }))].sort(byTime);
  for (const x of all) {
    if (x.kind === 'reading') rows.push([x.date, x.time, 'מדידה', '', '', '', '', x.value, '', '', '', '', '', '', x.note, x.by]);
    else {
      const o = outcome(x, data);
      rows.push([x.date, x.time, 'ארוחה', x.name, x.food, x.portion, x.carbs, x.before, x.insulin, SITES[x.site] || '', o.after.map((r) => `${r.time}: ${r.value}`).join(' · '), o.after2h, o.peak, x.tags.map((t) => TAGS[t]).join(' '), x.note, x.by]);
    }
  }
  return `﻿${rows.map((r) => r.map(q).join(',')).join('\n')}`;
}

// תובנות אוטומטיות מהנתונים (בלי AI): מה חוזר על עצמו בכל ארוחה ובכל שעה. רק כשיש מספיק פעמים (3+).
// הניסוח: מה הנתונים מראים + "לבדוק עם הצוות" – לא הוראה לשנות מינון.
export function insights(data, days = 30, base = today()) {
  const s = data.settings;
  const out = [];
  const pats = patternsByMeal(data, days, base);
  for (const p of pats) {
    if (p.measured < 3) continue;
    const rows = p.list.map((m) => outcome(m, data)).filter((o) => o.after2h !== '');
    const highs = rows.filter((o) => o.after2h > s.dayHigh).length;
    if (p.lows >= 2) out.push({ kind: 'low', text: `${p.name}: ${p.lows} פעמים הסוכר ירד מתחת ל-${s.low} אחרי הארוחה.`, hint: 'חשוב להראות לצוות – ייתכן שהאינסולין לארוחה הזו גבוה מדי.' });
    if (highs / rows.length >= 0.6) out.push({ kind: 'high', text: `${p.name}: שעתיים אחרי הסוכר היה מעל ${s.dayHigh} ב-${highs} מתוך ${rows.length} פעמים (ממוצע ${p.after2h}).`, hint: 'כדאי לבדוק עם הצוות את היחס לארוחה הזו, או לתת את האינסולין קצת לפני האוכל.' });
    else if (p.inRange / p.measured >= 0.7 && p.lows === 0) out.push({ kind: 'good', text: `${p.name}: ${p.inRange} מתוך ${p.measured} פעמים הסתיים בטווח – מה שעושים עובד.`, hint: '' });
  }
  // כמה גרם פחמימה "עבדו" ליחידה בארוחות שהסתיימו טוב
  const worked = data.meals
    .filter((m) => m.date >= addDays(base, -days + 1) && m.date <= base && m.carbs > 0 && m.insulin > 0)
    .filter((m) => {
      const o = outcome(m, data);
      return level(o.before, s, true) === 'ok' && o.after2h !== '' && level(o.after2h, s) === 'ok' && !(o.lowest !== '' && o.lowest < s.low);
    });
  if (worked.length >= 3 && s.icr > 0) {
    const ratio = round(worked.reduce((a, m) => a + m.carbs / m.insulin, 0) / worked.length);
    if (Math.abs(ratio - s.icr) >= 2) out.push({ kind: 'info', text: `בארוחות שהסתיימו בטווח (${worked.length}) יצא בממוצע יחידה לכל ${ratio} גרם פחמימה, וההגדרה היא ${s.icr}.`, hint: 'זה נתון להביא לצוות – לא לשנות לבד.' });
  }
  const parts = byDayPart(data, days, base);
  for (const p of parts) if (p.low >= 2) out.push({ kind: 'low', text: `${p.low} ערכים נמוכים ב${p.label.replace(/ \(.*/, '')}.`, hint: 'שווה לשים לב לשעות האלה ולספר לצוות.' });
  const recent = data.meals.filter((m) => m.date >= addDays(base, -days + 1) && m.date <= base);
  const befores = recent.map((m) => outcome(m, data).before).filter((x) => x !== '');
  const withBefore = befores;
  const highBefore = befores.filter((v) => v > s.high).length;
  if (withBefore.length >= 5 && highBefore / withBefore.length >= 0.5) out.push({ kind: 'high', text: `ב-${highBefore} מתוך ${withBefore.length} ארוחות הסוכר כבר לפני האוכל היה מעל ${s.high}.`, hint: 'ייתכן שהבעיה בין הארוחות (או בלילה) ולא בארוחה עצמה.' });
  const dosed = recent.filter((m) => m.insulin !== '');
  const unmeasured = dosed.filter((m) => outcome(m, data).after2h === '').length;
  if (dosed.length >= 4 && unmeasured / dosed.length >= 0.5) out.push({ kind: 'info', text: `ב-${unmeasured} מתוך ${dosed.length} ארוחות לא נמדד סוכר שעתיים אחרי.`, hint: 'מדידה שעתיים אחרי היא מה שמלמד אם הכמות התאימה.' });
  const order = { low: 0, high: 1, info: 2, good: 3 };
  return out.sort((a, b) => order[a.kind] - order[b.kind]);
}

// לוח שנה: לכל יום בחודש – ממוצע, כמה מדידות, נמוכים, גבוהים וארוחות
export function monthDays(data, month) {
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const count = new Date(y, m, 0).getDate();
  const last = `${month}-${String(count).padStart(2, '0')}`;
  const pts = allPoints(data, first, last);
  const s = data.settings;
  const days = [];
  for (let d = 1; d <= count; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const vals = pts.filter((p) => p.date === date).map((p) => p.value);
    days.push({
      date,
      day: d,
      count: vals.length,
      mean: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : '',
      low: vals.filter((v) => v < s.low).length,
      high: vals.filter((v) => v > s.dayHigh).length,
      meals: data.meals.filter((x) => x.date === date).length,
    });
  }
  return { first, offset: weekday(first), days };
}

export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
export const monthName = (month) => `${MONTH_NAMES[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
