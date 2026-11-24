import { describe, expect, it } from 'vitest';
import { apiMonthlyOf, packageCost, packagesOf, proposalCost, safeSettings, stageHours, termsOf, toolCost, vatLabel } from './pricing';

const settings = { hourlyRate: 200, hostingMonthly: 50, apiMonthlyAvg: 30, depositPercent: 50, vatIncluded: false };
const proposal = {
  tools: [
    { name: 'בוט לדוגמה', buildHours: 10, monthlyHours: 1 },
    { name: 'טופס בדוי', buildHours: 5, monthlyHours: 0.5 },
  ],
};

describe('pricing', () => {
  it('computes one tool from hours × rate', () => {
    expect(toolCost(proposal.tools[0], settings)).toEqual({ build: 2000, monthlyWork: 200 });
  });

  it('computes a whole proposal', () => {
    const c = proposalCost(proposal, settings);
    expect(c.buildHours).toBe(15);
    expect(c.build).toBe(3000);
    expect(c.monthly).toBe(1.5 * 200 + 50 + 30);
    expect(c.deposit).toBe(1500);
    expect(c.buildWithVat).toBe(3540);
  });

  it('a new rate changes every sum', () => {
    expect(proposalCost(proposal, { ...settings, hourlyRate: 300 }).build).toBe(4500);
  });

  it('no VAT added when prices already include it', () => {
    expect(proposalCost(proposal, { ...settings, vatIncluded: true }).buildWithVat).toBe(3000);
  });

  it('works with missing settings and old proposals', () => {
    expect(safeSettings(undefined)).toEqual({ hourlyRate: 0, hostingMonthly: 0, apiMonthlyAvg: 0, depositPercent: 50, revisionRounds: 2, vatIncluded: false });
    expect(proposalCost({}, undefined).monthly).toBe(0);
    expect(proposalCost({ tools: [{ buildHours: 'abc' }] }, settings).build).toBe(0);
  });

  it('build hours by stage (new proposals) and as one number (old)', () => {
    const staged = { tools: [{ buildHours: { spec: 2, build: 6, test: 1, training: 1 }, monthlyHours: 0 }] };
    expect(proposalCost(staged, settings).buildHours).toBe(10);
    expect(proposalCost(staged, settings).build).toBe(2000);
  });

  it('ignores any money the AI might send', () => {
    expect(proposalCost({ tools: [{ buildHours: 1, price: 99999 }] }, settings).build).toBe(200);
  });
});

// נתונים מומצאים להצעות בשלבים
const staged = (name, h, extra = {}) => ({ name, buildHours: h, monthlyHours: 1, ...extra });
const T = [
  staged('א', { spec: 2, build: 6, test: 1, training: 1 }, { apiMonthlyEstimate: 40 }),
  staged('ב', { spec: 1, build: 4, test: 1, training: 0 }, { apiMonthlyEstimate: 20 }),
  staged('ג', { spec: 1, build: 3, test: 1, training: 1 }),
  staged('ד', { spec: 1, build: 2, test: 1, training: 1 }),
  staged('ה', { spec: 1, build: 2, test: 1, training: 1 }),
];

describe('package cost rows', () => {
  it('stage rows are hours × rate = sum', () => {
    const c = packageCost(T.slice(0, 2), settings);
    expect(c.buildRows.map((r) => [r.label, r.hours, r.rate, r.sum])).toEqual([
      ['אפיון', 3, 200, 600],
      ['בנייה', 10, 200, 2000],
      ['בדיקות', 2, 200, 400],
      ['הדרכה', 1, 200, 200],
    ]);
    expect(c.build).toBe(3200);
    expect(c.buildHours).toBe(16);
  });

  it('monthly has separate lines, hosting once per package', () => {
    const c = packageCost(T.slice(0, 2), settings);
    expect(c.monthlyLines.map((l) => [l.key, l.sum])).toEqual([['work', 400], ['hosting', 50], ['api', 60]]);
    expect(c.monthly).toBe(510);
  });

  it('API falls back to the settings average when no tool has an estimate', () => {
    expect(apiMonthlyOf([{ name: 'x' }], settings)).toBe(30);
    expect(packageCost([T[2]], settings).monthlyLines[2].sum).toBe(30);
  });

  it('empty package costs nothing', () => {
    const c = packageCost([], settings);
    expect(c.build).toBe(0);
    expect(c.monthly).toBe(0);
  });

  it('a new rate changes every row at once', () => {
    const c = packageCost(T.slice(0, 2), { ...settings, hourlyRate: 100 });
    expect(c.build).toBe(1600);
    expect(c.monthlyLines[0].sum).toBe(200);
    expect(c.monthlyLines[1].sum).toBe(50);
  });

  it('VAT total only added when prices exclude it', () => {
    expect(packageCost(T.slice(0, 2), settings).buildWithVat).toBe(3776);
    expect(packageCost(T.slice(0, 2), { ...settings, vatIncluded: true }).buildWithVat).toBe(3200);
    expect(vatLabel({ vatIncluded: true })).toBe('כולל מע"מ');
    expect(vatLabel({})).toBe('לא כולל מע"מ');
  });

  it('old proposals: number hours, missing estimate and timeline', () => {
    expect(stageHours({ buildHours: 8 })).toEqual({ spec: 0, build: 8, test: 0, training: 0 });
    expect(stageHours({})).toEqual({ spec: 0, build: 0, test: 0, training: 0 });
    const c = packageCost([{ name: 'ישן', buildHours: 8 }], settings);
    expect(c.build).toBe(1600);
    expect(c.buildRows[1].hours).toBe(8);
  });
});

describe('packages', () => {
  const names = (p) => p.tools.map((t) => t.name).join('');
  it('2-3 tools: base 1, recommended 2, extended all', () => {
    expect(packagesOf(T.slice(0, 3)).map(names)).toEqual(['א', 'אב', 'אבג']);
    expect(packagesOf(T.slice(0, 2)).map(names)).toEqual(['א', 'אב', 'אב']);
  });
  it('4+ tools: recommended has 3', () => {
    expect(packagesOf(T).map(names)).toEqual(['א', 'אבג', 'אבגדה']);
  });
  it('one tool: all packages equal', () => {
    expect(packagesOf([T[0]]).map(names)).toEqual(['א', 'א', 'א']);
  });
  it('single mode: one package with everything', () => {
    const p = packagesOf(T, true);
    expect(p).toHaveLength(1);
    expect(names(p[0])).toBe('אבגדה');
  });
  it('flags the recommended package', () => {
    expect(packagesOf(T).filter((p) => p.recommended).map((p) => p.key)).toEqual(['recommended']);
  });
});

describe('terms', () => {
  it('uses deposit and revision rounds from settings', () => {
    const t = termsOf({ depositPercent: 30, revisionRounds: 3 });
    expect(t[0]).toContain('30%');
    expect(t[1]).toContain('3 סבבי');
    expect(t).toHaveLength(4);
  });
});
