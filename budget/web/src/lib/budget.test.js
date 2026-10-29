import { describe, it, expect } from 'vitest';
import { addMonths, monthsBetween, occurrence, safeItem, prepare, monthSummary, forecast, byCategory, toCsv, lastMonth, money } from './budget';

const item = (x) => safeItem({ id: x.id || 'a', t: 'item', updatedAt: 1, ...x });

describe('חודשים', () => {
  it('הוספה וחישוב מרחק', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2026-10', 17)).toBe('2028-03');
    expect(monthsBetween('2026-10', '2027-03')).toBe(5);
  });
});

describe('מתי רשומה חלה', () => {
  it('קבועה כל חודש עד סוף', () => {
    const a = item({ type: 'fixed', amount: 100, start: '2026-10', end: '2027-01' });
    expect(occurrence(a, '2026-09')).toBe(null);
    expect(occurrence(a, '2026-12')).toEqual({ amount: 100 });
    expect(occurrence(a, '2027-02')).toBe(null);
  });
  it('קבועה כל חודשיים', () => {
    const a = item({ type: 'fixed', amount: 100, start: '2026-10', every: 2 });
    expect(occurrence(a, '2026-11')).toBe(null);
    expect(occurrence(a, '2026-12')).toEqual({ amount: 100 });
    expect(occurrence(a, '2030-02')).toEqual({ amount: 100 });
  });
  it('תשלומים', () => {
    const a = item({ type: 'installments', amount: 250, start: '2026-11', count: 12 });
    expect(occurrence(a, '2026-11')).toEqual({ amount: 250, index: 1, count: 12 });
    expect(occurrence(a, '2027-10')).toEqual({ amount: 250, index: 12, count: 12 });
    expect(occurrence(a, '2027-11')).toBe(null);
    expect(lastMonth(a)).toBe('2027-10');
  });
  it('חד־פעמית', () => {
    const a = item({ type: 'once', amount: 900, start: '2027-03' });
    expect(occurrence(a, '2027-03')).toEqual({ amount: 900 });
    expect(occurrence(a, '2027-04')).toBe(null);
  });
  it('רשומה ישנה בלי שדות מקבלת ברירות מחדל', () => {
    const a = safeItem({ id: 'x', updatedAt: Date.UTC(2026, 9, 5) });
    expect(a.kind).toBe('expense');
    expect(a.type).toBe('fixed');
    expect(a.every).toBe(1);
    expect(a.amount).toBe(0);
    expect(a.start).toMatch(/^\d{4}-\d{2}$/);
  });
});

const records = [
  { id: 'sal', t: 'item', kind: 'income', type: 'fixed', name: 'משכורת', category: 'משכורת', amount: 15000, start: '2026-10', updatedAt: 1 },
  { id: 'rent', t: 'item', kind: 'expense', type: 'fixed', name: 'שכירות', category: 'דיור', amount: 5000, start: '2026-10', updatedAt: 1 },
  { id: 'tv', t: 'item', kind: 'expense', type: 'installments', name: 'טלוויזיה', category: 'אחר', amount: 300, start: '2026-11', count: 3, updatedAt: 1 },
  { id: 'gone', t: 'item', kind: 'expense', type: 'fixed', name: 'נמחק', amount: 999, start: '2026-10', updatedAt: 1, deleted: true },
  { id: 'ov', t: 'override', itemId: 'rent', month: '2026-12', amount: 0, updatedAt: 1 },
  { id: 'settings', t: 'settings', balance: 2000, balanceMonth: '2026-11', updatedAt: 1 },
];

describe('סיכום חודש ותחזית', () => {
  const data = prepare(records);
  it('חודש עם תשלום ושינוי חד־פעמי', () => {
    const nov = monthSummary(data, '2026-11');
    expect(nov.income).toBe(15000);
    expect(nov.expense).toBe(5300);
    expect(nov.lines.find((l) => l.item.id === 'tv').index).toBe(1);
    const dec = monthSummary(data, '2026-12');
    expect(dec.expense).toBe(300);
    expect(dec.lines.find((l) => l.item.id === 'rent').skipped).toBe(true);
  });
  it('יתרה מצטברת מתחילת החודש שנקבע', () => {
    const f = forecast(data, '2026-10', 5);
    expect(f[0].balance).toBe(null);
    expect(f[1].balance).toBe(2000 + 15000 - 5300);
    expect(f[2].balance).toBe(f[1].balance + 15000 - 300);
    // גם כשמתחילים אחרי חודש הפתיחה
    expect(forecast(data, '2027-01', 1)[0].balance).toBe(f[3].balance);
  });
  it('לפי קטגוריה', () => {
    expect(byCategory(monthSummary(data, '2026-11'))).toEqual([{ category: 'דיור', amount: 5000 }, { category: 'אחר', amount: 300 }]);
  });
  it('טבלה לאקסל', () => {
    const csv = toCsv(data, '2026-11', 3);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('טלוויזיה');
    expect(csv).not.toContain('נמחק');
    expect(csv).toContain('יתרה צפויה');
  });
  it('סכום בשקלים', () => {
    expect(money(1234.4)).toBe('₪1,234');
  });
});
