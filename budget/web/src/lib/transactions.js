// ייבוא תנועות מקובץ של הבנק (עו"ש) או של חברת האשראי (מקס, כאל ואחרות).
// אין מבנה קבוע: מחפשים בכל גיליון את שורת הכותרות (תאריך + תיאור/בית עסק + סכום) ומזהים את העמודות לפי השמות.
// כל תנועה נכנסת כהוצאה/הכנסה חד־פעמית בחודש שלה; "תשלום 3 מתוך 10" נכנס כתשלומים.
// מה שכבר קיים באפליקציה (קבועה עם אותו סכום, ייבוא קודם) וחיובי כרטיס בדף הבנק – מסומנים כ"לא לייבא" כברירת מחדל.
// המזהים קבועים לפי התוכן – ייבוא חוזר של אותו קובץ לא מכפיל.
import { addMonths, monthSummary } from './budget';
import { parseAmount, parseDate } from './tables';

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

function hash(s) {
  let h = 5381;
  for (const ch of s) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return h.toString(36);
}

// ---------- זיהוי העמודות ----------

function findCol(head, tests, skip = () => false) {
  for (const t of tests) {
    const i = head.findIndex((h) => h && !skip(h) && (typeof t === 'string' ? h.includes(t) : t.test(h)));
    if (i >= 0) return i;
  }
  return -1;
}

// שורת כותרות -> מיפוי עמודות, או null
export function mapHeader(row) {
  const head = row.map((h) => clean(h).replace(/["'״׳]/g, ''));
  const isCharge = (h) => /חיוב|ערך/.test(h);
  const cols = {
    date: findCol(head, ['תאריך עסקה', 'תאריך העסקה', 'תאריך רכישה', 'תאריך'], isCharge),
    charge: findCol(head, ['תאריך חיוב', 'מועד חיוב', 'תאריך החיוב']),
    desc: findCol(head, ['שם בית העסק', 'שם בית עסק', 'בית העסק', 'בית עסק', 'תיאור התנועה', 'תיאור', 'פרטים', 'אסמכתא ותיאור', 'הפעולה', 'פעולה'], (h) => /סוג/.test(h)),
    amount: findCol(head, ['סכום חיוב', 'סכום החיוב', 'זכות/חובה', 'זכות / חובה', 'סכום בש', 'סכום']),
    debit: findCol(head, [/^חובה/, 'בחובה']),
    credit: findCol(head, [/^זכות/, 'בזכות']),
    category: findCol(head, ['קטגוריה', 'ענף']),
    note: findCol(head, ['הערות', 'פירוט נוסף', 'הערה']),
    type: findCol(head, ['סוג עסקה', 'סוג העסקה']),
    card: findCol(head, ['4 ספרות', 'ספרות אחרונות', 'כרטיס']),
  };
  // חובה/זכות בעמודות נפרדות – לא "זכות/חובה" אחת
  if (cols.debit === cols.amount) cols.debit = -1;
  if (cols.credit === cols.amount) cols.credit = -1;
  if (cols.date < 0 || cols.desc < 0 || (cols.amount < 0 && cols.debit < 0)) return null;
  // קובץ אשראי: יש בית עסק / סכום חיוב / תאריך חיוב
  const card = head.some((h) => /בית עסק|בית העסק|סכום חיוב|סכום החיוב|תאריך חיוב/.test(h));
  return { ...cols, kind: card ? 'card' : 'bank' };
}

const INST = /תשלום\s*(\d+)\s*(?:מתוך|מ-|\/)\s*(\d+)/;

// כל התנועות בגיליון: [{ date, charge, desc, amount (חיובי = הוצאה), category, note, card, inst }]
export function readSheet(rows) {
  const out = [];
  let cols = null;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    // שורת כותרות (גם כמה טבלאות באותו גיליון, למשל עסקאות בארץ ובחו"ל)
    const mapped = mapHeader(row);
    if (mapped) {
      cols = mapped;
      continue;
    }
    if (!cols) continue;
    const date = parseDate(row[cols.date]);
    const desc = clean(row[cols.desc]);
    if (!date || !desc || /^סה"?כ|^סהכ/.test(desc)) continue;
    let amount;
    if (cols.amount >= 0) amount = parseAmount(row[cols.amount]);
    if (amount == null && cols.debit >= 0) {
      const d = parseAmount(row[cols.debit]);
      const c = cols.credit >= 0 ? parseAmount(row[cols.credit]) : null;
      if (d) amount = -Math.abs(d);
      else if (c) amount = Math.abs(c);
    }
    if (amount == null || amount === 0) continue;
    // בבנק: מינוס = הוצאה. באשראי: הסכום הוא החיוב (מינוס = זיכוי). כאן: חיובי = הוצאה
    const spend = cols.kind === 'bank' ? -amount : amount;
    // "רגילה" לא מוסיף מידע
    const type = cols.type >= 0 ? clean(row[cols.type]) : '';
    const note = [/^רגיל/.test(type) ? '' : type, cols.note >= 0 ? clean(row[cols.note]) : ''].filter(Boolean).join(' · ');
    const m = note.match(INST) || desc.match(INST);
    out.push({
      kind: cols.kind,
      date,
      charge: cols.charge >= 0 ? parseDate(row[cols.charge]) : '',
      desc,
      amount: Math.round(spend * 100) / 100,
      category: cols.category >= 0 ? clean(row[cols.category]) : '',
      note,
      card: cols.card >= 0 ? clean(row[cols.card]).replace(/\D/g, '').slice(-4) : '',
      inst: m && +m[2] > 1 ? { index: +m[1], count: +m[2] } : null,
    });
  }
  return out;
}

// מאיזה בנק / חברת אשראי (לפי שם הקובץ והטקסט שבו)
// (רק שם הקובץ, שמות הגיליונות והשורות שלפני הכותרות – לא התנועות עצמן, שבהן יכול להופיע "מקס" גם בדף הבנק)
export function detectIssuer(fileName, sheets) {
  const top = sheets.flatMap((s) => {
    const end = s.rows.findIndex((r) => mapHeader(r || []));
    return s.rows.slice(0, end < 0 ? 8 : end).flat();
  });
  const text = `${fileName} ${sheets.map((s) => s.name).join(' ')} ${top.join(' ')}`.toLowerCase();
  if (/מקס|max/.test(text)) return 'מקס';
  if (/כאל|cal\b|cal-online|כרטיסי אשראי לישראל/.test(text)) return 'כאל';
  if (/ישראכרט|isracard|אמריקן/.test(text)) return 'ישראכרט';
  if (/מרכנתיל|mercantile/.test(text)) return 'מרכנתיל';
  if (/דיסקונט|discount/.test(text)) return 'דיסקונט';
  return '';
}

// חיוב של כרטיס אשראי בדף הבנק – הפירוט כבר מגיע מקובץ הכרטיס
export const CARD_CHARGE = /מקס|max|כאל|\bcal\b|ישראכרט|isracard|ויזה|visa|אמריקן|לאומי קארד|דיינרס|כרטיסי אשראי|כרטיס אשראי/i;

// ---------- קטגוריה אוטומטית ----------

const CATEGORY_WORDS = [
  ['משכורת', /משכורת|שכר/i],
  ['קצבאות', /ביטוח לאומי|קצבה|קצבת/i],
  ['מזון וקניות', /סופר|שופרסל|רמי לוי|יוחננוף|ויקטורי|אושר עד|טיב טעם|מגה|חצי חינם|יינות ביתן|מכולת|קצביה|ירקות|פירות|מאפי|AM:PM|super/i],
  ['רכב ותחבורה', /דלק|פז|סונול|דור אלון|ten|yellow|חניה|חניון|פנגו|pango|cellopark|כביש 6|נתיבי|מנהרות|רכבת|רב.?קו|רב פס|אגד|דן|מוסך|צמיגים|טסט|gett|uber/i],
  ['בריאות', /מכבי|כללית|מאוחדת|לאומית|סופר.?פארם|super.?pharm|בית מרקחת|פארם|רופא|מרפאה|שיניים|אופטיק|עדשות/i],
  ['תקשורת', /סלקום|פרטנר|הוט|hot|בזק|yes|גולן|רמי לוי תקשורת|we4g|012|013|019|אינטרנט/i],
  ['מנויים', /netflix|spotify|apple|google|youtube|disney|amazon|chatgpt|openai|anthropic|claude|microsoft|adobe|icloud/i],
  ['ביטוחים', /ביטוח|הראל|מנורה|הפניקס|כלל|מגדל|איילון|ישיר|AIG|שומרה|ליברה/i],
  ['חשבונות הבית', /חשמל|חברת החשמל|מים|מי |תאגיד|ארנונה|עירייה|עיריית|גז|ועד בית/i],
  ['מסעדות ובילויים', /מסעד|קפה|cafe|coffee|פיצה|בורגר|מקדונלד|wolt|וולט|תן ביס|10bis|cibus|סינמה|קולנוע|yes planet|בר |פאב/i],
  ['ביגוד והנעלה', /זארה|zara|h&m|קסטרו|גולף|fox|פוקס|רנואר|terminal x|shein|שיין|נעלי|אדידס|נייקי|nike|adidas/i],
  ['ילדים וחינוך', /גן |צהרון|חוג|בית ספר|ספרים|צעצוע|טויס|toys|קייטנה/i],
  ['הלוואות', /הלוואה|החזר הלוואה|משכנתא|משכנתה/i],
  ['משיכת מזומן ועמלות', /כספומט|משיכת מזומן|משיכה|עמלה|דמי ניהול/i],
];

export function guessCategory(desc, sourceCategory, rules) {
  const key = clean(desc);
  if (rules?.has(key)) return rules.get(key);
  if (sourceCategory) return sourceCategory;
  for (const [cat, re] of CATEGORY_WORDS) if (re.test(key)) return cat;
  return '';
}

// ---------- בניית ההצעה לייבוא ----------

const words = (s) => clean(s).replace(/[^\p{L}\p{N} ]/gu, ' ').split(' ').filter((w) => w.length >= 3);
const near = (a, b) => Math.abs(Math.abs(a) - Math.abs(b)) <= Math.max(1, Math.abs(b) * 0.03);

// files: [{ name, sheets: [{ name, rows }] }]. מחזיר { files: [{ name, issuer, kind, month, count }], rows: [...] }
// כל שורה: { key, include, reason, month, desc, amount, kind (expense/income), category, payment, inst, date }
export function buildCandidates(files, data, { rules } = {}) {
  const outFiles = [];
  const rows = [];
  for (const [fi, f] of files.entries()) {
    const issuer = detectIssuer(f.name, f.sheets);
    const txs = f.sheets.flatMap((s) => readSheet(s.rows));
    if (!txs.length) {
      outFiles.push({ name: f.name, issuer, kind: '', count: 0 });
      continue;
    }
    const kind = txs[0].kind;
    // אשראי: כל הקובץ יורד מהבנק בחודש החיוב (העמודה "תאריך חיוב", ואם אין – החודש הנפוץ של העסקאות + 1)
    let month = '';
    if (kind === 'card') {
      const counts = new Map();
      for (const t of txs) {
        const m = (t.charge || '').slice(0, 7);
        if (m) counts.set(m, (counts.get(m) || 0) + 1);
      }
      if (counts.size) month = [...counts].sort((a, b) => b[1] - a[1])[0][0];
      else {
        const byTx = new Map();
        for (const t of txs) byTx.set(t.date.slice(0, 7), (byTx.get(t.date.slice(0, 7)) || 0) + 1);
        month = addMonths([...byTx].sort((a, b) => b[1] - a[1])[0][0], 1);
      }
    }
    outFiles.push({ index: fi, name: f.name, issuer, kind, month, count: txs.length });
    const seen = new Map();
    for (const t of txs) {
      const base = `${kind}|${t.date}|${t.desc}|${t.amount}|${t.card}`;
      const n = (seen.get(base) || 0) + 1;
      seen.set(base, n);
      const payment = kind === 'card' ? [issuer, t.card].filter(Boolean).join(' ') || 'כרטיס אשראי' : `עו"ש${issuer ? ` ${issuer}` : ''}`;
      const income = t.amount < 0 && kind === 'bank';
      rows.push({
        key: `tx${hash(`${base}|${n}`)}`,
        file: fi,
        source: kind,
        date: t.date,
        // בבנק – חודש התנועה; באשראי – חודש החיוב של הקובץ (אפשר לשנות)
        month: kind === 'card' ? null : t.date.slice(0, 7),
        desc: t.desc,
        amount: Math.abs(t.amount),
        refund: kind === 'card' && t.amount < 0,
        kind: income ? 'income' : 'expense',
        category: guessCategory(t.desc, t.category, rules) || (income ? 'הכנסות' : ''),
        payment,
        note: t.note,
        inst: t.inst,
        include: true,
        reason: '',
      });
    }
  }
  markExisting(rows, outFiles, data);
  return { files: outFiles, rows };
}

// החודש של שורה (באשראי – לפי הקובץ)
export const rowMonth = (row, files) => row.month || files.find((f) => f.index === row.file)?.month || row.date.slice(0, 7);

// מה לא לייבא כברירת מחדל: חיובי כרטיס בדף הבנק, ומה שכבר קיים באפליקציה (קבועה / תשלומים עם אותו סכום באותו חודש)
export function markExisting(rows, files, data) {
  const ids = new Set((data?.items || []).map((i) => i.id));
  const cache = new Map();
  const planned = (month) => {
    if (!cache.has(month)) cache.set(month, data ? monthSummary(data, month).lines.filter((l) => l.item.type !== 'once' && !l.skipped) : []);
    return cache.get(month);
  };
  for (const r of rows) {
    r.include = true;
    r.reason = '';
    if (r.source === 'bank' && r.kind === 'expense' && CARD_CHARGE.test(r.desc)) {
      r.include = false;
      r.reason = 'חיוב כרטיס אשראי – הפירוט מגיע מקובץ הכרטיס';
      continue;
    }
    if (ids.has(r.key) || (r.inst && ids.has(instId(r, files)))) {
      r.include = false;
      r.reason = 'כבר יובא';
      continue;
    }
    const month = rowMonth(r, files);
    const match = planned(month).find((l) => l.item.kind === r.kind && near(r.amount, l.amount) && (words(r.desc).some((w) => words(l.item.name).includes(w)) || Math.abs(r.amount - l.amount) < 1));
    if (match) {
      r.include = false;
      r.reason = `כבר קיים: ${match.item.name}`;
    }
  }
}

const instId = (r, files) => {
  const month = rowMonth(r, files);
  const start = addMonths(month, -(r.inst.index - 1));
  return `ti${hash(`${r.desc}|${r.inst.count}|${Math.round(r.amount)}|${start}`)}`;
};

// השורות שנבחרו -> רשומות לאפליקציה
export function toRecords(rows, files) {
  const records = [];
  const done = new Set();
  for (const r of rows) {
    if (!r.include) continue;
    const month = rowMonth(r, files);
    const base = { t: 'item', kind: r.kind, name: r.desc, category: r.category || 'אחר', payment: r.payment };
    if (r.inst && !r.refund) {
      // תשלומים: התחלה = החודש פחות מספר התשלום; ייבוא של החודש הבא נותן אותה רשומה
      const id = instId(r, files);
      if (done.has(id)) continue;
      done.add(id);
      records.push({ ...base, id, type: 'installments', amount: r.amount, start: addMonths(month, -(r.inst.index - 1)), count: r.inst.count, note: `מקובץ ${r.source === 'card' ? 'האשראי' : 'הבנק'}` });
      continue;
    }
    records.push({
      ...base,
      id: r.key,
      type: 'once',
      // זיכוי בכרטיס מקטין את ההוצאה
      amount: r.refund ? -r.amount : r.amount,
      start: month,
      note: [r.date.split('-').reverse().join('/'), r.refund && 'זיכוי', r.note].filter(Boolean).join(' · '),
    });
  }
  return records;
}

// כללים שנלמדו: בית עסק -> קטגוריה (אחרי שהמשתמש שינה קטגוריה בייבוא)
export function ruleRecords(rows, original) {
  const out = new Map();
  for (const r of rows) {
    if (!r.include || !r.category || original.get(r.key) === r.category) continue;
    out.set(r.desc, { id: `rule:${hash(r.desc)}`, t: 'rule', merchant: r.desc, category: r.category });
  }
  return [...out.values()];
}
