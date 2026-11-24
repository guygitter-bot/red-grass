import { describe, expect, it } from 'vitest';
import { lastTarget } from './convs';

describe('lastTarget', () => {
  it('uses the bot of the latest message sent to one bot', () => {
    expect(lastTarget([{ who: 'owner', to: 'creative' }, { who: 'creative' }, { who: 'owner', to: 'lawyer' }, { who: 'lawyer' }])).toBe('lawyer');
  });
  it('old conversations: the only bot that answered', () => {
    expect(lastTarget([{ who: 'owner' }, { who: 'doctor' }, { who: 'system' }])).toBe('doctor');
    expect(lastTarget([{ who: 'owner' }, { who: 'doctor' }, { who: 'creative' }])).toBe(null);
    expect(lastTarget([])).toBe(null);
  });
});
