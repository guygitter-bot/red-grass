import { describe, expect, it } from 'vitest';
import { agentRows, dayRows } from './costs';

describe('costs', () => {
  it('פירוק לפי בוט', () => {
    const rows = agentRows({ router: 0.1, creative: 0.5 }, [{ key: 'creative', name: 'קריאייטיב', emoji: '🎨' }]);
    expect(rows[0]).toMatchObject({ key: 'creative', label: 'קריאייטיב', pct: 100 });
    expect(rows[1].label).toBe('ניתוב (מי עונה)');
    expect(rows[1].pct).toBe(20);
  });
  it('ריק', () => {
    expect(agentRows({}, [])).toEqual([]);
    expect(dayRows({})).toEqual([]);
  });
  it('ימים מהאחרון לראשון', () => {
    expect(dayRows({ '02': 1, '10': 2 }).map((d) => d.day)).toEqual(['10', '02']);
  });
});
