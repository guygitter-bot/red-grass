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

// מספר אופציונלי: ריק נשאר ריק (''), אחרת מוגבל לטווח
const optNum = (v, max) => {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : '';
};
const oneOf = (v, allowed) => (allowed.includes(v) ? v : '');
const rows = (v, fn) => (Array.isArray(v) ? v.slice(0, MAX_ROWS).map(fn) : []);
export const MAX_ROWS = 30;

// טופס הקליטה (9 חלקים) – הכול אופציונלי; שדות לא מוכרים נזרקים. הצורה זהה ל-web/src/lib/intake.js
export function safeIntake(i) {
  i = obj(i);
  const b = obj(i.business), o = obj(i.offer), cu = obj(i.customers), g = obj(i.goal), bu = obj(i.budget), t = obj(i.tech);
  return {
    business: { name: str(b.name, 200), field: str(b.field, 200), employees: optNum(b.employees, 100_000), roles: str(b.roles, 3000) },
    offer: { items: str(o.items, 3000), topEarner: str(o.topEarner, 2000) },
    customers: { ideal: str(cu.ideal, 3000), reach: str(cu.reach, 3000) },
    tools: rows(i.tools, (r) => {
      r = obj(r);
      return { tool: str(r.tool, 120), purpose: str(r.purpose, 500), monthlyCost: optNum(r.monthlyCost, 1_000_000) };
    }),
    pains: rows(i.pains, (r) => {
      r = obj(r);
      return { pain: str(r.pain, 1000), lastTime: str(r.lastTime, 1000), frequency: str(r.frequency, 200), hoursPerMonth: optNum(r.hoursPerMonth, 1000) };
    }),
    missing: rows(i.missing, (r) => str(r, 500)),
    goal: { success: str(g.success, 3000) },
    budget: { budget: str(bu.budget, 500), timeline: str(bu.timeline, 500) },
    tech: {
      maintain: oneOf(t.maintain, ['yes', 'no', 'partly']),
      dataLocation: str(t.dataLocation, 1000),
      decider: str(t.decider, 500),
      sensitive: oneOf(t.sensitive, ['yes', 'no']),
      sensitiveNote: str(t.sensitiveNote, 1000),
    },
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
    intake: safeIntake(c.intake),
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
