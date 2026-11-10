import { describe, it, expect } from 'vitest';
import { parseAmount, parseDate, parseCsv, parseHtmlTables, cellsToRows } from './tables';
import { buildCandidates, mapHeader, readSheet, toRecords, ruleRecords, rowMonth } from './transactions';
import { prepare, monthSummary } from './budget';

// קבצים לדוגמה (נתונים מומצאים) במבנה של קובצי הייצוא של חברות האשראי והבנק
const maxSheet = {
  name: 'עסקאות במועד החיוב',
  rows: [
    ['פירוט עסקאות – מקס'],
    [],
    ['תאריך עסקה', 'שם בית העסק', 'קטגוריה', '4 ספרות אחרונות של כרטיס האשראי', 'סוג עסקה', 'סכום חיוב', 'מטבע חיוב', 'סכום עסקה מקורי', 'מטבע עסקה מקורי', 'תאריך חיוב', 'הערות'],
    ['03-09-2026', 'שופרסל דיל', 'מזון וצריכה', '1111', 'רגילה', 412.3, '₪', 412.3, '₪', '10-10-2026', ''],
    ['05-09-2026', 'ספוטיפיי', 'פנאי', '1111', 'רגילה', 21.9, '₪', 21.9, '₪', '10-10-2026', ''],
    ['12-06-2026', 'חנות חשמל', 'חשמל', '1111', 'תשלומים', 150, '₪', 600, '₪', '10-10-2026', 'תשלום 4 מתוך 4'],
    ['14-09-2026', 'שופרסל דיל', 'מזון וצריכה', '1111', 'זיכוי', -30, '₪', -30, '₪', '10-10-2026', ''],
    ['', 'סה"כ', '', '', '', 553.2],
  ],
};
const calSheet = {
  name: 'פירוט',
  rows: [
    ['כרטיסי אשראי לישראל – כאל'],
    ['תאריך העסקה', 'שם בית העסק', 'סכום העסקה', 'סכום החיוב', 'פירוט נוסף'],
    [46270, 'פז תחנת דלק', '₪ 250.00', '₪ 250.00', ''],
    [46271, 'מסעדה כלשהי', '₪ 180.50', '₪ 180.50', ''],
  ],
};
const bankSheet = {
  name: 'תנועות בחשבון',
  rows: [
    ['מרכנתיל – תנועות בחשבון'],
    ['תאריך', 'יום ערך', 'תיאור התנועה', '₪ זכות/חובה', '₪ יתרה', 'אסמכתה'],
    ['01/10/2026', '01/10/2026', 'משכורת חברה בעמ', '10,000.00', '12,000.00', '1'],
    ['02/10/2026', '02/10/2026', 'מקס איט פיננסים', '-553.20', '11,446.80', '2'],
    ['05/10/2026', '05/10/2026', 'משכנתא', '-3,000.00', '8,446.80', '3'],
    ['07/10/2026', '07/10/2026', 'העברה לחבר', '-200.00', '8,246.80', '4'],
  ],
};

describe('ערכים מהקבצים', () => {
  it('תאריכים', () => {
    expect(parseDate('03-09-2026')).toBe('2026-09-03');
    expect(parseDate('3/9/26')).toBe('2026-09-03');
    expect(parseDate('2026-09-03T00:00')).toBe('2026-09-03');
    expect(parseDate(46270)).toBe('2026-09-05');
    expect(parseDate('סה"כ')).toBe('');
  });
  it('סכומים', () => {
    expect(parseAmount('₪ 1,234.50')).toBe(1234.5);
    expect(parseAmount('120.00-')).toBe(-120);
    expect(parseAmount('(80)')).toBe(-80);
    expect(parseAmount('')).toBe(null);
    expect(parseAmount('abc')).toBe(null);
  });
  it('CSV ו-HTML', () => {
    expect(parseCsv('a,"b,c"\n1,2\n')[0].rows).toEqual([['a', 'b,c'], ['1', '2']]);
    expect(parseCsv('a;b\n1;2')[0].rows).toEqual([['a', 'b'], ['1', '2']]);
    const html = '<table><tr><th>תאריך</th><th>תיאור</th></tr><tr><td>01/10/2026</td><td>קפה &amp; מאפה</td></tr></table>';
    expect(parseHtmlTables(html)[0].rows).toEqual([['תאריך', 'תיאור'], ['01/10/2026', 'קפה & מאפה']]);
    expect(cellsToRows(new Map([['B2', 5], ['A1', 'x']]))).toEqual([['x'], ['', 5]]);
  });
});

describe('זיהוי העמודות', () => {
  it('אשראי ובנק', () => {
    expect(mapHeader(maxSheet.rows[2])).toMatchObject({ kind: 'card', date: 0, desc: 1, category: 2, amount: 5, charge: 9, note: 10 });
    expect(mapHeader(bankSheet.rows[1])).toMatchObject({ kind: 'bank', date: 0, desc: 2, amount: 3 });
    expect(mapHeader(['שם', 'טלפון'])).toBe(null);
  });
  it('חובה וזכות בעמודות נפרדות', () => {
    const rows = readSheet([['תאריך', 'תיאור', 'חובה', 'זכות'], ['01/10/2026', 'ארנונה', '400', ''], ['02/10/2026', 'החזר', '', '50']]);
    expect(rows.map((r) => [r.desc, r.amount])).toEqual([['ארנונה', 400], ['החזר', -50]]);
  });
  it('תנועות מקס: תשלומים, זיכוי ושורת סה"כ', () => {
    const rows = readSheet(maxSheet.rows);
    expect(rows).toHaveLength(4);
    expect(rows[2].inst).toEqual({ index: 4, count: 4 });
    expect(rows[3].amount).toBe(-30);
    expect(rows[0].card).toBe('1111');
  });
});

const existing = prepare([
  { id: 'mort', t: 'item', kind: 'expense', type: 'fixed', name: 'משכנתא', amount: 3000, start: '2026-01', updatedAt: 1 },
  { id: 'sal', t: 'item', kind: 'income', type: 'fixed', name: 'משכורת', amount: 10000, start: '2026-01', updatedAt: 1 },
  { id: 'r1', t: 'rule', merchant: 'מסעדה כלשהי', category: 'מסעדות ובילויים', updatedAt: 1 },
]);

describe('הצעה לייבוא', () => {
  const files = [
    { name: 'max-export.xlsx', sheets: [maxSheet] },
    { name: 'cal.xlsx', sheets: [calSheet] },
    { name: 'mercantile.xlsx', sheets: [bankSheet] },
  ];
  const c = buildCandidates(files, existing, { rules: existing.rules });

  it('מזהה את החברות ואת חודש החיוב', () => {
    expect(c.files.map((f) => [f.issuer, f.kind, f.month])).toEqual([
      ['מקס', 'card', '2026-10'],
      ['כאל', 'card', '2026-10'],
      ['מרכנתיל', 'bank', ''],
    ]);
  });

  it('חיוב כרטיס בבנק ומה שכבר קיים – לא מסומנים', () => {
    const byDesc = Object.fromEntries(c.rows.map((r) => [r.desc + (r.refund ? '-' : ''), r]));
    expect(byDesc['מקס איט פיננסים'].include).toBe(false);
    expect(byDesc['משכנתא'].include).toBe(false);
    expect(byDesc['משכנתא'].reason).toMatch(/כבר קיים/);
    expect(byDesc['משכורת חברה בעמ'].include).toBe(false);
    expect(byDesc['העברה לחבר'].include).toBe(true);
    expect(byDesc['שופרסל דיל'].include).toBe(true);
  });

  it('קטגוריות: מהקובץ, מכלל שנלמד, ולפי מילים', () => {
    const cat = (d) => c.rows.find((r) => r.desc === d).category;
    expect(cat('שופרסל דיל')).toBe('מזון וצריכה');
    expect(cat('מסעדה כלשהי')).toBe('מסעדות ובילויים');
    expect(cat('פז תחנת דלק')).toBe('רכב ותחבורה');
    expect(cat('משכורת חברה בעמ')).toBe('משכורת');
  });

  it('רשומות: חד־פעמיות בחודש החיוב, תשלומים, זיכוי מקטין, וייבוא חוזר לא מכפיל', () => {
    const records = toRecords(c.rows, c.files);
    const shufersal = records.filter((r) => r.name === 'שופרסל דיל');
    expect(shufersal.map((r) => [r.amount, r.start])).toEqual([[412.3, '2026-10'], [-30, '2026-10']]);
    const inst = records.find((r) => r.type === 'installments');
    expect(inst).toMatchObject({ name: 'חנות חשמל', start: '2026-07', count: 4, amount: 150, payment: 'מקס 1111' });
    expect(records.find((r) => r.name === 'העברה לחבר')).toMatchObject({ start: '2026-10', payment: 'עו"ש מרכנתיל' });

    const after = prepare([...existing.items, ...records.map((r) => ({ ...r, updatedAt: 2 }))]);
    const oct = monthSummary(after, '2026-10');
    expect(oct.lines.find((l) => l.item.name === 'חנות חשמל').index).toBe(4);
    // ייבוא חוזר של אותם קבצים – הכול כבר יובא
    const again = buildCandidates(files, after, { rules: after.rules });
    expect(again.rows.filter((r) => r.include)).toEqual([]);
    expect(new Set(records.map((r) => r.id)).size).toBe(records.length);
  });

  it('אפשר לשנות חודש לקובץ אשראי, וכלל נשמר לקטגוריה ששונתה', () => {
    const files2 = c.files.map((f) => (f.kind === 'card' ? { ...f, month: '2026-11' } : f));
    expect(rowMonth(c.rows[0], files2)).toBe('2026-11');
    const original = new Map(c.rows.map((r) => [r.key, r.category]));
    const changed = c.rows.map((r) => (r.desc === 'העברה לחבר' ? { ...r, category: 'מתנות' } : r));
    expect(ruleRecords(changed, original)).toEqual([expect.objectContaining({ t: 'rule', merchant: 'העברה לחבר', category: 'מתנות' })]);
  });
});
