import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saidWord, choicesFor, nextOrder } from '../public/match.js';
import { WORDS } from '../public/words.js';

const find = (en) => WORDS.find((w) => w.en === en);

test('המילה נאמרה נכון', () => {
  assert.ok(saidWord(['Cat'], find('cat')));
  assert.ok(saidWord(['the cat.'], find('cat')));
  assert.ok(saidWord(['bat', 'cat'], find('cat')));
  assert.ok(saidWord(['son'], find('sun')));
  assert.ok(saidWord(['grand ma'], find('grandma')));
});

test('מילה אחרת לא מתקבלת', () => {
  assert.ok(!saidWord(['dog'], find('cat')));
  assert.ok(!saidWord([''], find('cat')));
  assert.ok(!saidWord(['category'], find('cat')));
});

test('4 תשובות שונות, אחת נכונה', () => {
  for (const w of WORDS) {
    const c = choicesFor(w, WORDS);
    assert.equal(c.length, 4);
    assert.equal(new Set(c).size, 4);
    assert.ok(c.includes(w.he));
  }
});

test('הרשימה מלאה ובלי כפילויות', () => {
  assert.equal(WORDS.length, 35);
  assert.equal(new Set(WORDS.map((w) => w.en)).size, 35);
  assert.equal(new Set(WORDS.map((w) => w.he)).size, 35);
});

test('מילים שלא נלמדו באות קודם', () => {
  const order = nextOrder(WORDS, { cat: true, dog: true });
  assert.equal(order.length, 35);
  assert.deepEqual(order.slice(-2).map((w) => w.en).sort(), ['cat', 'dog']);
});

import { sentenceChoicesFor, passed, percent } from '../public/match.js';
import { SENTENCES } from '../public/sentences.js';

test('משפטים: 4 תשובות שונות, אחת נכונה, ותשובה דומה ביניהן', () => {
  assert.equal(new Set(SENTENCES.map((s) => s.he)).size, SENTENCES.length);
  for (const s of SENTENCES) {
    const c = sentenceChoicesFor(s, SENTENCES);
    assert.equal(c.length, 4);
    assert.equal(new Set(c).size, 4);
    assert.ok(c.includes(s.he));
  }
  const c = sentenceChoicesFor(SENTENCES.find((s) => s.en === 'The cat is small.'), SENTENCES);
  assert.ok(c.some((he) => he.startsWith('החתול') && he !== 'החתול קטן') || c.some((he) => he.endsWith('קטן') && he !== 'החתול קטן'));
});

test('המשפטים בנויים רק ממילים מהרשימה', () => {
  const known = new Set([...WORDS.map((w) => w.en), 'the', 'a', 'an', 'is', 'my', 'can', 'has', 'he', 'she', 'dan', 'big']);
  for (const s of SENTENCES) {
    for (const w of s.en.toLowerCase().replace(/[^a-z ]/g, '').split(' ')) assert.ok(known.has(w), w);
  }
});

test('80% כדי לעבור', () => {
  assert.ok(passed(28, 35));
  assert.ok(!passed(27, 35));
  assert.ok(!passed(0, 0));
  assert.equal(percent(28, 35), 80);
});
