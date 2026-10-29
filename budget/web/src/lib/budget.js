// החישובים של התקציב – פונקציות טהורות (בלי React), עם בדיקות ב-budget.test.js.
//
// רשומות (כולן עם id ו-updatedAt, ומסתנכרנות בין המכשירים):
//   item     – הכנסה או הוצאה:
//              { t: 'item', kind: 'income' | 'expense', type: 'fixed' | 'installments' | 'once',
//                name, category, amount, start: 'YYYY-MM', end?: 'YYYY-MM' (קבועה), every?: 1|2|3|6|12 (קבועה),
//                count?: מספר תשלומים, payment?: אמצעי תשלום (למשל "כ\"א 1234"), note? }
//   override – סכום אחר לרשומה בחודש אחד: { t: 'override', itemId, month: 'YYYY-MM', amount } (0 = לא בחודש הזה)
//   settings – { id: 'settings', t: 'settings', balance, balanceMonth } יתרה בבנק בתחילת חודש
//   card     – חיוב כרטיס אשראי בפועל בחודש (מעקב בלבד, לא נכנס לסיכום): { t: 'card', name, month, amount }
//              המזהה: card:<name>:<month>
//   insight  – תשובה של ה-AI שנשמרה: { t: 'insight', question, answer, month, at }
// רשומה ישנה בלי שדה מסוים מקבלת ברירת מחדל (ראו safeItem).

export const TYPES = {
  fixed: 'קבועה',
  installments: 'תשלומים',
  once: 'חד־פעמית',
};

export const EVERY = { 1: 'כל חודש', 2: 'כל חודשיים', 3: 'כל רבעון', 6: 'כל חצי שנה', 12: 'פעם בשנה' };

export const CATEGORIES = {
  expense: ['דיור', 'חשבונות הבית', 'תקשורת', 'ביטוחים', 'רכב ותחבורה', 'ילדים וחינוך', 'בריאות', 'מנויים', 'הלוואות', 'חיסכון', 'מזון וקניות', 'כרטיסי אשראי', 'אחר'],
  income: ['משכורת', 'קצבאות', 'שכירות', 'החזרים', 'אחר'],
};

const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

const isMonth = (m) => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

export function thisMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

// כמה חודשים מ-a עד b (b מאוחר = חיובי)
export function monthsBetween(a, b) {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

export function monthName(month, short = false) {
  const [y, m] = month.split('-').map(Number);
  return short ? `${MONTH_NAMES[m - 1]} ${String(y).slice(2)}` : `${MONTH_NAMES[m - 1]} ${y}`;
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// רשומה עם ברירות מחדל לכל שדה (גם לנתונים ישנים)
export function safeItem(r) {
  const type = TYPES[r.type] ? r.type : 'fixed';
  return {
    ...r,
    kind: r.kind === 'income' ? 'income' : 'expense',
    type,
    name: String(r.name || ''),
    category: String(r.category || ''),
    amount: num(r.amount),
    start: isMonth(r.start) ? r.start : thisMonth(new Date(r.updatedAt || Date.now())),
    end: type === 'fixed' && isMonth(r.end) ? r.end : '',
    every: [1, 2, 3, 6, 12].includes(Number(r.every)) ? Number(r.every) : 1,
    count: Math.max(1, Math.round(num(r.count)) || 1),
    payment: String(r.payment || ''),
    note: String(r.note || ''),
  };
}

// החודש האחרון שבו הרשומה פעילה ('' = בלי סוף)
export function lastMonth(item) {
  if (item.type === 'once') return item.start;
  if (item.type === 'installments') return addMonths(item.start, item.count - 1);
  return item.end || '';
}

// האם הרשומה חלה בחודש הזה? -> { amount, index?, count? } או null
export function occurrence(item, month) {
  const diff = monthsBetween(item.start, month);
  if (diff < 0) return null;
  if (item.type === 'once') return diff === 0 ? { amount: item.amount } : null;
  if (item.type === 'installments') return diff < item.count ? { amount: item.amount, index: diff + 1, count: item.count } : null;
  if (item.end && monthsBetween(item.end, month) > 0) return null;
  return diff % item.every === 0 ? { amount: item.amount } : null;
}

// מפרק את כל הרשומות (מכל הסוגים) למבנה נוח לחישוב
export function prepare(records) {
  const items = [];
  const overrides = new Map();
  const cards = [];
  const insights = [];
  let settings = { balance: null, balanceMonth: '' };
  for (const r of records) {
    if (!r || r.deleted) continue;
    if (r.t === 'item') items.push(safeItem(r));
    else if (r.t === 'override' && isMonth(r.month)) overrides.set(`${r.itemId}:${r.month}`, num(r.amount));
    else if (r.t === 'card' && isMonth(r.month) && r.name) cards.push({ id: r.id, name: String(r.name), month: r.month, amount: num(r.amount) });
    else if (r.t === 'insight' && r.answer) insights.push({ id: r.id, question: String(r.question || ''), answer: String(r.answer), month: r.month || '', at: num(r.at || r.updatedAt) });
    else if (r.t === 'settings') {
      settings = {
        balance: r.balance === '' || r.balance == null || !Number.isFinite(Number(r.balance)) ? null : Number(r.balance),
        balanceMonth: isMonth(r.balanceMonth) ? r.balanceMonth : '',
      };
    }
  }
  items.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'he'));
  insights.sort((a, b) => b.at - a.at);
  return { items, overrides, settings, cards, insights };
}

// כל השורות של חודש אחד + סיכום
export function monthSummary(data, month) {
  const lines = [];
  let income = 0;
  let expense = 0;
  for (const item of data.items) {
    const occ = occurrence(item, month);
    if (!occ) continue;
    const key = `${item.id}:${month}`;
    const changed = data.overrides.has(key);
    const amount = changed ? data.overrides.get(key) : occ.amount;
    lines.push({ item, ...occ, amount, planned: occ.amount, changed, skipped: changed && amount === 0 });
    if (item.kind === 'income') income += amount;
    else expense += amount;
  }
  return { month, lines, income, expense, net: income - expense };
}

// תחזית לכמה חודשים, כולל יתרה צפויה בבנק בסוף כל חודש (אם נקבעה יתרת פתיחה)
export function forecast(data, from, count) {
  const { balance, balanceMonth } = data.settings;
  const hasBalance = balance != null && balanceMonth;
  let running = null;
  if (hasBalance && monthsBetween(balanceMonth, from) >= 0) {
    running = balance;
    for (let m = balanceMonth; m !== from; m = addMonths(m, 1)) running += monthSummary(data, m).net;
  }
  const out = [];
  for (let i = 0; i < count; i++) {
    const month = addMonths(from, i);
    const s = monthSummary(data, month);
    if (hasBalance && month === balanceMonth) running = balance;
    if (running != null) running += s.net;
    out.push({ ...s, balance: running });
  }
  return out;
}

// סכום לפי קטגוריה (הוצאות או הכנסות) בחודש אחד, מהגדול לקטן
export function byCategory(summary, kind = 'expense') {
  const map = new Map();
  for (const l of summary.lines) {
    if (l.item.kind !== kind || !l.amount) continue;
    const c = l.item.category || 'אחר';
    map.set(c, (map.get(c) || 0) + l.amount);
  }
  return [...map].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

// טבלה לאקסל (CSV): שורה לכל רשומה, עמודה לכל חודש, ושורות סיכום
export function toCsv(data, from, count) {
  const months = Array.from({ length: count }, (_, i) => addMonths(from, i));
  const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const rows = [['סוג', 'שם', 'קטגוריה', 'אופן', ...months.map((m) => monthName(m, true))]];
  const sums = months.map((m) => monthSummary(data, m));
  for (const kind of ['income', 'expense']) {
    for (const item of data.items.filter((i) => i.kind === kind)) {
      const vals = sums.map((s) => s.lines.find((l) => l.item.id === item.id)?.amount ?? '');
      if (vals.every((v) => v === '')) continue;
      rows.push([kind === 'income' ? 'הכנסה' : 'הוצאה', item.name, item.category, TYPES[item.type], ...vals]);
    }
  }
  const f = forecast(data, from, count);
  rows.push([]);
  rows.push(['', 'סה״כ הכנסות', '', '', ...f.map((s) => s.income)]);
  rows.push(['', 'סה״כ הוצאות', '', '', ...f.map((s) => s.expense)]);
  rows.push(['', 'נשאר', '', '', ...f.map((s) => s.net)]);
  if (f.some((s) => s.balance != null)) rows.push(['', 'יתרה צפויה', '', '', ...f.map((s) => (s.balance == null ? '' : Math.round(s.balance)))]);
  // BOM כדי שאקסל יקרא עברית נכון
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

export function money(n, sign = false) {
  const v = Math.round(num(n));
  const s = `₪${Math.abs(v).toLocaleString('he-IL')}`;
  if (v < 0) return `‎-${s}`;
  return sign && v > 0 ? `‎+${s}` : s;
}

// הפירוט של שורה, כמו בעמודה "פירוט" באקסל: קבוע / 3/10 / חד־פעמי
export function lineDetail(line) {
  const { item } = line;
  if (item.type === 'installments') return `${line.index}/${line.count}`;
  if (item.type === 'once') return 'חד־פעמי';
  return item.every > 1 ? EVERY[item.every] : 'קבוע';
}

// הדוח החודשי בחלוקה לקטגוריות (כמו בגיליון החודשי באקסל): קבוצות הוצאות לפי קטגוריה, מהגדולה לקטנה,
// ובסוף ההכנסות. כל קבוצה: { category, kind, lines, total }
export function reportGroups(summary) {
  const groups = new Map();
  for (const l of summary.lines) {
    const kind = l.item.kind;
    const category = kind === 'income' ? 'הכנסות' : l.item.category || 'אחר';
    const key = `${kind}:${category}`;
    if (!groups.has(key)) groups.set(key, { category, kind, lines: [], total: 0 });
    const g = groups.get(key);
    g.lines.push(l);
    g.total += l.amount;
  }
  const list = [...groups.values()];
  return [...list.filter((g) => g.kind === 'expense').sort((a, b) => b.total - a.total), ...list.filter((g) => g.kind === 'income')];
}

// חיובי כרטיסי האשראי לפי חודש: { months: [...], names: [...], rows: [{ month, total, byName: {name: amount} }] }
export function cardTable(data) {
  const names = [...new Set(data.cards.map((c) => c.name))];
  const byMonth = new Map();
  for (const c of data.cards) {
    if (!byMonth.has(c.month)) byMonth.set(c.month, { month: c.month, total: 0, byName: {} });
    const row = byMonth.get(c.month);
    row.byName[c.name] = (row.byName[c.name] || 0) + c.amount;
    row.total += c.amount;
  }
  const rows = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  return { names, rows };
}

// הוצאות שמסתיימות בקרוב (תשלומים והלוואות) – כמה יתפנה בכל חודש
export function endingSoon(data, from, months = 6) {
  const out = [];
  for (const item of data.items) {
    if (item.kind !== 'expense' || item.type === 'once') continue;
    const end = lastMonth(item);
    if (!end) continue;
    const diff = monthsBetween(from, end);
    if (diff >= 0 && diff < months) out.push({ item, end });
  }
  return out.sort((a, b) => a.end.localeCompare(b.end) || b.item.amount - a.item.amount);
}

// סיכום טקסט קצר של כל התקציב בשביל ה-AI (בלי שום פרט מזהה מעבר למה שהמשתמש כתב בשמות)
export function aiContext(data, month) {
  const r = (n) => Math.round(n);
  const lines = [];
  const past = forecast(data, addMonths(month, -6), 6);
  const next = forecast(data, month, 7);
  lines.push(`החודש הנוכחי: ${monthName(month)}`);
  lines.push('סיכום לפי חודשים (הכנסות / הוצאות / נשאר / יתרה צפויה):');
  for (const s of [...past, ...next]) {
    lines.push(`- ${monthName(s.month)}: ${r(s.income)} / ${r(s.expense)} / ${r(s.net)}${s.balance == null ? '' : ` / ${r(s.balance)}`}`);
  }
  lines.push('');
  lines.push(`פירוט ${monthName(month)} לפי קטגוריה:`);
  for (const g of reportGroups(next[0])) {
    lines.push(`* ${g.category} (${g.kind === 'income' ? 'הכנסה' : 'הוצאה'}) – סה״כ ${r(g.total)}`);
    for (const l of g.lines) {
      const extra = [lineDetail(l), l.item.payment, l.item.note].filter(Boolean).join(', ');
      lines.push(`  - ${l.item.name}: ${r(l.amount)}${extra ? ` (${extra})` : ''}`);
    }
  }
  const ending = endingSoon(data, month, 12);
  if (ending.length) {
    lines.push('');
    lines.push('תשלומים והוצאות שמסתיימים ב-12 החודשים הקרובים:');
    for (const e of ending) lines.push(`- ${e.item.name}: ${r(e.item.amount)} לחודש, אחרון ב${monthName(e.end)}`);
  }
  const { names, rows } = cardTable(data);
  if (rows.length) {
    lines.push('');
    lines.push(`חיובי כרטיסי אשראי בפועל (${names.join(', ')}), סה״כ לחודש:`);
    for (const row of rows.slice(-12)) lines.push(`- ${monthName(row.month)}: ${r(row.total)}`);
  }
  return lines.join('\n');
}
