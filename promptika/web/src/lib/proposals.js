// פעולות טהורות על רשימת ההצעות של לקוח. גרסה ישנה לעולם לא משתנה בשכפול.
export const MAX_PROPOSALS = 50;

// החלפת הצעה אחת (לפי מזהה) – כל השאר נשארות אותו אובייקט
export const updateProposal = (list, pid, fn) => list.map((p) => (p.id === pid ? fn(p) : p));

// שכפול לגרסה חדשה: מזהה חדש, גרסה = הגבוהה + 1, תאריך עכשיו, תוכן מועתק (עותק עמוק)
export function duplicateProposal(list, pid, now, id) {
  const src = list.find((p) => p.id === pid);
  if (!src || list.length >= MAX_PROPOSALS) return null;
  const version = Math.max(0, ...list.map((p) => p.version || 0)) + 1;
  const copy = { ...JSON.parse(JSON.stringify(src)), id, version, createdAt: now };
  return { list: [...list, copy], created: copy };
}

export const newProposalId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

// ---- ברירות מחדל לגרסה: גרסה ישנה (לפני "המלצות") חסרה שדות ---------------------------------
export const VERDICTS = ['replace', 'keep', 'connect'];
const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
const list = (v) => (Array.isArray(v) ? v : []);

// שעות לפי שלב: מספר אחד (גרסה ישנה) נחשב "בנייה"
export function stagesOf(tool = {}) {
  const b = tool.buildHours;
  if (b && typeof b === 'object') return { spec: num(b.spec), build: num(b.build), test: num(b.test), training: num(b.training) };
  return { spec: 0, build: num(b), test: 0, training: 0 };
}
export const totalHours = (tool) => Math.round(Object.values(stagesOf(tool)).reduce((a, h) => a + h, 0) * 100) / 100;

export const normalizeTool = (t = {}) => ({
  ...t,
  kind: t.kind === 'replace' ? 'replace' : 'new',
  replaces: typeof t.replaces === 'string' ? t.replaces : '',
  whatItDoes: typeof t.whatItDoes === 'string' ? t.whatItDoes : '',
  screens: list(t.screens), integrations: list(t.integrations), notIncluded: list(t.notIncluded),
});

// גרסה בטוחה לתצוגה: currentSystems ו-kind / replaces / whatItDoes בברירת מחדל
export function normalizeProposal(p = {}) {
  return {
    ...p,
    currentSystems: list(p.currentSystems).map((s) => ({ name: s?.name || '', verdict: VERDICTS.includes(s?.verdict) ? s.verdict : 'keep', note: s?.note || '' })),
    tools: list(p.tools).map(normalizeTool),
    timeline: list(p.timeline),
  };
}

// כמה מערכות להחליף וכמה חדשות (לכרטיס הלקוח)
export function countKinds(p) {
  const tools = normalizeProposal(p).tools;
  const replace = tools.filter((t) => t.kind === 'replace').length;
  return { total: tools.length, replace, fresh: tools.length - replace };
}
