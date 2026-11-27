import { describe, it, expect } from 'vitest';
import { champion, score, headline, homeTeam, safeSeries, shareText, titles, wins } from './series';

const s = (teams, ...ws) => ({ teams, games: ws.map((winner) => ({ winner })), players: {} });
const KL = ['SAC', 'LAL'];

describe('series', () => {
  it("2-2-1-1-1 לפי הקבוצה עם יתרון הביתיות", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => homeTeam(KL, i)).join(',')).toBe('SAC,SAC,LAL,LAL,SAC,LAL,SAC');
  });
  it('סופר ניצחונות ומוצא אלוף', () => {
    expect(wins(s(KL, 'LAL', 'SAC', 'SAC'))).toEqual({ SAC: 2, LAL: 1 });
    expect(champion(s(KL, 'SAC', 'SAC', 'LAL', 'SAC', 'SAC'))).toBe('SAC');
    expect(champion(s(KL, 'SAC', 'LAL'))).toBe(null);
  });
  it('כותרת בסגנון שידור', () => {
    expect(headline(s(KL)).text).toBe('הסדרה מתחילה · משחק 1 בסקרמנטו');
    expect(headline(s(KL, 'LAL', 'SAC')).text).toBe(`הסדרה שוויונית ${score(1, 1)}`);
    expect(headline(s(KL, 'LAL', 'LAL', 'LAL')).text).toContain('נקודת מאצ');
    expect(headline(s(KL, 'LAL', 'LAL', 'LAL', 'SAC', 'LAL')).text).toBe(`הלייקרס זוכים בסדרה ${score(4, 1)}`);
  });
  it('טקסט לשיתוף', () => {
    expect(shareText({ ...s(KL, 'LAL', 'SAC'), players: { SAC: 'אבא', LAL: 'בן' } })).toBe(`🏀 הסדרה ב-2K: אבא (קינגס) נגד בן (לייקרס)\nהסדרה שוויונית ${score(1, 1)}`);
  });
  it('טבלת אלופים לפי שם', () => {
    const h = [
      { teams: ['LAL', 'SAS'], winner: 'SAS', winnerName: 'בן' },
      { teams: KL, winner: 'SAC', players: { SAC: 'אבא' } },
      { teams: KL, winner: 'LAL', winnerName: 'בן' },
    ];
    expect(titles(h)).toEqual([
      { name: 'בן', n: 2 },
      { name: 'אבא', n: 1 },
    ]);
  });
  it('עותק ישן מהגרסה הראשונה, או נתונים שבורים, לא מפילים', () => {
    const old = safeSeries({ players: { LAL: 'a', SAS: 'b' }, games: [{ winner: 'X' }, { winner: 'SAS', lal: 90, sas: 95 }] });
    expect(old.teams).toEqual(['LAL', 'SAS']);
    expect(old.era).toBe('2010');
    expect(old.games).toEqual([{ winner: 'SAS', pts: { LAL: 90, SAS: 95 }, at: 0 }]);
    expect(safeSeries(null).history).toEqual([]);
    const bad = safeSeries({ teams: ['LAL', 'BOS'], history: [{ teams: ['LAL'] }, null] });
    expect(bad.teams).toEqual(['LAL', 'SAS']);
    expect(bad.history).toEqual([]);
  });
});
