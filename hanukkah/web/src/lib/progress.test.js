import { describe, it, expect } from 'vitest';
import { safeProgress, totalStars, quizStars, emptyProgress } from './progress';
import { earnedBadges, BADGES } from './badges';

describe('התקדמות', () => {
  it('ערכים ריקים או פגומים נותנים ברירות מחדל', () => {
    expect(safeProgress(null)).toEqual(emptyProgress());
    expect(safeProgress('x')).toEqual(emptyProgress());
    const p = safeProgress({ story: 'bad', quiz: { easy: { best: 'x' } }, catchBest: -4, candles: [3, 99, 3] });
    expect(p.story).toEqual([]);
    expect(p.quiz.easy.best).toBe(0);
    expect(p.quiz.hard.stars).toBe(0);
    expect(p.catchBest).toBe(0);
    expect(p.candles).toEqual([3]);
  });
  it('נתונים ישנים בלי שדות חדשים עובדים', () => {
    const p = safeProgress({ story: [0, 1] });
    expect(p.memory.large).toBe(0);
    expect(totalStars(p)).toBe(2);
  });
  it('כוכבי חידון לפי ניקוד', () => {
    expect(quizStars(8)).toBe(3);
    expect(quizStars(5)).toBe(2);
    expect(quizStars(3)).toBe(1);
    expect(quizStars(2)).toBe(0);
  });
  it('סך כוכבים', () => {
    const p = safeProgress({ story: [0, 1, 2], quiz: { easy: { stars: 3 } }, candles: [1, 2], catchBest: 20, dreidel: { wins: 9 } });
    expect(totalStars(p)).toBe(3 + 3 + 2 + 1 + 3);
  });
});

describe('תגים', () => {
  it('בהתחלה אין תגים', () => {
    expect(earnedBadges(emptyProgress())).toEqual([]);
  });
  it('תגים לפי אבני דרך', () => {
    const got = earnedBadges({
      story: [0, 1, 2, 3, 4, 5, 6],
      quiz: { hard: { best: 7, stars: 3, rounds: 1 } },
      candles: [1, 2, 3, 4, 5, 6, 7, 8],
    });
    expect(got).toContain('story');
    expect(got).toContain('champ');
    expect(got).toContain('nights');
    expect(got).not.toContain('dreidel');
  });
  it('מזהי תגים ייחודיים', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
  });
});
