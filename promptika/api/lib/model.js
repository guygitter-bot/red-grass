// ניקוי נתונים: כל שדה אופציונלי ומקבל ברירת מחדל, כדי שנתונים ישנים ימשיכו לעבוד
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v, fallback, min = 0, max = 1_000_000) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

export const DEFAULT_SETTINGS = {
  hourlyRate: 0, // ₪ לשעה
  hostingMonthly: 0, // ₪ לחודש
  apiMonthlyAvg: 0, // ₪ לחודש, ממוצע עלות ה-AI
  depositPercent: 50,
  revisionRounds: 2,
  vatIncluded: false,
};

export function safeSettings(s) {
  s = obj(s);
  const d = DEFAULT_SETTINGS;
  return {
    hourlyRate: num(s.hourlyRate, d.hourlyRate),
    hostingMonthly: num(s.hostingMonthly, d.hostingMonthly),
    apiMonthlyAvg: num(s.apiMonthlyAvg, d.apiMonthlyAvg),
    depositPercent: num(s.depositPercent, d.depositPercent, 0, 100),
    revisionRounds: Math.round(num(s.revisionRounds, d.revisionRounds, 0, 20)),
    vatIncluded: typeof s.vatIncluded === 'boolean' ? s.vatIncluded : d.vatIncluded,
  };
}

// כלי בהצעה: ה-AI מחזיר רק שעות – אין כאן שדה של כסף
export function safeTool(t) {
  t = obj(t);
  return {
    name: str(t.name, 120),
    problem: str(t.problem, 2000),
    spec: str(t.spec, 20000),
    buildHours: num(t.buildHours, 0, 0, 10_000),
    monthlyHours: num(t.monthlyHours, 0, 0, 1000),
  };
}

export function safeProposal(p) {
  p = obj(p);
  return {
    id: str(p.id, 40),
    version: Math.round(num(p.version, 1, 1, 1000)),
    createdAt: num(p.createdAt, 0, 0, Number.MAX_SAFE_INTEGER),
    tools: (Array.isArray(p.tools) ? p.tools : []).slice(0, 30).map(safeTool),
    notes: str(p.notes, 5000),
  };
}

export function safeClient(c) {
  c = obj(c);
  return {
    id: str(c.id, 40),
    name: str(c.name, 120),
    business: str(c.business, 200),
    createdAt: num(c.createdAt, 0, 0, Number.MAX_SAFE_INTEGER),
    updatedAt: num(c.updatedAt, 0, 0, Number.MAX_SAFE_INTEGER),
    // 9 חלקי טופס הקליטה – יתמלאו בהמשך
    intake: obj(c.intake),
    proposals: (Array.isArray(c.proposals) ? c.proposals : []).slice(0, 50).map(safeProposal),
  };
}

// תקציר לרשימת הלקוחות
export const clientSummary = (c) => ({
  id: c.id,
  name: c.name,
  business: c.business,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
  proposals: c.proposals.length,
});
