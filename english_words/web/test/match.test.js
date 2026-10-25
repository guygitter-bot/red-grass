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
