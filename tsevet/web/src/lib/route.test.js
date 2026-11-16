import { describe, expect, it } from 'vitest';
import { parseRoute, setPreset, getPreset } from './route';

describe('route', () => {
  it('מסלולים', () => {
    expect(parseRoute('')).toEqual({ name: 'team' });
    expect(parseRoute('#/c/abc%20d')).toEqual({ name: 'chat', id: 'abc d' });
    expect(parseRoute('#/costs')).toEqual({ name: 'costs' });
    expect(parseRoute('#/chats')).toEqual({ name: 'chats' });
    expect(parseRoute('#/xx')).toEqual({ name: 'team' });
  });
  it('יעד מוגדר מראש נשמר לשיחה', () => {
    setPreset('a', 'creative');
    expect(getPreset('a')).toBe('creative');
    expect(getPreset('b')).toBe(null);
  });
});
