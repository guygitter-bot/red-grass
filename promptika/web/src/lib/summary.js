// סיכום קצר בעברית להעתקה לוואטסאפ: הבנה במשפט, המערכות לבנייה וצעד הבא. בלי כסף. פונקציה טהורה.
import { normalizeTool } from './proposals';

// משפט ראשון של ההבנה
const firstLine = (t = '') => {
  const m = String(t).trim().match(/^[^.!?\n]+[.!?]?/);
  return m ? m[0].trim() : '';
};

export function buildSummary({ business = '', understanding = '', tools = [], nextStep = '' }) {
  const lines = [];
  lines.push(business ? `המלצות למערכות – ${business}` : 'המלצות למערכות');
  const one = firstLine(understanding);
  if (one) lines.push(one);
  const list = tools.map(normalizeTool);
  if (list.length) {
    lines.push('', 'מה כדאי לבנות:');
    list.forEach((t, i) => {
      const inst = t.kind === 'replace' && t.replaces ? ` (במקום ${t.replaces})` : '';
      lines.push(`${i + 1}. ${t.name || 'מערכת'}${inst}`);
    });
  }
  if (nextStep) lines.push('', `הצעד הבא: ${nextStep}`);
  return lines.join('\n');
}
