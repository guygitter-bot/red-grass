import { describe, it, expect } from 'vitest';
import { startsWithLetter, normalize, clock, codeFrom } from './game';

describe('game helpers', () => {
  it('checks the first letter like the server', () => {
    expect(startsWithLetter(' אריה', 'א')).toBe(true);
    expect(startsWithLetter('בָּנָנָה', 'ב')).toBe(true);
    expect(startsWithLetter('גמל', 'א')).toBe(false);
    expect(normalize('תל-אביב')).toBe('תל אביב');
  });

  it('formats the clock', () => {
    expect(clock(120000)).toBe('2:00');
    expect(clock(4100)).toBe('0:05');
    expect(clock(-5)).toBe('0:00');
  });

  it('reads a code from a link or text', () => {
    expect(codeFrom('https://eretz-ir.pages.dev/?g=ab3cd')).toBe('AB3CD');
    expect(codeFrom(' xyz12 ')).toBe('XYZ12');
    expect(codeFrom('hello world')).toBe('');
  });
});
