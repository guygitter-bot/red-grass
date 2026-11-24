// סיכום קצר בעברית להעתקה לוואטסאפ: כלים, עלות הקמה, עלות חודשית וצעד הבא. פונקציה טהורה.
import { packageCost, shekel, vatLabel } from './pricing';

export function buildSummary({ business = '', tools = [], settings, nextStep = '', packageLabel = '' }) {
  const c = packageCost(tools, settings);
  const lines = [];
  lines.push(business ? `הצעה עבור ${business}${packageLabel ? ` (${packageLabel})` : ''}` : 'הצעת מחיר');
  if (tools.length) {
    lines.push('', 'מה נבנה:');
    tools.forEach((t, i) => lines.push(`${i + 1}. ${t.name || 'כלי'}`));
  }
  lines.push('', `עלות הקמה: ${shekel(c.build)} (${vatLabel(settings)})`);
  lines.push(`עלות חודשית: ${shekel(c.monthly)} (${vatLabel(settings)})`);
  if (nextStep) lines.push('', `הצעד הבא: ${nextStep}`);
  return lines.join('\n');
}
