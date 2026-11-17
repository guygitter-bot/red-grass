// חישובים לדף העלויות (פונקציות טהורות)
export const ROUTER = 'router';

// פירוק לפי בוט, מהגבוה לנמוך, עם אחוז מהגבוה ביותר (לפס)
export function agentRows(agentsUsd = {}, agents = []) {
  const rows = Object.entries(agentsUsd).map(([key, usd]) => {
    if (key === ROUTER) return { key, label: 'ניתוב (מי עונה)', emoji: '🧭', usd };
    if (key === 'images') return { key, label: 'תמונות (Google)', emoji: '🖼️', usd };
    const a = agents.find((x) => x.key === key);
    return { key, label: a ? a.name : key, emoji: a ? a.emoji : '🤖', usd };
  });
  rows.sort((a, b) => b.usd - a.usd);
  const max = rows[0]?.usd || 0;
  return rows.map((r) => ({ ...r, pct: max ? Math.max(3, Math.round((r.usd / max) * 100)) : 0 }));
}

// ימי החודש מהאחרון לראשון
export function dayRows(days = {}) {
  return Object.entries(days)
    .map(([day, usd]) => ({ day, usd }))
    .sort((a, b) => Number(b.day) - Number(a.day));
}
