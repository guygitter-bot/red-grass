import { describe, it, expect } from 'vitest';
import { HOME, champion, headline, safeSeries, wins } from './series';

const g = (...ws) => ws.map((winner) => ({ winner }));

describe('series', () => {
  it('2-2-1-1-1 עם משחקים 1-2 בלוס אנג\'לס', () => {
    expect(HOME.join(',')).toBe('LAL,LAL,SAS,SAS,LAL,SAS,LAL');
  });
  it('סופר ניצחונות ומוצא אלוף', () => {
    expect(wins(g('LAL', 'SAS', 'SAS'))).toEqual({ LAL: 1, SAS: 2 });
    expect(champion(g('SAS', 'SAS', 'LAL', 'SAS', 'SAS'))).toBe('SAS');
    expect(champion(g('SAS', 'LAL'))).toBe(null);
  });
  it('כותרת בסגנון שידור', () => {
    expect(headline([]).tone).toBe('even');
    expect(headline(g('LAL', 'SAS')).text).toBe('הסדרה שוויונית 1–1');
    expect(headline(g('LAL', 'LAL', 'LAL')).text).toContain('נקודת מאצ');
    expect(headline(g('LAL', 'LAL', 'LAL', 'SAS', 'LAL')).text).toBe('הלייקרס זוכים בסדרה 4–1');
  });
  it('נתונים חסרים או שבורים לא מפילים', () => {
    expect(safeSeries(null)).toEqual({ players: { LAL: '', SAS: '' }, games: [], rev: 0 });
    expect(safeSeries({ games: [{ winner: 'X' }, { winner: 'SAS', lal: '5' }] }).games).toEqual([{ winner: 'SAS', lal: null, sas: null, at: 0 }]);
  });
});
