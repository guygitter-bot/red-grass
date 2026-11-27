import { describe, it, expect } from 'vitest';
import { prepare, safeInvoice } from './budget';
import { comparable, invoiceFindings, invoicesBySupplier, invoicesText } from './invoices';
import { findings } from './insights';

// חשבוניות מומצאות
const inv = (id, supplier, date, amount, extra = {}) => ({ id, t: 'invoice', supplier, invoiceDate: date, amount, updatedAt: 1, ...extra });
const records = [
  inv('a1', 'סלקום', '2026-08-05', 99, { items: [{ name: 'חבילת גלישה', amount: 99 }] }),
  inv('a2', 'סלקום', '2026-09-05', 99, { items: [{ name: 'חבילת גלישה', amount: 99 }] }),
  inv('a3', 'סלקום', '2026-10-05', 129, { plan: 'אקסטרה פלוס', items: [{ name: 'חבילת גלישה', amount: 99 }, { name: 'אקסטרה פלוס', amount: 30 }] }),
  // חשמל: דו-חודשי, ואחר כך חשבונית חודשית – משווים לפי חודש
  inv('e1', 'חברת החשמל', '2026-07-10', 800, { periodFrom: '2026-05-01', periodTo: '2026-06-30' }),
  inv('e2', 'חברת החשמל', '2026-09-10', 820, { periodFrom: '2026-07-01', periodTo: '2026-08-31' }),
  inv('e3', 'חברת החשמל', '2026-10-10', 410, { periodFrom: '2026-09-01', periodTo: '2026-09-30', notes: 'התעריף יעלה ב-3% מינואר' }),
  // ביטוח: מגיע כל חודש, והפסיק
  inv('h1', 'הראל ביטוח', '2026-06-01', 200),
  inv('h2', 'הראל ביטוח', '2026-07-01', 200),
  inv('h3', 'הראל ביטוח', '2026-08-01', 200),
  // כפולה
  inv('n1', 'Netflix', '2026-10-01', 55),
  inv('n2', 'Netflix', '2026-10-04', 55),
  { id: 'gone', t: 'invoice', supplier: 'נמחק', amount: 1, deleted: true, updatedAt: 1 },
];
const data = prepare(records);

describe('חשבוניות', () => {
  it('ברירות מחדל לחשבונית ישנה / חסרה', () => {
    const s = safeInvoice({ id: 'x', supplier: 'א', received: '2026-01-02' });
    expect(s).toMatchObject({ date: '2026-01-02', amount: 0, items: [], category: 'אחר' });
    expect(data.invoices).toHaveLength(11);
  });

  it('לפי ספק, מהחדשה לישנה', () => {
    const s = invoicesBySupplier(data);
    const cel = s.find((x) => x.supplier === 'סלקום');
    expect(cel.last.id).toBe('a3');
    expect(cel.change.diff).toBe(30);
    expect(cel.gap).toBeGreaterThan(25);
  });

  it('השוואה לפי חודש כשהתקופות באורך שונה', () => {
    const [e3, e2] = invoicesBySupplier(data).find((x) => x.supplier === 'חברת החשמל').invoices;
    const c = comparable(e3, e2);
    expect(c.perMonth).toBe(true);
    expect(Math.abs(c.pct)).toBeLessThan(5);
  });

  it('ממצאים', () => {
    const f = invoiceFindings(data, '2026-10-20');
    const by = (k) => f.filter((x) => x.kind === k).map((x) => x.supplier);
    expect(by('invoice-price')).toEqual(['סלקום']);
    expect(by('invoice-item')).toEqual(['סלקום']);
    expect(f.find((x) => x.kind === 'invoice-item').text).toMatch(/אקסטרה פלוס/);
    expect(by('invoice-double')).toEqual(['Netflix']);
    expect(by('invoice-missing')).toEqual(['הראל']);
    expect(by('invoice-note')).toEqual(['חברת החשמל']);
  });

  it('נכנסים גם לממצאים של הסקירה ולטקסט ל-AI', () => {
    expect(findings(data, '2026-10').some((x) => x.kind === 'invoice-double')).toBe(true);
    expect(invoicesText(data)).toMatch(/סלקום/);
  });
});
