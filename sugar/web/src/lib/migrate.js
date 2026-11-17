// המרות חד-פעמיות של נתונים ישנים – רצות באפליקציה אחרי סנכרון (בכל מכשיר; בטוח להריץ שוב: מה שהומר לא נתפס שוב).
//
// זריקה לילית: לפני שהיה כפתור, רשמו אותה כ"מדידה" או כ"ארוחה" עם הערה / שם "זריקה לילית".
//   מדידה עם הערה כזו      → אותה מדידה הופכת לזריקה לילית (basal: true)
//   ארוחה ששמה "זריקה לילית" → זריקה לילית חדשה (מזהה קבוע לפי הארוחה, כדי שכמה מכשירים לא יכפילו) והארוחה נמחקת
//   ארוחה עם הערה כזו        → נוספת זריקה לילית לאותו יום (הארוחה נשארת)
// כמות היחידות: שדה האינסולין, ואם אין – מספר מההערה ("11 יחידות"), ואם אין – הכמות הקבועה מההגדרות.
// ביום שכבר יש בו זריקה לילית – לא מוסיפים עוד אחת.
import { numOrEmpty, safeMeal, safeReading, safeSettings } from './diary';

// "זריקה לילית" (גם "זריקת לילה") ושמות של אינסולין ארוך טווח. במדידה – גם הערה שמתחילה ב"לילית"
export const BASAL_RE = /זריק[הת]\s*(?:ה)?ליל(?:ית|יה|ה)|ארוכת\s*טווח|לנטוס|טרסיבה|טרזיבה|בזאלי/;
const READING_RE = new RegExp(`${BASAL_RE.source}|^\\s*לילית`);

const cleanNote = (note) =>
  String(note || '')
    .replace(/זריק[הת]\s*(?:ה)?ליל(?:ית|יה|ה)|^\s*לילית/g, '')
    .replace(/\d+(?:[.,]\d+)?\s*(?:יחידות|יח[׳']?)/g, '')
    .replace(/^[\s,.\-–·]+|[\s,.\-–·]+$/g, '')
    .trim();

function doseFrom(insulin, ...texts) {
  if (insulin !== '' && insulin > 0) return insulin;
  for (const t of texts) {
    const m = String(t || '').match(/(\d+(?:[.,]\d+)?)\s*(?:יחידות|יח)/) || String(t || '').match(/(?:^|\s)(\d{1,2}(?:[.,]\d)?)(?:\s|$)/);
    if (m) {
      const v = numOrEmpty(m[1]);
      if (v > 0 && v <= 80) return v;
    }
  }
  return '';
}

export function basalMigration(records) {
  const live = records.filter((r) => r && !r.deleted);
  const ids = new Set(records.map((r) => r.id));
  const settings = safeSettings(live.find((r) => r.t === 'settings'));
  const days = new Set(live.filter((r) => r.t === 'reading' && r.basal).map((r) => r.date));
  const out = [];
  const add = (rec) => {
    out.push(rec);
    if (rec.basal && !rec.deleted) days.add(rec.date);
  };

  // 1. מדידות עם הערה
  for (const raw of live.filter((r) => r.t === 'reading' && !r.basal && READING_RE.test(r.note || ''))) {
    const r = safeReading(raw);
    if (days.has(r.date)) continue;
    add({ id: r.id, t: 'reading', basal: true, insulin: doseFrom(r.insulin, r.note) || settings.basalDose, note: cleanNote(r.note) });
  }

  // 2+3. ארוחות
  for (const raw of live.filter((r) => r.t === 'meal')) {
    const m = safeMeal(raw);
    const byName = BASAL_RE.test(m.name);
    if (!byName && !BASAL_RE.test(m.note)) continue;
    const id = `b-from-${m.id}`;
    if (ids.has(id)) continue;
    if (!days.has(m.date)) {
      add({
        id,
        t: 'reading',
        basal: true,
        date: m.date,
        time: m.time,
        insulin: doseFrom(byName ? m.insulin : '', byName ? m.note : m.note, m.name) || settings.basalDose,
        value: byName ? m.before : '',
        site: byName ? m.site : '',
        note: byName ? cleanNote(m.note) : '',
        by: m.by,
      });
    }
    // ארוחה שכולה "זריקה לילית" – כבר לא ארוחה
    if (byName) add({ id: m.id, t: 'meal', deleted: true });
  }
  return out;
}
