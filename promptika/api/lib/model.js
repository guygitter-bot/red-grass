// ניקוי נתונים: כל שדה אופציונלי ומקבל ברירת מחדל, כדי שנתונים ישנים ימשיכו לעבוד
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v, fallback, min = 0, max = 1_000_000) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const oneOf = (v, allowed) => (allowed.includes(v) ? v : '');
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

// שעות לכלי לפי שלב. הצעה ישנה (מהשלד) שמרה מספר אחד – הוא נחשב כשעות "בנייה"
export const HOURS_MAX = 500;
const hours = (v) => num(v, 0, 0, HOURS_MAX);
export function safeBuildHours(b) {
  if (typeof b === 'number' || typeof b === 'string') return { spec: 0, build: hours(b), test: 0, training: 0 };
  b = obj(b);
  return { spec: hours(b.spec), build: hours(b.build), test: hours(b.test), training: hours(b.training) };
}
const list = (v, max = 20, len = 300) => (Array.isArray(v) ? v.slice(0, max).map((x) => str(x, len)).filter(Boolean) : []);
const score = (v) => Math.round(num(v, 3, 1, 5));

// מערכת מומלצת: החלפה של מערכת קיימת (kind: replace + replaces) או מערכת חדשה (new).
// ה-AI מחזיר רק שעות (לתכנון פנימי) – אין כאן שדה של כסף, חוץ מהערכת עלות ה-API שבסכמה (לעתיד)
export function safeTool(t) {
  t = obj(t);
  return {
    kind: oneOf(t.kind, ['replace', 'new']) || 'new',
    replaces: str(t.replaces, 200),
    name: str(t.name, 120),
    problem: str(t.problem, 2000),
    whatItDoes: str(t.whatItDoes, 3000),
    benefit: score(t.benefit),
    effort: score(t.effort),
    savedHoursPerMonth: hours(t.savedHoursPerMonth),
    estimate: true, // חיסכון ללקוח הוא תמיד הערכה
    input: str(t.input, 2000),
    output: str(t.output, 2000),
    users: str(t.users, 1000),
    screens: list(t.screens),
    integrations: list(t.integrations),
    notIncluded: list(t.notIncluded),
    spec: str(t.spec, 20000),
    buildHours: safeBuildHours(t.buildHours),
    monthlyHours: hours(t.monthlyHours),
    apiMonthlyEstimate: num(t.apiMonthlyEstimate, 0, 0, 5000),
    range: str(t.range, 300),
    rangeDrivers: str(t.rangeDrivers, 1000),
  };
}

export const MAX_PROPOSALS = 50;

export function safeProposal(p) {
  p = obj(p);
  return {
    id: str(p.id, 40),
    version: Math.round(num(p.version, 1, 1, 1000)),
    createdAt: num(p.createdAt, 0, 0, Number.MAX_SAFE_INTEGER),
    understanding: str(p.understanding, 5000),
    currentSystems: (Array.isArray(p.currentSystems) ? p.currentSystems : []).slice(0, 30).map((x) => {
      x = obj(x);
      return { name: str(x.name, 200), verdict: oneOf(x.verdict, ['replace', 'keep', 'connect']) || 'keep', note: str(x.note, 1000) };
    }).filter((x) => x.name),
    missingQuestions: list(p.missingQuestions, 15, 500),
    tools: (Array.isArray(p.tools) ? p.tools : []).slice(0, 30).map(safeTool),
    timeline: (Array.isArray(p.timeline) ? p.timeline : []).slice(0, 12).map((x) => ({ stage: str(obj(x).stage, 200), duration: str(obj(x).duration, 100) })),
    nextStep: str(p.nextStep, 1000),
    notes: str(p.notes, 5000),
  };
}

// מספר אופציונלי: ריק נשאר ריק (''), אחרת מוגבל לטווח
const optNum = (v, max) => {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : '';
};
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
      return { tool: str(r.tool, 120), purpose: str(r.purpose, 500), issues: str(r.issues, 2000), replace: oneOf(r.replace, ['yes', 'maybe', 'no']), monthlyCost: optNum(r.monthlyCost, 1_000_000) };
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
    proposals: (Array.isArray(c.proposals) ? c.proposals : []).slice(0, MAX_PROPOSALS).map(safeProposal),
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
