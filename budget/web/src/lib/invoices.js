// חשבוניות שנאספו מהמייל: לפי ספק, שינויים בין חשבונית לחשבונית, סעיפים חדשים, חשבוניות חסרות וכפולות.
// פונקציות טהורות עם בדיקות (invoices.test.js). השם של הספק מאוחד כמו בשאר האפליקציה (supplierOf).
import { money } from './budget';
import { supplierOf } from './insights';

const DAY = 24 * 60 * 60 * 1000;
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : 0);
const median = (list) => {
  const s = [...list].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

// אורך תקופת החיוב בימים (0 = לא ידוע)
const periodDays = (inv) => (inv.periodFrom && inv.periodTo ? Math.max(1, days(inv.periodFrom, inv.periodTo) + 1) : 0);

// כל החשבוניות לפי ספק: [{ supplier, category, invoices (מהחדשה), last, prev, change, gap }]
export function invoicesBySupplier(data) {
  const map = new Map();
  for (const inv of data.invoices || []) {
    if (!inv.date) continue;
    const key = supplierOf(inv.supplier);
    if (!map.has(key)) map.set(key, { supplier: key, category: inv.category, invoices: [] });
    map.get(key).invoices.push(inv);
  }
  return [...map.values()]
    .map((g) => {
      const list = g.invoices.sort((a, b) => b.date.localeCompare(a.date));
      const [last, prev] = list;
      const gaps = list.slice(0, -1).map((inv, i) => days(list[i + 1].date, inv.date)).filter((d) => d > 5);
      return { ...g, invoices: list, last, prev: prev || null, change: prev ? comparable(last, prev) : null, gap: median(gaps) };
    })
    .sort((a, b) => b.last.date.localeCompare(a.last.date));
}

// שינוי בין שתי חשבוניות; כשהתקופות באורך שונה (חודש מול חודשיים) – משווים לפי 30 יום
export function comparable(last, prev) {
  const dl = periodDays(last);
  const dp = periodDays(prev);
  const scaled = dl && dp && Math.abs(dl - dp) / dp > 0.2;
  const a = scaled ? (last.amount / dl) * 30 : last.amount;
  const b = scaled ? (prev.amount / dp) * 30 : prev.amount;
  return { diff: a - b, pct: pct(a, b), perMonth: scaled };
}

// ממצאים מהחשבוניות, נכון ליום today ('YYYY-MM-DD'): אותו מבנה כמו findings ב-insights.js
export function invoiceFindings(data, today) {
  const out = [];
  const add = (f) => out.push({ id: `${f.kind}:${f.supplier}`, ...f });
  for (const s of invoicesBySupplier(data)) {
    const { last, prev, change } = s;

    // שינוי תעריף בין שתי החשבוניות האחרונות
    if (change && Math.abs(change.diff) >= 5 && Math.abs(change.pct) >= 5) {
      add({
        kind: 'invoice-price',
        level: change.diff > 0 ? 'urgent' : 'info',
        supplier: s.supplier,
        amount: change.diff,
        title: `${change.diff > 0 ? 'החשבונית עלתה' : 'החשבונית ירדה'}: ${s.supplier}`,
        text: `${money(prev.amount)} ← ${money(last.amount)} (${change.pct > 0 ? '+' : ''}${change.pct}%${change.perMonth ? ', לפי חודש' : ''})${last.plan ? ` · ${last.plan}` : ''}`,
      });
    }

    // סעיף חדש בחשבונית האחרונה
    if (prev && prev.items.length) {
      const before = new Set(prev.items.map((i) => i.name));
      const added = last.items.filter((i) => !before.has(i.name) && i.amount > 0);
      if (added.length) {
        add({
          kind: 'invoice-item',
          level: 'check',
          supplier: s.supplier,
          amount: added.reduce((x, i) => x + i.amount, 0),
          title: `סעיף חדש בחשבונית: ${s.supplier}`,
          text: added.map((i) => `${i.name} (${money(i.amount)})`).join(', '),
        });
      }
    }

    // חשבונית כפולה: אותו סכום, פחות מ-10 ימים בין שתיים
    if (prev && Math.abs(last.amount - prev.amount) < 1 && last.amount > 0 && days(prev.date, last.date) < 10 && last.id !== prev.id) {
      add({ kind: 'invoice-double', level: 'urgent', supplier: s.supplier, amount: last.amount, title: `חשבונית כפולה אפשרית: ${s.supplier}`, text: `${money(last.amount)} פעמיים בהפרש של ${days(prev.date, last.date)} ימים – לבדוק שלא חויבתם פעמיים` });
    }

    // חשבונית חסרה: ספק קבוע (3 חשבוניות ומעלה) שלא שלח בזמן הרגיל שלו
    if (s.invoices.length >= 3 && s.gap >= 20) {
      const late = days(last.date, today);
      if (late > s.gap * 1.5 + 7) {
        add({ kind: 'invoice-missing', level: 'check', supplier: s.supplier, title: `חשבונית חסרה: ${s.supplier}`, text: `בדרך כלל מגיעה כל ${s.gap} ימים, והאחרונה מ-${last.date.split('-').reverse().join('/')}` });
      }
    }

    // הודעה חשובה בתוך החשבונית (שינוי מחיר, הנחה שמסתיימת, חוב, זיכוי)
    if (last.notes && days(last.date, today) <= 45) {
      add({ kind: 'invoice-note', level: 'info', supplier: s.supplier, title: `לשים לב בחשבונית: ${s.supplier}`, text: last.notes });
    }
  }
  return out;
}

// כמה חשבוניות הגיעו בכל חודש (לתצוגה)
export function invoicesInMonth(data, month) {
  return (data.invoices || []).filter((i) => i.date.startsWith(month));
}

export function invoicesText(data, today) {
  const bySup = invoicesBySupplier(data).slice(0, 25);
  if (!bySup.length) return '';
  return [
    'חשבוניות שנאספו מהמייל (האחרונה לכל ספק):',
    ...bySup.map((s) => `- ${s.supplier}${s.last.service ? ` (${s.last.service})` : ''}: ${money(s.last.amount)} ב-${s.last.date}${s.prev ? `, הקודמת ${money(s.prev.amount)}` : ''}${s.last.plan ? `, מסלול: ${s.last.plan}` : ''}${s.last.items.length ? `, סעיפים: ${s.last.items.map((i) => `${i.name} ${Math.round(i.amount)}`).join('; ')}` : ''}`),
  ].join('\n');
}
