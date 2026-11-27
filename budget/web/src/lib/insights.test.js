import { describe, it, expect } from 'vitest';
import { prepare } from './budget';
import { bySupplier, findings, headline, supplierOf, findingsText } from './insights';

describe('שם ספק', () => {
  it('מאחד שמות של אותו ספק', () => {
    expect(supplierOf('הראל ביטוח חיים - חיוב 1')).toBe('הראל');
    expect(supplierOf('פניקס - יונתן בריאות')).toBe('הפניקס');
    expect(supplierOf('חברת החשמל 3+4')).toBe('חברת החשמל');
    expect(supplierOf('שופרסל דיל')).toBe('שופרסל');
    expect(supplierOf('ביטוח ישיר - דירה')).toBe('ביטוח ישיר');
    expect(supplierOf('מספרה כלשהי')).toBe('מספרה כלשהי');
  });
});

// נתונים מומצאים
const item = (id, name, amount, extra = {}) => ({ id, t: 'item', kind: 'expense', type: 'fixed', name, amount, start: '2026-06', category: 'אחר', updatedAt: 1, ...extra });
const records = [
  item('el', 'חברת החשמל', 400),
  { id: 'ov:el:2026-10', t: 'override', itemId: 'el', month: '2026-10', amount: 520, updatedAt: 1 },
  item('h1', 'הראל ביטוח חיים', 100, { category: 'ביטוחים' }),
  item('m1', 'מנורה חיים בריאות', 80, { category: 'ביטוחים' }),
  item('tv', 'סלקום TV', 99.83, { category: 'תקשורת' }),
  item('tvdup', 'סלקום טלוויזיה', 99.83, { category: 'תקשורת', type: 'once', start: '2026-10' }),
  item('mat', 'מזרן', 170, { type: 'installments', start: '2026-02', count: 9 }),
  ...['n1', 'n2', 'n3'].map((id, i) => item(id, ['netflix', 'spotify', 'google one'][i], 40, { category: 'מנויים' })),
  // תנועות מקבצים: הסופר בכל חודש, החודש לא; פז עלה חריג
  ...['2026-07', '2026-08', '2026-09'].map((m) => item(`tx-s-${m}`, 'שופרסל דיל', 1000, { type: 'once', start: m })),
  ...['2026-07', '2026-08', '2026-09'].map((m) => item(`tx-p-${m}`, 'פז', 300, { type: 'once', start: m })),
  item('tx-p-2026-10', 'פז', 600, { type: 'once', start: '2026-10' }),
];
const data = prepare(records);

describe('ממצאים', () => {
  const f = findings(data, '2026-10');
  const kinds = (k) => f.filter((x) => x.kind === k);

  it('שינוי תעריף', () => {
    expect(kinds('price')).toHaveLength(1);
    expect(kinds('price')[0]).toMatchObject({ level: 'urgent', supplier: 'חברת החשמל', amount: 120 });
    expect(kinds('price')[0].text).toMatch(/\+30%/);
  });
  it('עלייה חריגה אצל ספק', () => {
    expect(kinds('spike')[0]).toMatchObject({ supplier: 'פז' });
  });
  it('חיוב כפול אפשרי', () => {
    expect(kinds('double')[0]).toMatchObject({ supplier: 'סלקום', level: 'urgent' });
  });
  it('חיוב שלא הגיע', () => {
    expect(kinds('missing').map((x) => x.supplier)).toEqual(['שופרסל']);
  });
  it('כפל ביטוח חיים', () => {
    expect(kinds('overlap')[0].title).toMatch(/ביטוח חיים אצל 2 חברות/);
  });
  it('תשלומים שמסתיימים ומנויים', () => {
    expect(kinds('ending')[0].text).toMatch(/מזרן/);
    expect(kinds('subscriptions')[0].title).toBe('3 מנויים');
  });
  it('הדחופים ראשונים', () => {
    expect(f[0].level).toBe('urgent');
  });
});

describe('סיכומים', () => {
  it('לפי ספק, עם שינוי מהחודש הקודם', () => {
    const s = bySupplier(data, '2026-10');
    expect(s[0]).toMatchObject({ supplier: 'פז', total: 600, prev: 300, change: 300 });
    expect(s.find((x) => x.supplier === 'סלקום').total).toBeCloseTo(199.66);
  });
  it('כותרת וטקסט ל-AI', () => {
    const h = headline(data, '2026-10');
    expect(h.urgent).toBe(2);
    expect(h.raises).toBe(2);
    expect(findingsText(data, '2026-10')).toMatch(/חיוב כפול אפשרי/);
  });
});
