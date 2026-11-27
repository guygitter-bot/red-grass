// "מה השתנה?" – תובנות מהנתונים, בלי AI: כמה עולה כל ספק בחודש, שינויי תעריף, חיובים כפולים אפשריים,
// חיובים שלא הגיעו, ביטוחים כפולים, מנויים ותשלומים שמסתיימים. פונקציות טהורות עם בדיקות (insights.test.js).
import { addMonths, lastMonth, monthName, monthSummary, money, monthsBetween } from './budget';

// ---------- ספק ----------

// ספקים מוכרים: כל מה שמתחיל במילה הזאת שייך לאותו ספק ("הראל ביטוח חיים" -> "הראל")
const KNOWN = [
  'חברת החשמל', 'ביטוח ישיר', 'ביטוח לאומי', 'מי אביבים', 'מי רמת גן', 'חוף הכרמל', 'כביש 6', 'רמי לוי תקשורת', 'רמי לוי',
  'סלקום', 'פרטנר', 'הוט', 'בזק', 'yes', 'גולן', 'הראל', 'מנורה', 'הפניקס', 'פניקס', 'כלל', 'מגדל', 'איילון', 'AIG',
  'מכבי', 'כללית', 'מאוחדת', 'לאומית', 'שופרסל', 'ויקטורי', 'יוחננוף', 'סופר-פארם', 'סופר פארם', 'פז', 'סונול', 'דור אלון',
  'וולט', 'wolt', 'netflix', 'נטפליקס', 'spotify', 'ספוטיפיי', 'apple', 'google', 'גוגל', 'amazon', 'microsoft', 'anthropic', 'openai',
  'פנגו', 'pango', 'סלופארק', 'איתוראן', 'פלאפון', 'מקס', 'כאל', 'ישראכרט',
];
const ALIASES = { 'פניקס': 'הפניקס', 'סופר פארם': 'סופר-פארם', wolt: 'וולט', 'נטפליקס': 'netflix', 'ספוטיפיי': 'spotify', 'גוגל': 'google' };

// שם ספק אחיד מתוך שם של הוצאה
export function supplierOf(name) {
  const s = String(name || '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/["'״׳]/g, '')
    .replace(/\s+-\s+.*$/, '')
    .replace(/\b(בעמ|בע מ|ltd|inc|com|co)\b/gi, ' ')
    .replace(/(חיוב|תשלום)\s*\d+(\s*\/\s*\d+)?/g, ' ')
    .replace(/\d{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const lower = s.toLowerCase();
  for (const k of KNOWN) {
    if (lower === k.toLowerCase() || lower.startsWith(`${k.toLowerCase()} `) || lower.startsWith(`${k.toLowerCase()}-`)) return ALIASES[k] || k;
  }
  return s || String(name || '').trim();
}

// כל ההוצאות של חודש לפי ספק: [{ supplier, total, lines, category, prev, change }] מהגדול לקטן
export function bySupplier(data, month) {
  const group = (m) => {
    const map = new Map();
    for (const l of monthSummary(data, m).lines) {
      if (l.item.kind !== 'expense' || !l.amount) continue;
      const key = supplierOf(l.item.name);
      if (!map.has(key)) map.set(key, { supplier: key, total: 0, lines: [], category: l.item.category || 'אחר' });
      const g = map.get(key);
      g.total += l.amount;
      g.lines.push(l);
    }
    return map;
  };
  const now = group(month);
  const before = group(addMonths(month, -1));
  return [...now.values()]
    .map((g) => {
      const prev = before.get(g.supplier)?.total ?? null;
      return { ...g, prev, change: prev ? g.total - prev : null };
    })
    .sort((a, b) => b.total - a.total);
}

// ---------- ממצאים ----------

const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : 0);
const near = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.01);
// הוצאה שיובאה מקובץ (תנועה בפועל) – לעומת מה שהוזן ידנית
const imported = (item) => /^t[xi]/.test(item.id);

const INSURANCE = [
  ['ביטוח חיים', /חיים/],
  ['ביטוח בריאות', /בריאות/],
  ['ביטוח רכב', /רכב|מקיף|חובה|צד ג/],
  ['ביטוח דירה', /דירה|מבנה|תכולה/],
];

// כל הממצאים לחודש: [{ id, kind, level: 'urgent'|'check'|'info', title, text, supplier, amount }]
// kind: price (שינוי תעריף) | spike (עלייה חריגה) | double (חיוב כפול) | missing (לא הגיע) | overlap (כפל ביטוח/ספקים)
//       | ending (תשלומים שמסתיימים) | subscriptions (מנויים)
export function findings(data, month) {
  const out = [];
  const add = (f) => out.push({ id: `${f.kind}:${f.supplier || f.title}`, ...f });
  const prevMonth = addMonths(month, -1);
  const now = monthSummary(data, month);
  const expenses = now.lines.filter((l) => l.item.kind === 'expense' && l.amount > 0);

  // שינוי תעריף בהוצאה קבועה לעומת החודש הקודם (סכום שונה לחודש, או קבועה שהשתנתה)
  const prevLines = new Map(monthSummary(data, prevMonth).lines.map((l) => [l.item.id, l]));
  for (const l of expenses) {
    if (l.item.type === 'once') continue;
    const p = prevLines.get(l.item.id);
    if (!p || !p.amount || l.skipped || p.skipped) continue;
    const diff = l.amount - p.amount;
    if (Math.abs(diff) < 5 || Math.abs(diff) / p.amount < 0.03) continue;
    add({
      kind: 'price',
      level: diff > 0 ? 'urgent' : 'info',
      supplier: supplierOf(l.item.name),
      amount: diff,
      title: `${diff > 0 ? 'התייקר' : 'הוזל'}: ${l.item.name}`,
      text: `${money(p.amount)} ב${monthName(prevMonth)} ← ${money(l.amount)} ב${monthName(month)} (${diff > 0 ? '+' : ''}${pct(l.amount, p.amount)}%)`,
    });
  }

  // עלייה חריגה אצל ספק לעומת הממוצע של 3 החודשים הקודמים (כשהוא הופיע לפחות ב-2 מהם)
  const suppliers = bySupplier(data, month);
  for (const s of suppliers) {
    const hist = [1, 2, 3].map((i) => bySupplier(data, addMonths(month, -i)).find((x) => x.supplier === s.supplier)?.total || 0).filter(Boolean);
    if (hist.length < 2) continue;
    const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
    if (s.total - avg > 30 && s.total > avg * 1.25 && !out.some((f) => f.kind === 'price' && f.supplier === s.supplier)) {
      add({ kind: 'spike', level: 'check', supplier: s.supplier, amount: s.total - avg, title: `עלייה חריגה: ${s.supplier}`, text: `${money(s.total)} החודש, לעומת ממוצע של ${money(avg)} בחודשים הקודמים (+${pct(s.total, avg)}%)` });
    }
  }

  // חיוב כפול אפשרי: אותו ספק, אותו סכום, פעמיים באותו חודש
  const seen = new Map();
  for (const l of expenses) {
    if (l.amount < 20) continue;
    const key = supplierOf(l.item.name);
    const twin = (seen.get(key) || []).find((o) => near(o.amount, l.amount));
    if (twin) {
      const both = [twin, l];
      const mixed = both.some((x) => imported(x.item)) && both.some((x) => !imported(x.item));
      add({
        kind: 'double',
        level: 'urgent',
        supplier: key,
        amount: l.amount,
        title: `חיוב כפול אפשרי: ${key}`,
        text: mixed
          ? `"${twin.item.name}" ו-"${l.item.name}" – ${money(l.amount)} כל אחד. אולי אותה הוצאה נרשמה גם ידנית וגם מהקובץ`
          : `${money(l.amount)} פעמיים ב${monthName(month)} ("${twin.item.name}"). לבדוק אם חויבתם פעמיים`,
      });
    }
    seen.set(key, [...(seen.get(key) || []), l]);
  }

  // חיוב שלא הגיע: ספק שחייב בפועל (מקובץ) בכל אחד מ-3 החודשים הקודמים, ולא החודש – כשכבר יובאו תנועות לחודש הזה
  if (expenses.some((l) => imported(l.item))) {
    const actual = (m) => new Set(monthSummary(data, m).lines.filter((l) => l.item.kind === 'expense' && imported(l.item)).map((l) => supplierOf(l.item.name)));
    const nowSet = actual(month);
    const [a, b, c] = [1, 2, 3].map((i) => actual(addMonths(month, -i)));
    for (const s of a) {
      if (b.has(s) && c.has(s) && !nowSet.has(s)) add({ kind: 'missing', level: 'check', supplier: s, title: `לוודא: ${s}`, text: `חויב בכל אחד משלושת החודשים הקודמים, ועדיין לא הופיע ב${monthName(month)}` });
    }
  }

  // כפל ביטוחים: אותו סוג ביטוח אצל כמה חברות
  for (const [type, re] of INSURANCE) {
    const lines = expenses.filter((l) => /ביטוח|הראל|מנורה|הפניקס|פניקס|כלל|מגדל|איילון|ישיר/.test(`${l.item.name} ${l.item.category}`) && re.test(l.item.name));
    const companies = [...new Set(lines.map((l) => supplierOf(l.item.name)))];
    if (companies.length >= 2) {
      const total = lines.reduce((x, l) => x + l.amount, 0);
      add({ kind: 'overlap', level: 'check', supplier: type, amount: total, title: `${type} אצל ${companies.length} חברות`, text: `${companies.join(', ')} – ${money(total)} בחודש. כדאי לבדוק אם יש כפל כיסוי` });
    }
  }

  // תשלומים והלוואות שמסתיימים החודש או בחודש הבא
  const ending = data.items.filter((i) => i.kind === 'expense' && i.type === 'installments' && [0, 1].includes(monthsBetween(month, lastMonth(i))));
  if (ending.length) {
    const total = ending.reduce((x, i) => x + i.amount, 0);
    add({ kind: 'ending', level: 'info', title: 'תשלומים שמסתיימים', amount: total, text: `${ending.map((i) => i.name).join(', ')} – יתפנו ${money(total)} בחודש` });
  }

  // מנויים
  const subs = expenses.filter((l) => /מנוי/.test(l.item.category));
  if (subs.length >= 3) {
    const total = subs.reduce((x, l) => x + l.amount, 0);
    add({ kind: 'subscriptions', level: 'info', title: `${subs.length} מנויים`, amount: total, text: `${money(total)} בחודש (${money(total * 12)} בשנה). לעבור ולבטל מה שלא בשימוש` });
  }

  // עלייה שנובעת מחיוב כפול – מספיק הממצא של החיוב הכפול
  const doubles = new Set(out.filter((x) => x.kind === 'double').map((x) => x.supplier));
  const order = { urgent: 0, check: 1, info: 2 };
  return out.filter((x) => !(x.kind === 'spike' && doubles.has(x.supplier))).sort((x, y) => order[x.level] - order[y.level] || Math.abs(y.amount || 0) - Math.abs(x.amount || 0));
}

// מספרים לראש המסך
export function headline(data, month) {
  const s = monthSummary(data, month);
  const f = findings(data, month);
  return {
    expense: s.expense,
    income: s.income,
    net: s.net,
    suppliers: bySupplier(data, month).length,
    urgent: f.filter((x) => x.level === 'urgent').length,
    raises: f.filter((x) => (x.kind === 'price' && x.amount > 0) || x.kind === 'spike').length,
    toCheck: f.filter((x) => x.kind === 'missing' || x.kind === 'double').length,
    findings: f,
  };
}

// תקציר הממצאים בשביל ה-AI
export function findingsText(data, month) {
  const f = findings(data, month);
  if (!f.length) return '';
  return ['ממצאים אוטומטיים לחודש הזה:', ...f.map((x) => `- ${x.title}: ${x.text}`)].join('\n');
}
