// בדיקות הסיכום לוואטסאפ – נתונים מומצאים
import { describe, expect, it } from 'vitest';
import { buildSummary } from './summary';
import { duplicateProposal, updateProposal } from './proposals';

const settings = { hourlyRate: 200, hostingMonthly: 50, apiMonthlyAvg: 30, vatIncluded: false };
const tools = [
  { name: 'בוט הזמנות', buildHours: { spec: 1, build: 4, test: 1, training: 0 }, monthlyHours: 1 },
  { name: 'סיכום שיחות', buildHours: 5, monthlyHours: 0.5 },
];

describe('whatsapp summary', () => {
  it('lists tools, totals and next step', () => {
    const text = buildSummary({ business: 'מאפיית דוגמה', tools, settings, nextStep: 'לקבוע שיחת היכרות', packageLabel: 'מומלץ' });
    expect(text).toContain('הצעה עבור מאפיית דוגמה (מומלץ)');
    expect(text).toContain('1. בוט הזמנות');
    expect(text).toContain('2. סיכום שיחות');
    expect(text).toContain('עלות הקמה: ₪2,200');
    expect(text).toContain('עלות חודשית: ₪');
    expect(text).toContain('לא כולל מע"מ');
    expect(text).toContain('הצעד הבא: לקבוע שיחת היכרות');
  });
  it('works with no tools or next step', () => {
    const text = buildSummary({ tools: [], settings });
    expect(text).toContain('הצעת מחיר');
    expect(text).not.toContain('הצעד הבא');
  });
});

describe('versions', () => {
  const list = [
    { id: 'a', version: 1, createdAt: 1, tools: [{ name: 'x' }], nextStep: 'ישן' },
    { id: 'b', version: 3, createdAt: 2, tools: [] },
  ];
  it('duplicates to max version + 1 without touching others', () => {
    const r = duplicateProposal(list, 'a', 99, 'new1');
    expect(r.created).toMatchObject({ id: 'new1', version: 4, createdAt: 99, nextStep: 'ישן' });
    expect(r.list).toHaveLength(3);
    expect(r.list[0]).toBe(list[0]);
    r.created.tools[0].name = 'שונה';
    expect(list[0].tools[0].name).toBe('x');
  });
  it('edits one version only', () => {
    const next = updateProposal(list, 'a', (p) => ({ ...p, nextStep: 'חדש' }));
    expect(next[0].nextStep).toBe('חדש');
    expect(next[1]).toBe(list[1]);
  });
  it('missing id returns null', () => {
    expect(duplicateProposal(list, 'zzz', 1, 'n')).toBeNull();
  });
});
