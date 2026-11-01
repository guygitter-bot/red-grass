import { afterEach, describe, expect, it, vi } from 'vitest';
import { joinSegments, voiceSupported } from './voice';

// כמו התוסף של Capacitor: כל שם שלא מומש (גם then) זורק
vi.mock('@capacitor/core', () => ({
  registerPlugin: (name) =>
    new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === 'available') return async () => ({ available: true });
          throw new Error(`"${name}.${String(prop)}()" is not implemented on android`);
        },
      },
    ),
}));

describe('voice dictation', () => {
  afterEach(() => {
    if (globalThis.window) delete globalThis.window.Capacitor;
  });

  it('joins finished segments and the one being spoken', () => {
    expect(joinSegments(['עוגת שוקולד', ' שתי כוסות קמח '], 'כוס סו')).toBe('עוגת שוקולד\nשתי כוסות קמח\nכוס סו');
    expect(joinSegments([], '')).toBe('');
  });

  it('uses the Android plugin without awaiting the plugin proxy itself', async () => {
    globalThis.window = globalThis.window || {};
    globalThis.window.Capacitor = { isNativePlatform: () => true };
    expect(await voiceSupported()).toBe(true);
  });
});
