// תאריכי חנוכה: הנר הראשון נדלק בערב של התאריך הרשום, ו-8 לילות ברצף
export const FIRST_NIGHTS = ['2026-12-04', '2027-12-24', '2028-12-12', '2029-12-01', '2030-12-20'];

export const NIGHT_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי', 'שמיני'];

const DAY = 86400000;

// מספר יום (לפי התאריך המקומי, בלי תלות בשעון קיץ)
function dayNumber(d) {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}
function parse(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY);
}

/**
 * מצב החג בתאריך נתון:
 *  { state: 'during', night: 1-8 }  – ביום שבו מדליקים הערב את הנר ה-night
 *  { state: 'before', daysUntil, start } – לפני החג (גם אחרי שחג השנה נגמר: הספירה לשנה הבאה)
 *  { state: 'unknown' } – אחרי התאריך האחרון ברשימה
 */
export function hanukkahStatus(now = new Date()) {
  const today = dayNumber(now);
  for (const s of FIRST_NIGHTS) {
    const k = today - parse(s);
    if (k < 0) return { state: 'before', daysUntil: -k, start: s, night: 0 };
    if (k <= 7) return { state: 'during', night: k + 1, daysUntil: 0, start: s };
  }
  return { state: 'unknown', night: 0, daysUntil: 0, start: null };
}

// הניסוח שמופיע בדף הבית
export function tonightLine(st) {
  if (st.state === 'during') return `הערב מדליקים נר ${NIGHT_NAMES[st.night - 1]}`;
  if (st.state === 'before') {
    if (st.daysUntil === 1) return 'מחר בערב מדליקים נר ראשון!';
    if (st.daysUntil === 2) return 'עוד יומיים לחנוכה';
    return `עוד ${st.daysUntil} ימים לחנוכה`;
  }
  return 'חג חנוכה שמח!';
}
