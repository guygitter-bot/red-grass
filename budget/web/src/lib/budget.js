// החישובים של התקציב – פונקציות טהורות (בלי React), עם בדיקות ב-budget.test.js.
//
// רשומות (כולן עם id ו-updatedAt, ומסתנכרנות בין המכשירים):
//   item     – הכנסה או הוצאה:
//              { t: 'item', kind: 'income' | 'expense', type: 'fixed' | 'installments' | 'once',
//                name, category, amount, start: 'YYYY-MM', end?: 'YYYY-MM' (קבועה), every?: 1|2|3|6|12 (קבועה),
//                count?: מספר תשלומים, note? }
//   override – סכום אחר לרשומה בחודש אחד: { t: 'override', itemId, month: 'YYYY-MM', amount } (0 = לא בחודש הזה)
//   settings – { id: 'settings', t: 'settings', balance, balanceMonth } יתרה בבנק בתחילת חודש
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
  let settings = { balance: null, balanceMonth: '' };
  for (const r of records) {
    if (!r || r.deleted) continue;
    if (r.t === 'item') items.push(safeItem(r));
    else if (r.t === 'override' && isMonth(r.month)) overrides.set(`${r.itemId}:${r.month}`, num(r.amount));
    else if (r.t === 'settings') {
      settings = {
        balance: r.balance === '' || r.balance == null || !Number.isFinite(Number(r.balance)) ? null : Number(r.balance),
        balanceMonth: isMonth(r.balanceMonth) ? r.balanceMonth : '',
      };
    }
  }
  items.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'he'));
  return { items, overrides, settings };
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
