import { describe, it, expect } from 'vitest';
import { newGame, applyLetter } from './dreidel';

describe('סביבון', () => {
  it('קופה ריקה: כולם שמים מטבע', () => {
    const s = applyLetter(newGame(), 'נ');
    expect(s.pot).toBe(2);
    expect(s.coins).toEqual({ you: 9, pc: 9 });
    expect(s.last.ante).toBe(true);
  });
  it('ג לוקח את כל הקופה', () => {
    const s = applyLetter(newGame(), 'ג');
    expect(s.coins.you).toBe(11);
    expect(s.pot).toBe(0);
  });
  it('ה לוקח חצי, מעוגל כלפי מעלה', () => {
    let s = { ...newGame(), pot: 5, turn: 'pc' };
    s = applyLetter(s, 'ה');
    expect(s.last.gained).toBe(3);
    expect(s.pot).toBe(2);
    expect(s.coins.pc).toBe(13);
  });
  it('פ שם מטבע בקופה', () => {
    const s = applyLetter({ ...newGame(), pot: 4 }, 'פ');
    expect(s.pot).toBe(5);
    expect(s.coins.you).toBe(9);
  });
  it('התור עובר, והסיבוב עולה אחרי המחשב', () => {
    let s = applyLetter({ ...newGame(), pot: 4 }, 'נ');
    expect(s.turn).toBe('pc');
    expect(s.round).toBe(1);
    s = applyLetter(s, 'נ');
    expect(s.turn).toBe('you');
    expect(s.round).toBe(2);
  });
  it('נגמר אחרי 10 סיבובים', () => {
    let s = { ...newGame(), pot: 4 };
    for (let i = 0; i < 20; i++) s = applyLetter(s, 'נ');
    expect(s.over).toBe(true);
    expect(s.round).toBe(10);
    expect(s.winner).toBe('draw');
  });
  it('נגמר כשמישהו נשאר בלי מטבעות', () => {
    const s = applyLetter({ ...newGame(), coins: { you: 1, pc: 5 }, pot: 3 }, 'פ');
    expect(s.over).toBe(true);
    expect(s.winner).toBe('pc');
  });
  it('אחרי הסוף לא קורה כלום', () => {
    const s = { ...newGame(), over: true };
    expect(applyLetter(s, 'ג')).toBe(s);
  });
});
