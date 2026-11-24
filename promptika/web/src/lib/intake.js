// טופס הקליטה: צורת הנתונים, ברירות מחדל ופונקציות עזר טהורות (בלי React).
// הצורה והמגבלות זהות ל-api/lib/model.js (safeIntake) – לשנות בשניהם.
export const MAX_ROWS = 30;

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const optNum = (v, max) => {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : '';
};
const oneOf = (v, allowed) => (allowed.includes(v) ? v : '');
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const rows = (v, fn) => (Array.isArray(v) ? v.slice(0, MAX_ROWS).map(fn) : []);

// שורה ריקה לכל סוג של רשימה חוזרת
export const EMPTY_ROW = {
  tools: { tool: '', purpose: '', issues: '', replace: '', monthlyCost: '' },
  pains: { pain: '', lastTime: '', frequency: '', hoursPerMonth: '' },
  missing: '',
};

export const emptyIntake = () => ({
  business: { name: '', field: '', employees: '', roles: '' },
  offer: { items: '', topEarner: '' },
  customers: { ideal: '', reach: '' },
  tools: [],
  pains: [],
  missing: [],
  goal: { success: '' },
  budget: { budget: '', timeline: '' },
  tech: { maintain: '', dataLocation: '', decider: '', sensitive: '', sensitiveNote: '' },
});

// אותו ניקוי כמו בשרת: שדה חסר מקבל ברירת מחדל, מפתחות לא מוכרים נזרקים
export function safeIntake(i) {
  i = obj(i);
  const b = obj(i.business), o = obj(i.offer), cu = obj(i.customers), g = obj(i.goal), bu = obj(i.budget), t = obj(i.tech);
  return {
    business: { name: str(b.name, 200), field: str(b.field, 200), employees: optNum(b.employees, 100_000), roles: str(b.roles, 3000) },
    offer: { items: str(o.items, 3000), topEarner: str(o.topEarner, 2000) },
    customers: { ideal: str(cu.ideal, 3000), reach: str(cu.reach, 3000) },
    tools: rows(i.tools, (r) => {
      r = obj(r);
      // issues / replace חדשים – שורה ישנה בלעדיהם מקבלת ברירת מחדל
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

// הוספה / מחיקה / עדכון – תמיד מחזירים עותק חדש (לא משנים את המקור)
export function addRow(intake, key) {
  if (intake[key].length >= MAX_ROWS) return intake;
  const row = typeof EMPTY_ROW[key] === 'string' ? '' : { ...EMPTY_ROW[key] };
  return { ...intake, [key]: [...intake[key], row] };
}
export const removeRow = (intake, key, index) => ({ ...intake, [key]: intake[key].filter((_, i) => i !== index) });
export const setRowField = (intake, key, index, field, value) => ({
  ...intake,
  [key]: intake[key].map((r, i) => (i !== index ? r : field === null ? value : { ...r, [field]: value })),
});
export const setField = (intake, section, field, value) => ({ ...intake, [section]: { ...intake[section], [field]: value } });

const filledValue = (v) => (typeof v === 'number' ? true : typeof v === 'string' && v.trim() !== '');

// מצב חלק: 'empty' | 'partial' | 'filled'. section = אובייקט מ-data/intakeSections.js
export function sectionStatus(intake, section) {
  const data = intake[section.key];
  if (section.kind === 'fields') {
    const keys = section.fields.filter((f) => !f.optional).map((f) => f.key);
    const done = keys.filter((k) => filledValue(data[k])).length;
    const any = section.fields.some((f) => filledValue(data[f.key]));
    if (!any) return 'empty';
    return done === keys.length ? 'filled' : 'partial';
  }
  if (section.kind === 'list') {
    return data.some(filledValue) ? 'filled' : 'empty';
  }
  // שורות חוזרות: מלא = יש לפחות שורה אחת שכל שדותיה מלאים
  const fieldsOf = (r) => section.fields.map((f) => r[f.key]);
  if (!data.some((r) => fieldsOf(r).some(filledValue))) return 'empty';
  return data.some((r) => fieldsOf(r).every(filledValue)) ? 'filled' : 'partial';
}

// מה נשלח לשרת בשמירה אוטומטית
export const buildSavePayload = (intake) => ({ client: { intake: safeIntake(intake) } });

// טיוטה מקומית: מגינה על טקסט שעוד לא נשמר (רענון, ניתוק). הכול ב-try/catch – אחסון יכול להיחסם
export const draftKey = (id) => `pk_draft_${id}`;
export function readDraft(id) {
  try {
    const d = JSON.parse(localStorage.getItem(draftKey(id)) || 'null');
    return d && typeof d.at === 'number' && d.intake ? { at: d.at, intake: safeIntake(d.intake) } : null;
  } catch {
    return null;
  }
}
export function writeDraft(id, intake, at = Date.now()) {
  try {
    localStorage.setItem(draftKey(id), JSON.stringify({ at, intake }));
  } catch {
    // מצב פרטי / אחסון מלא – ממשיכים בלי טיוטה
  }
}
export function clearDraft(id) {
  try {
    localStorage.removeItem(draftKey(id));
  } catch {
    // אין מה לנקות
  }
}

// איזה עותק להציג בטעינה: הטיוטה רק אם היא חדשה יותר מהשמור בשרת
export function pickInitial(serverIntake, serverUpdatedAt, draft) {
  if (draft && draft.at > serverUpdatedAt) return { intake: draft.intake, fromDraft: true };
  return { intake: safeIntake(serverIntake), fromDraft: false };
}
