import { describe, it, expect } from 'vitest';
import { newCandleGame, placeCandle, placeShamash, lightTap, nextToLight, candleView } from './candles';

function prepared(night) {
  let s = newCandleGame(night);
  for (let k = 1; k <= night; k++) s = placeCandle(s, k).state;
  return placeShamash(s).state;
}

describe('הדלקת החנוכייה', () => {
  it('אי אפשר להניח יותר נרות ממספר הלילה', () => {
    const r = placeCandle(newCandleGame(3), 4);
    expect(r.feedback.ok).toBe(false);
    expect(r.state.mistakes).toBe(1);
    expect(r.state.placed[3]).toBe(false);
  });
  it('עוברים להדלקה רק כשהנרות והשמש במקום', () => {
    let s = newCandleGame(2);
    s = placeCandle(s, 1).state;
    s = placeCandle(s, 2).state;
    expect(s.phase).toBe('place');
    s = placeShamash(s).state;
    expect(s.phase).toBe('light');
  });
  it('הנחה חוזרת מסירה נר', () => {
    let s = placeCandle(newCandleGame(3), 1).state;
    s = placeCandle(s, 1).state;
    expect(s.placed[0]).toBe(false);
  });
  it('סדר ההדלקה: שמש, אחר כך השמאלי ביותר וימינה', () => {
    let s = prepared(3);
    expect(nextToLight(s)).toBe('shamash');
    s = lightTap(s, 'shamash').state;
    expect(nextToLight(s)).toBe(3);
    s = lightTap(s, 3).state;
    expect(nextToLight(s)).toBe(2);
    s = lightTap(s, 2).state;
    const last = lightTap(s, 1);
    expect(last.state.phase).toBe('done');
    expect(last.state.mistakes).toBe(0);
  });
  it('הדלקה בסדר לא נכון נספרת כטעות ולא מדליקה', () => {
    let s = prepared(3);
    const r = lightTap(s, 1);
    expect(r.feedback.ok).toBe(false);
    expect(r.state.mistakes).toBe(1);
    expect(r.state.lit[0]).toBe(false);
    s = lightTap(r.state, 'shamash').state;
    const r2 = lightTap(s, 1);
    expect(r2.feedback.msg).toContain('השמאלי');
  });
  it('לילה ראשון: שמש ונר אחד', () => {
    let s = prepared(1);
    s = lightTap(s, 'shamash').state;
    s = lightTap(s, 1).state;
    expect(s.phase).toBe('done');
    expect(candleView(s).candles[0]).toBe('lit');
  });
});
