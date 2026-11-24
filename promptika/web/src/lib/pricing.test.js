import { describe, expect, it } from 'vitest';
import { proposalCost, safeSettings, toolCost } from './pricing';

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
