import { describe, expect, it } from 'vitest';
import { currencySymbol, fmtCompact, fmtILS, fmtMoney, fmtPct, fmtPrice, fmtSigned, timeAgo, timeAgoSec, tone } from './format';

describe('format', () => {
  it('מחיר: 2 ספרות, ו-4 מתחת ל-1', () => {
    expect(fmtPrice(1234.5)).toBe('1,234.50');
    expect(fmtPrice(0.12345)).toBe('0.1235');
    expect(fmtPrice(null)).toBe('–');
  });

  it('סימני מטבע', () => {
    expect(currencySymbol('ILS')).toBe('₪');
    expect(currencySymbol('USD')).toBe('$');
    expect(fmtMoney(12.3, 'USD')).toBe('‎$12.30');
    expect(fmtMoney(-5, 'ILS')).toBe('‎-₪5.00');
    expect(fmtILS(12345.6)).toBe('‎₪12,346');
  });

  it('אחוז עם סימן', () => {
    expect(fmtPct(1.234)).toBe('‎+1.2%');
    expect(fmtPct(-0.56)).toBe('‎-0.6%');
    expect(fmtPct(0)).toBe('‎0.0%');
    expect(fmtPct(-0.01)).toBe('‎0.0%');
    expect(fmtPct(3, 0, false)).toBe('‎3%');
    expect(fmtPct(undefined)).toBe('–');
  });

  it('מספר עם סימן', () => {
    expect(fmtSigned(1500)).toBe('‎+₪1,500');
    expect(fmtSigned(-20.5, 'USD', 1)).toBe('‎-$20.5');
  });

  it('מספרים קצרים', () => {
    expect(fmtCompact(1500)).toBe('‎1.5K');
    expect(fmtCompact(2_000_000)).toBe('‎2M');
    expect(fmtCompact(3.4e9)).toBe('‎3.4B');
    expect(fmtCompact(42)).toBe('‎42');
  });

  it('לפני X זמן', () => {
    const now = 1_000_000_000_000;
    expect(timeAgo(now - 20_000, now)).toBe('עכשיו');
    expect(timeAgo(now - 60_000, now)).toBe('לפני דקה');
    expect(timeAgo(now - 5 * 60_000, now)).toBe('לפני 5 דקות');
    expect(timeAgo(now - 3600_000, now)).toBe('לפני שעה');
    expect(timeAgo(now - 3 * 3600_000, now)).toBe('לפני 3 שעות');
    expect(timeAgo(now - 86400_000, now)).toBe('אתמול');
    expect(timeAgo(now - 4 * 86400_000, now)).toBe('לפני 4 ימים');
    expect(timeAgo(null)).toBe('');
    expect(timeAgoSec((now - 120_000) / 1000, now)).toBe('לפני 2 דקות');
  });

  it('צבע לפי סימן', () => {
    expect(tone(1)).toBe('text-up');
    expect(tone(-1)).toBe('text-down');
    expect(tone(0)).toBe('text-muted');
    expect(tone(null)).toBe('text-muted');
  });
});
