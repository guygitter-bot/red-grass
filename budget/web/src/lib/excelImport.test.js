import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readXlsx } from './xlsx';
import { buildImport, sheetMonth } from './excelImport';
import { monthSummary, prepare } from './budget';

// קובץ לדוגמה (נתונים מומצאים) באותו מבנה כמו קובץ האקסל של המשפחה: fixtures/sample.xlsx
async function sample() {
  const b = readFileSync(new URL('./fixtures/sample.xlsx', import.meta.url));
  return readXlsx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

describe('ייבוא מאקסל', () => {
  it('שם גיליון -> חודש', () => {
    expect(sheetMonth('08.26')).toBe('2026-08');
    expect(sheetMonth('2.26')).toBe('2026-02');
    expect(sheetMonth('מעקב כרטיסים')).toBe('');
  });

  it('קורא את הגיליונות', async () => {
    const sheets = await sample();
    expect(sheets.map((s) => s.name)).toEqual(['07.26', '08.26', 'מעקב כרטיסים']);
    expect(sheets[0].cells.get('B7')).toBe('ועד בית');
    expect(sheets[0].cells.get('C7')).toBe(280);
  });

  it('בונה קבועות, תשלומים, חד־פעמיות, הכנסות וכרטיסים – וכל חודש יוצא כמו באקסל', async () => {
    const r = buildImport(await sample());
    expect(r.months).toEqual(['2026-07', '2026-08']);
    const items = r.records.filter((x) => x.t === 'item');
    const vaad = items.find((i) => i.name === 'ועד בית');
    expect(vaad).toMatchObject({ type: 'fixed', amount: 300, start: '2026-07', end: '', category: 'דיור' });
    const car = items.find((i) => i.name === 'ביטוח רכב' && i.type === 'installments');
    expect(car).toMatchObject({ start: '2026-06', count: 10, amount: 300 });
    expect(items.find((i) => i.name === 'ביטוח רכב' && i.type === 'once')).toMatchObject({ amount: 100, start: '2026-08' });
    expect(items.find((i) => i.name === 'קופת חולים')).toMatchObject({ payment: 'כ"א 1234', category: 'בריאות' });
    expect(items.find((i) => i.name === 'משכורת')).toMatchObject({ kind: 'income', type: 'fixed', amount: 15000 });

    const data = prepare(r.records.map((x) => ({ ...x, updatedAt: 1 })));
    const jul = monthSummary(data, '2026-07');
    expect(jul.expense).toBe(280 + 500 + 300 + 900);
    expect(jul.income).toBe(15000);
    expect(monthSummary(data, '2026-08').expense).toBe(300 + 300 + 100 + 900);
    // אחרי האקסל: הקבועות והתשלומים ממשיכים, החד־פעמיות לא
    expect(monthSummary(data, '2026-09').expense).toBe(300 + 300 + 900);

    // כרטיסים: עד שורת סה"כ, והשנה מתחלפת אחרי דצמבר
    expect(r.cardNames).toEqual(['כרטיס א', 'כרטיס ב']);
    expect(r.records.filter((x) => x.t === 'card').map((c) => `${c.name}:${c.month}:${c.amount}`)).toEqual([
      'כרטיס א:2025-11:1000',
      'כרטיס א:2025-12:1200',
      'כרטיס א:2026-01:900',
      'כרטיס ב:2025-12:300',
    ]);
  });

  it('ייבוא חוזר של אותו קובץ נותן אותם מזהים (מעדכן, לא מכפיל)', async () => {
    const a = buildImport(await sample()).records.map((x) => x.id);
    const b = buildImport(await sample()).records.map((x) => x.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });
});
