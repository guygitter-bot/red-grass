import { describe, expect, it } from 'vitest';
import { THEME_OPTIONS, isDark, normalizeTheme, toggledTheme } from './theme';

describe('מצב לילה', () => {
  it('אוטומטי הולך לפי הטלפון / המחשב', () => {
    expect(isDark('auto', true)).toBe(true);
    expect(isDark('auto', false)).toBe(false);
  });

  it('יום ולילה קבועים, לא משנה מה בטלפון', () => {
    expect(isDark('dark', false)).toBe(true);
    expect(isDark('light', true)).toBe(false);
  });

  it('ערך לא מוכר (או ריק) = אוטומטי', () => {
    expect(normalizeTheme(null)).toBe('auto');
    expect(normalizeTheme('purple')).toBe('auto');
    expect(isDark(undefined, true)).toBe(true);
    expect(THEME_OPTIONS.map((o) => o.value)).toEqual(['auto', 'light', 'dark']);
  });

  it('הכפתור בכותרת עובר למצב ההפוך ממה שרואים', () => {
    expect(toggledTheme('auto', true)).toBe('light');
    expect(toggledTheme('auto', false)).toBe('dark');
    expect(toggledTheme('dark', false)).toBe('light');
    expect(toggledTheme('light', true)).toBe('dark');
  });
});
