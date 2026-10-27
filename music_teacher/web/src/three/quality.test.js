import { describe, it, expect } from 'vitest';
import { TIERS, TOP, startTier, forcedTier, createGovernor } from './quality.js';

describe('quality', () => {
  it('מדרגות מהקל לכבד, ובראש הכול דלוק', () => {
    for (let i = 1; i < TIERS.length; i++) expect(TIERS[i].dpr).toBeGreaterThanOrEqual(TIERS[i - 1].dpr);
    expect(TIERS[0].shadows).toBe(0);
    expect(TIERS[0].ao).toBe(false);
    expect(TIERS[TOP].ao && TIERS[TOP].dof && TIERS[TOP].shadows > 0).toBe(true);
  });
  it('טלפון ומכשיר חלש לא מתחילים במלא', () => {
    expect(startTier({ coarse: true })).toBeLessThan(TOP);
    expect(startTier({ cores: 4 })).toBeLessThan(TOP);
    expect(startTier({})).toBe(TOP);
  });
  it('מדרגה מוכרחת', () => {
    expect(forcedTier(undefined)).toBe(null);
    expect(forcedTier('2')).toBe(2);
    expect(forcedTier(99)).toBe(TOP);
    expect(forcedTier('x')).toBe(null);
  });
  it('משגיח מוריד אחרי 60 פריימים איטיים, אחרי חימום', () => {
    let drops = 0;
    const g = createGovernor({ warm: 10, frames: 60, onDrop: () => drops++ });
    for (let i = 0; i < 10 + 59; i++) expect(g.push(40)).toBe(false);
    expect(g.push(40)).toBe(true);
    expect(drops).toBe(1);
  });
  it('מכשיר מהיר לא יורד, ופריים ענק (לשונית ברקע) מאפס את החלון', () => {
    let drops = 0;
    const g = createGovernor({ warm: 0, onDrop: () => drops++ });
    for (let i = 0; i < 300; i++) g.push(12);
    expect(drops).toBe(0);
    for (let i = 0; i < 50; i++) g.push(40);
    g.push(3000);
    for (let i = 0; i < 50; i++) g.push(40);
    expect(drops).toBe(0);
  });
});
