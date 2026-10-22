// בדיקות לפיצול תסריט ולתזמון כתוביות. הרצה: node --test reels/
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitScript, planTimings, speechFromSilences, parseSrt, toSrt } from './captions.mjs';

test('splitScript: מגבלת מילים ותווים', () => {
  const chunks = splitScript('זה משפט ארוך מאוד שצריך להתפצל לכמה כתוביות קצרות וקריאות על המסך');
  assert.ok(chunks.length >= 3);
  for (const c of chunks) {
    assert.ok(c.split(' ').length <= 5, c);
    assert.ok(c.length <= 28, c);
  }
});

test('splitScript: שובר בפיסוק ומוריד נקודה ופסיק', () => {
  const chunks = splitScript('שלום, מה שלומך? הכול טוב.');
  assert.deepEqual(chunks, ['שלום', 'מה שלומך?', 'הכול טוב']);
});

test('splitScript: שורות ריקות ומקפים בודדים מתעלמים', () => {
  assert.deepEqual(splitScript('\n\nאחד שניים\n  \n–\nשלוש\n'), ['אחד שניים', 'שלוש']);
});

test('planTimings: כתוביות בסדר, בתוך אזורי הדיבור', () => {
  const regions = [{ start: 1, end: 5 }, { start: 7, end: 11 }];
  const t = planTimings(['אאאא', 'בבבב', 'גגגג', 'דדדד'], regions);
  assert.equal(t.length >= 4, true);
  for (let i = 0; i < t.length; i++) {
    assert.ok(t[i].end > t[i].start);
    if (i) assert.ok(t[i].start >= t[i - 1].end - 1e-9);
    assert.ok(regions.some((r) => t[i].start >= r.start - 1e-9 && t[i].end <= r.end + 1e-9), JSON.stringify(t[i]));
  }
});

test('planTimings: גבול מוצמד להפסקה קרובה', () => {
  // הפסקה בין 4 ל-6, חלוקה שווה הייתה נופלת ב-4.1 בזמן דיבור -> מוצמדת להפסקה
  const regions = [{ start: 0, end: 4 }, { start: 6, end: 10 }];
  const t = planTimings(['אאאא', 'בבבב'], regions);
  assert.equal(t[0].end, 4);
  assert.equal(t[1].start, 6);
});

test('planTimings: לא מציג כתובית בשתיקה ארוכה', () => {
  const regions = [{ start: 0, end: 2 }, { start: 10, end: 12 }];
  const t = planTimings(['אבגדהוזחט'], regions); // כתובית אחת חוצה שתיקה של 8 שניות
  assert.equal(t.length, 2);
  assert.ok(t[0].end <= 2 && t[1].start >= 10);
});

test('speechFromSilences: היפוך שתיקות לדיבור', () => {
  const r = speechFromSilences([{ start: 0, end: 0.5 }, { start: 3, end: 4 }], 10);
  assert.deepEqual(r, [{ start: 0.5, end: 3 }, { start: 4, end: 10 }]);
});

test('srt: כתיבה וקריאה חוזרת', () => {
  const e = [{ start: 0.5, end: 1.25, text: 'שלום' }, { start: 2, end: 3.5, text: 'מה נשמע?' }];
  assert.deepEqual(parseSrt(toSrt(e)), e);
});
