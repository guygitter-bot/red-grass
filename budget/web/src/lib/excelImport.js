// ייבוא מקובץ האקסל של המשפחה: גיליון לכל חודש (שם כמו "08.26") עם קטגוריות, ו"מעקב כרטיסים".
// בגיליון חודשי: כותרת "סכום" מסמנת עמודת סכומים; משמאלה השם, מימינה "פירוט" (קבוע / 3/10 / משוער) ואחריה
// אמצעי התשלום (אם יש). שורה בלי סכום אחרי "סה"כ" = כותרת של קטגוריה. הקטגוריה "הכנסות" = הכנסות.
// מכל החודשים יחד נבנות רשומות: תשלומים (לפי "3/10"), קבועות (עם סכום שונה בחודשים שבהם היה אחר) וחד־פעמיות.
// המזהים קבועים לפי השם – ייבוא חוזר של אותו קובץ מעדכן ולא מכפיל.
import { addMonths, monthsBetween } from './budget';

const HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

const col = (ref) => ref.match(/^[A-Z]+/)[0];
const row = (ref) => Number(ref.match(/\d+$/)[0]);
const colNum = (c) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const colName = (n) => (n <= 26 ? String.fromCharCode(64 + n) : colName(Math.floor((n - 1) / 26)) + String.fromCharCode(65 + ((n - 1) % 26)));
const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const isTotal = (s) => /^סה["״']?כ|^סהכ/.test(s);
const isEnd = (s) => /^(סה["״']?כ|סהכ)\s*(הכנסות|הוצאות|מאזן)|^יתרה/.test(s);

function hash(s) {
  let h = 5381;
  for (const ch of s) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return h.toString(36);
}

// "08.26" / "8.2026" -> "2026-08"
export function sheetMonth(name) {
  const m = clean(name).match(/^(\d{1,2})[./-](\d{2}|\d{4})$/);
  if (!m || +m[1] < 1 || +m[1] > 12) return '';
  const y = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  return `${y}-${String(m[1]).padStart(2, '0')}`;
}

// כל השורות של גיליון חודשי: [{ category, name, amount, detail, payment }]
export function readMonthSheet(cells) {
  const grid = new Map();
  let maxRow = 0;
  for (const [ref, v] of cells) {
    grid.set(ref, v);
    maxRow = Math.max(maxRow, row(ref));
  }
  // עמודות הסכומים: איפה שכתוב "סכום" (בשורות הראשונות)
  const amountCols = [...cells]
    .filter(([ref, v]) => row(ref) <= 12 && clean(v) === 'סכום')
    .map(([ref]) => ({ c: colNum(col(ref)), r: row(ref) }))
    .sort((a, b) => a.c - b.c);
  const out = [];
  for (const [i, { c, r }] of amountCols.entries()) {
    const next = amountCols[i + 1]?.c;
    const L = colName(c - 1);
    const A = colName(c);
    const D = colName(c + 1);
    // אמצעי התשלום – רק אם העמודה לא שייכת כבר לבלוק הבא
    const P = !next || c + 2 < next - 1 ? colName(c + 2) : null;
    let category = '';
    let pending = true;
    for (let y = r + 1; y <= maxRow; y++) {
      const label = clean(grid.get(`${L}${y}`));
      if (!label) continue;
      if (isEnd(label)) break;
      if (isTotal(label)) {
        pending = true;
        continue;
      }
      const raw = grid.get(`${A}${y}`);
      const amount = typeof raw === 'number' ? raw : Number(clean(raw).replace(/[,₪\s]/g, ''));
      const hasAmount = clean(raw) !== '' && Number.isFinite(amount);
      if (pending && !hasAmount) {
        category = label;
        pending = false;
        continue;
      }
      pending = false;
      if (!hasAmount || amount <= 0) continue;
      out.push({ category, name: label, amount: Math.round(amount * 100) / 100, detail: clean(grid.get(`${D}${y}`)), payment: P ? clean(grid.get(`${P}${y}`)) : '' });
    }
  }
  return out;
}

// גיליון מעקב כרטיסים: שורת חודשים (ינואר, פברואר...) ומתחתיה שורה לכל כרטיס עד "סה"כ"
export function readCardSheet(cells) {
  const byRow = new Map();
  for (const [ref, v] of cells) {
    const r = row(ref);
    if (!byRow.has(r)) byRow.set(r, []);
    byRow.get(r).push([col(ref), v]);
  }
  const rows = [...byRow.keys()].sort((a, b) => a - b);
  const headRow = rows.find((r) => byRow.get(r).filter(([, v]) => HEB_MONTHS.includes(clean(v))).length >= 3);
  if (!headRow) return [];
  const years = [...cells].filter(([ref]) => row(ref) < headRow).map(([, v]) => clean(v).match(/\b(20\d\d)\b/)?.[1]).filter(Boolean).map(Number);
  let year = years.length ? Math.min(...years) : new Date().getFullYear();
  const months = new Map();
  let prev = -1;
  for (const [c, v] of byRow.get(headRow).sort((a, b) => colNum(a[0]) - colNum(b[0]))) {
    const idx = HEB_MONTHS.indexOf(clean(v));
    if (idx < 0) continue;
    if (idx <= prev) year += 1;
    prev = idx;
    months.set(c, `${year}-${String(idx + 1).padStart(2, '0')}`);
  }
  const labelCol = Math.min(...[...months.keys()].map(colNum)) - 1;
  const out = [];
  for (const r of rows.filter((x) => x > headRow)) {
    const cellsInRow = byRow.get(r);
    const name = clean(cellsInRow.find(([c]) => colNum(c) === labelCol)?.[1]);
    if (!name) continue;
    if (isTotal(name)) break;
    for (const [c, v] of cellsInRow) {
      if (months.has(c) && typeof v === 'number' && v > 0) out.push({ name, month: months.get(c), amount: Math.round(v) });
    }
  }
  return out;
}

const INST = /^(\d+)\s*\/\s*(\d+)$/;

// כל הקובץ -> רשומות לאפליקציה + סיכום להצגה לפני הייבוא
export function buildImport(sheets) {
  const monthSheets = sheets.map((s) => ({ month: sheetMonth(s.name), cells: s.cells })).filter((s) => s.month).sort((a, b) => a.month.localeCompare(b.month));
  const cardSheet = sheets.find((s) => /כרטיס|אשראי/.test(s.name));
  const months = monthSheets.map((s) => s.month);
  const lastSheet = months[months.length - 1];

  // קיבוץ לפי שם (תשלומים בנפרד מהשאר). אותו שם כמה פעמים באותו חודש – לפי הסדר
  const groups = new Map();
  for (const s of monthSheets) {
    const seen = new Map();
    for (const e of readMonthSheet(s.cells)) {
      const kind = /^הכנסות/.test(e.category) ? 'income' : 'expense';
      const base = `${kind}|${e.name}|${INST.test(e.detail) ? 'i' : ''}`;
      const n = (seen.get(base) || 0) + 1;
      seen.set(base, n);
      const key = `${base}|${n}`;
      if (!groups.has(key)) groups.set(key, { key, kind, name: e.name, inst: INST.test(e.detail), list: [] });
      groups.get(key).list.push({ ...e, month: s.month });
    }
  }

  const note = (e) => (e.detail === 'קבוע' || INST.test(e.detail) ? '' : e.detail);
  const common = (g, e) => ({
    t: 'item',
    kind: g.kind,
    name: g.name,
    category: g.kind === 'income' ? e.category.replace(/^הכנסות/, '').trim() || 'הכנסות' : e.category,
    payment: e.payment,
    note: note(e),
  });
  // כל רשומה עם ההופעות שלה בגיליונות (לחישוב הסכום השונה בכל חודש)
  const items = [];
  for (const g of groups.values()) {
    const latest = g.list[g.list.length - 1];
    if (g.inst) {
      // תשלומים: התחלה = החודש פחות מספר התשלום, לפי ההופעה האחרונה. הופעות עם מספור שלא מתאים לטווח – סדרה נפרדת
      const series = [];
      for (const e of [...g.list].reverse()) {
        const [, idx, count] = e.detail.match(INST).map(Number);
        const inRange = (x) => monthsBetween(x.start, e.month) >= 0 && monthsBetween(e.month, addMonths(x.start, x.count - 1)) >= 0;
        const s = series.find(inRange);
        if (s) s.list.unshift(e);
        else series.push({ start: addMonths(e.month, -(Math.max(1, idx) - 1)), count: Math.max(1, count), list: [e] });
      }
      for (const s of series) {
        const last = s.list[s.list.length - 1];
        items.push({ item: { ...common(g, last), id: `x${hash(g.key)}${s.start.replace('-', '')}`, type: 'installments', amount: last.amount, start: s.start, count: s.count }, list: s.list });
      }
      continue;
    }
    const fixed = g.list.some((e) => e.detail === 'קבוע') || g.list.length >= 3 || (g.list.length >= 2 && latest.month === lastSheet);
    if (fixed) {
      const end = latest.month === lastSheet ? '' : latest.month;
      items.push({ item: { ...common(g, latest), id: `x${hash(g.key)}`, type: 'fixed', amount: latest.amount, start: g.list[0].month, end, every: 1 }, list: g.list });
      continue;
    }
    for (const e of g.list) items.push({ item: { ...common(g, e), id: `x${hash(g.key)}${e.month.replace('-', '')}`, type: 'once', amount: e.amount, start: e.month }, list: [e] });
  }

  // אותם תשלומים בשם שנכתב קצת אחרת בחודשים שונים ("העברה" / "העבר") – אותה התחלה, אותו מספר תשלומים ואותו סכום:
  // מתאחדים לרשומה אחת (בשם האחרון)
  const merged = new Map();
  const final = [];
  for (const x of items) {
    if (x.item.type !== 'installments') {
      final.push(x);
      continue;
    }
    const k = `${x.item.kind}|${x.item.start}|${x.item.count}|${Math.round(x.item.amount)}`;
    const other = merged.get(k);
    if (!other) {
      merged.set(k, x);
      final.push(x);
      continue;
    }
    const lists = [...other.list, ...x.list.filter((e) => !other.list.some((o) => o.month === e.month))].sort((a, b) => a.month.localeCompare(b.month));
    if (x.list[x.list.length - 1].month > other.list[other.list.length - 1].month) Object.assign(other.item, { ...x.item, id: other.item.id });
    other.list = lists;
  }

  // סכום שונה בחודשים שבהם היה אחר באקסל (0 = לא הופיע באותו חודש)
  const records = [];
  const counts = { fixed: 0, installments: 0, once: 0, income: 0 };
  for (const { item, list } of final) {
    records.push(item);
    counts[item.kind === 'income' ? 'income' : item.type] += 1;
    if (item.type === 'once') continue;
    const last = item.type === 'installments' ? addMonths(item.start, item.count - 1) : item.end;
    for (const m of months) {
      if (monthsBetween(item.start, m) < 0 || (last && monthsBetween(last, m) > 0)) continue;
      const e = list.find((x) => x.month === m);
      const amount = e ? e.amount : 0;
      if (amount !== item.amount) records.push({ id: `ov:${item.id}:${m}`, t: 'override', itemId: item.id, month: m, amount });
    }
  }

  const cards = cardSheet ? readCardSheet(cardSheet.cells) : [];
  for (const c of cards) records.push({ id: `card:${c.name}:${c.month}`, t: 'card', ...c });

  return { records, months, counts, cards: cards.length, cardNames: [...new Set(cards.map((c) => c.name))] };
}
