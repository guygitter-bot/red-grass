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

// שעות הקמה של כלי: מספר (הצעה ישנה) או לפי שלב { spec, build, test, training }
export function buildHoursOf(tool = {}) {
  const b = tool.buildHours;
  if (b && typeof b === 'object') return n(b.spec) + n(b.build) + n(b.test) + n(b.training);
  return n(b);
}

// כלי אחד: עלות הקמה = שעות × תעריף; תחזוקה חודשית (שעות בלבד) = שעות בחודש × תעריף
export function toolCost(tool = {}, settings) {
  const { hourlyRate } = safeSettings(settings);
  return {
    build: round(buildHoursOf(tool) * hourlyRate),
    monthlyWork: round(n(tool.monthlyHours) * hourlyRate),
  };
}

// הצעה שלמה: הקמה, חודשי (שעות תחזוקה + אחסון + AI – אחסון ו-AI פעם אחת להצעה), מקדמה ומע"מ
export function proposalCost(proposal = {}, settings) {
  const s = safeSettings(settings);
  const tools = Array.isArray(proposal.tools) ? proposal.tools : [];
  const buildHours = tools.reduce((sum, t) => sum + buildHoursOf(t), 0);
  const monthlyHours = tools.reduce((sum, t) => sum + n(t.monthlyHours), 0);
  const build = round(buildHours * s.hourlyRate);
  const monthly = tools.length ? round(monthlyHours * s.hourlyRate + s.hostingMonthly + s.apiMonthlyAvg) : 0;
  const deposit = round((build * s.depositPercent) / 100);
  // אם הסכומים לא כוללים מע"מ – מוסיפים אותו לסכום הסופי
  const vatFactor = s.vatIncluded ? 1 : 1 + VAT_RATE;
  return {
    buildHours,
    monthlyHours,
    build,
    monthly,
    deposit,
    buildWithVat: round(build * vatFactor),
    monthlyWithVat: round(monthly * vatFactor),
  };
}

// ₪ 1,234
export const shekel = (v) => `₪${Math.round(Number(v) || 0).toLocaleString('he-IL')}`;
