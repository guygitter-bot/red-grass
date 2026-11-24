// בדיקות הסיכום לוואטסאפ – נתונים מומצאים
import { describe, expect, it } from 'vitest';
import { buildSummary } from './summary';
import { countKinds, duplicateProposal, normalizeProposal, totalHours, updateProposal } from './proposals';

const tools = [
  { name: 'מערכת הזמנות', kind: 'replace', replaces: 'אקסל' },
  { name: 'סיכום שיחות' },
];

describe('whatsapp summary', () => {
  it('lists systems, replace marker and next step', () => {
    const text = buildSummary({ business: 'מאפיית דוגמה', understanding: 'מאפייה קטנה. עובדים באקסל.', tools, nextStep: 'לקבוע שיחת היכרות' });
    expect(text).toContain('המלצות למערכות – מאפיית דוגמה');
    expect(text).toContain('מאפייה קטנה.');
    expect(text).not.toContain('עובדים באקסל');
    expect(text).toContain('1. מערכת הזמנות (במקום אקסל)');
    expect(text).toContain('2. סיכום שיחות');
    expect(text).toContain('הצעד הבא: לקבוע שיחת היכרות');
  });
  it('has no money', () => {
    const text = buildSummary({ business: 'x', tools, nextStep: 'y' });
    expect(text).not.toMatch(/₪|מע"מ|עלות|מחיר/);
  });
  it('works with no tools or next step', () => {
    const text = buildSummary({ tools: [] });
    expect(text).toContain('המלצות למערכות');
    expect(text).not.toContain('הצעד הבא');
  });
});

describe('normalizeProposal', () => {
  it('old version gets defaults', () => {
    const p = normalizeProposal({ id: 'a', tools: [{ name: 'x', buildHours: 5 }] });
    expect(p.currentSystems).toEqual([]);
    expect(p.tools[0]).toMatchObject({ kind: 'new', replaces: '', whatItDoes: '', screens: [] });
    expect(p.timeline).toEqual([]);
    expect(totalHours(p.tools[0])).toBe(5);
  });
  it('keeps new fields and fixes bad verdicts', () => {
    const p = normalizeProposal({ currentSystems: [{ name: 'אקסל', verdict: 'replace', note: 'ה' }, { name: 'ב', verdict: '??' }], tools: [{ kind: 'replace', replaces: 'אקסל', buildHours: { spec: 1, build: 2, test: 1, training: 0.5 } }] });
    expect(p.currentSystems[0].verdict).toBe('replace');
    expect(p.currentSystems[1].verdict).toBe('keep');
    expect(p.tools[0].kind).toBe('replace');
    expect(totalHours(p.tools[0])).toBe(4.5);
  });
  it('counts replace vs new', () => {
    expect(countKinds({ tools: [{ kind: 'replace' }, {}, { kind: 'new' }] })).toEqual({ total: 3, replace: 1, fresh: 2 });
    expect(countKinds({})).toEqual({ total: 0, replace: 0, fresh: 0 });
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
