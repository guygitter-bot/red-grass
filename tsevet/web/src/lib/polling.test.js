import { describe, expect, it } from 'vitest';
import { convInterval, teamInterval } from './polling';

describe('polling', () => {
  it('שיחה', () => {
    expect(convInterval({ busy: { agent: null } })).toBe(2000);
    expect(convInterval({ busy: null, pending: true })).toBe(6000);
    expect(convInterval({ busy: null, pending: false })).toBe(20000);
    expect(convInterval(null)).toBe(20000);
  });
  it('צוות', () => {
    expect(teamInterval({ agents: [{ busy: true }], convs: [] })).toBe(5000);
    expect(teamInterval({ agents: [{ busy: false }], convs: [] })).toBe(30000);
  });
});
