// משימות קבועות: עזרים טהורים (טקסט ימים, "הפעם הבאה", טופס ברירת מחדל)
export const DAY_CHIPS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const TZ = 'Asia/Jerusalem';

// "כל יום" / "ימי חול" / "ראשון ורביעי"
export function daysText(days) {
  const d = [...new Set(days || [])].filter((x) => x >= 0 && x <= 6).sort((a, b) => a - b);
  if (d.length === 7) return 'כל יום';
  if (d.join() === '0,1,2,3,4') return 'ימי חול';
  const names = d.map((x) => DAY_NAMES[x]);
  if (names.length <= 1) return names[0] || 'אף יום';
  return `${names.slice(0, -1).join(', ')} ו${names[names.length - 1]}`;
}

// "כל יום ב-02:00"
export function whenText(s) {
  const d = daysText(s.days);
  return d === 'אף יום' ? d : `${d} ב-${s.time}`;
}

// מספר היום הקלנדרי בשעון ישראל (להשוואת "היום" / "מחר")
function dayNumber(ms) {
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

// "היום ב-02:00" / "מחר ב-..." / "יום שלישי 18.11 ב-..."; בלי next – "מושהית"
export function nextText(next, now = Date.now()) {
  if (!next) return 'מושהית';
  const time = new Intl.DateTimeFormat('he-IL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(next);
  const diff = dayNumber(next) - dayNumber(now);
  if (diff <= 0) return `היום ב-${time}`;
  if (diff === 1) return `מחר ב-${time}`;
  const date = new Intl.DateTimeFormat('he-IL', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'numeric' }).format(next);
  return `${date} ב-${time}`;
}

export function budgetText(b) {
  return `עד $${b} בכל הפעלה`;
}

export function defaultForm(agents = []) {
  const hasManager = agents.some((a) => a.key === 'manager');
  return { title: '', text: '', to: hasManager ? 'manager' : null, days: [0, 1, 2, 3, 4, 5, 6], time: '02:00', budget: 2, enabled: true };
}

export function formFrom(s) {
  return { id: s.id, title: s.title || '', text: s.text || '', to: s.to ?? null, days: [...(s.days || [])], time: s.time || '02:00', budget: s.budget ?? 2, enabled: s.enabled !== false };
}
