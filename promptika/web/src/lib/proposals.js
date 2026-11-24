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
