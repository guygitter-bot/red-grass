// לעתיד: הצעות מחיר. כרגע לא מוצג במסכים (המחיר ללקוח קבוע)
// חישוב הכסף – רק כאן, לפי ההגדרות. ה-AI מחזיר רק שעות, לעולם לא סכומים.
// שינוי התעריף בהגדרות משנה מיד את כל הסכומים.
export const VAT_RATE = 0.18;

const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
const round = (v) => Math.round(v);

// ברירות מחדל – זהות לשרת (api/lib/model.js)
export function safeSettings(s = {}) {
  s = s && typeof s === 'object' ? s : {};
  return {
    hourlyRate: n(s.hourlyRate),
    hostingMonthly: n(s.hostingMonthly),
    apiMonthlyAvg: n(s.apiMonthlyAvg),
    depositPercent: s.depositPercent == null ? 50 : Math.min(100, n(s.depositPercent)),
    revisionRounds: s.revisionRounds == null ? 2 : Math.round(n(s.revisionRounds)),
    vatIncluded: typeof s.vatIncluded === 'boolean' ? s.vatIncluded : false,
  };
}

// שלבי ההקמה, בסדר שמוצג בהצעה
export const STAGES = [
  ['spec', 'אפיון'],
  ['build', 'בנייה'],
  ['test', 'בדיקות'],
  ['training', 'הדרכה'],
];

// שעות לפי שלב. הצעה ישנה שמרה מספר אחד – הוא נחשב כשעות "בנייה"
export function stageHours(tool = {}) {
  const b = tool.buildHours;
  if (b && typeof b === 'object') return { spec: n(b.spec), build: n(b.build), test: n(b.test), training: n(b.training) };
  return { spec: 0, build: n(b), test: 0, training: 0 };
}

// עיגול לשתי ספרות אחרי הנקודה (שעות)
const hr = (v) => Math.round(v * 100) / 100;

// שעות הקמה של כלי: מספר (הצעה ישנה) או לפי שלב { spec, build, test, training }
export function buildHoursOf(tool = {}) {
  const h = stageHours(tool);
  return hr(h.spec + h.build + h.test + h.training);
}

// כלי אחד: עלות הקמה = שעות × תעריף; תחזוקה חודשית (שעות בלבד) = שעות בחודש × תעריף
export function toolCost(tool = {}, settings) {
  const { hourlyRate } = safeSettings(settings);
  return {
    build: round(buildHoursOf(tool) * hourlyRate),
    monthlyWork: round(n(tool.monthlyHours) * hourlyRate),
  };
}

// עלות ה-AI החודשית של חבילה: סכום ההערכות של הכלים; אם אין הערכה בכלל – הממוצע מההגדרות
export function apiMonthlyOf(tools, settings) {
  const s = safeSettings(settings);
  const sum = tools.reduce((a, t) => a + n(t.apiMonthlyEstimate), 0);
  return sum > 0 ? sum : s.apiMonthlyAvg;
}

// חבילה = רשימת כלים. מחזיר שורות (שעות × תעריף = סכום) להקמה, ורכיבי העלות החודשית – כל רכיב בשורה משלו.
// אחסון פעם אחת לחבילה, לא לכל כלי. הכול מחושב בכל פעם מחדש מההגדרות, לא נשמר.
export function packageCost(tools = [], settings) {
  const s = safeSettings(settings);
  const list = Array.isArray(tools) ? tools : [];
  const buildRows = STAGES.map(([key, label]) => {
    const hours = hr(list.reduce((a, t) => a + stageHours(t)[key], 0));
    return { key, label, hours, rate: s.hourlyRate, sum: round(hours * s.hourlyRate) };
  });
  const build = buildRows.reduce((a, r) => a + r.sum, 0);
  const buildHours = hr(buildRows.reduce((a, r) => a + r.hours, 0));

  const monthlyHours = hr(list.reduce((a, t) => a + n(t.monthlyHours), 0));
  const has = list.length > 0;
  const monthlyLines = [
    { key: 'work', label: 'תחזוקה ותמיכה', hours: monthlyHours, rate: s.hourlyRate, sum: round(monthlyHours * s.hourlyRate) },
    { key: 'hosting', label: 'אחסון', sum: has ? round(s.hostingMonthly) : 0 },
    { key: 'api', label: 'עלות AI (API)', sum: has ? round(apiMonthlyOf(list, s)) : 0 },
  ];
  const monthly = monthlyLines.reduce((a, l) => a + l.sum, 0);
  const deposit = round((build * s.depositPercent) / 100);
  // אם הסכומים לא כוללים מע"מ – מוסיפים אותו לסכום הסופי
  const vatFactor = s.vatIncluded ? 1 : 1 + VAT_RATE;
  return {
    buildRows,
    buildHours,
    build,
    monthlyLines,
    monthlyHours,
    monthly,
    deposit,
    buildWithVat: round(build * vatFactor),
    monthlyWithVat: round(monthly * vatFactor),
  };
}

// הצעה שלמה (כל הכלים): הקמה, חודשי, מקדמה ומע"מ
export function proposalCost(proposal = {}, settings) {
  const tools = Array.isArray(proposal.tools) ? proposal.tools : [];
  const c = packageCost(tools, settings);
  return {
    buildHours: c.buildHours,
    monthlyHours: c.monthlyHours,
    build: c.build,
    monthly: c.monthly,
    deposit: c.deposit,
    buildWithVat: c.buildWithVat,
    monthlyWithVat: c.monthlyWithVat,
  };
}

// כמה כלים בחבילה "מומלץ": כלי אחד – הכול; 2-3 כלים – שניים; 4 ומעלה – שלושה
export const recommendedCount = (count) => (count <= 1 ? count : count <= 3 ? 2 : 3);

// חבילות לפי הכלים (כבר מדורגים בהצעה). single = חבילה אחת עם כל הכלים
export function packagesOf(tools = [], single = false) {
  const list = Array.isArray(tools) ? tools : [];
  if (single) return [{ key: 'all', label: 'חבילה אחת', tools: list }];
  return [
    { key: 'base', label: 'בסיס', tools: list.slice(0, 1) },
    { key: 'recommended', label: 'מומלץ', tools: list.slice(0, recommendedCount(list.length)), recommended: true },
    { key: 'extended', label: 'מורחב', tools: list },
  ];
}

export const vatLabel = (settings) => (safeSettings(settings).vatIncluded ? 'כולל מע"מ' : 'לא כולל מע"מ');

// תנאים בקצרה: מקדמה וסבבי תיקונים מההגדרות; שינוי היקף ובעלות על הקוד – טקסט קבוע
export function termsOf(settings) {
  const s = safeSettings(settings);
  return [
    `מקדמה של ${s.depositPercent}% מעלות ההקמה בתחילת העבודה, והיתרה במסירה.`,
    s.revisionRounds > 0 ? `${s.revisionRounds} סבבי תיקונים כלולים בהקמה.` : 'סבבי תיקונים נוספים מתומחרים בנפרד.',
    'שינוי בהיקף העבודה מתומחר בנפרד ומאושר מראש.',
    'הקוד והנתונים שייכים ללקוח לאחר תשלום מלא.',
  ];
}

// ₪ 1,234
export const shekel = (v) => `₪${Math.round(Number(v) || 0).toLocaleString('he-IL')}`;
