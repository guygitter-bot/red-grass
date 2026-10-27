import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build, SECTIONS, soundAlike, letterOptions, distance, PIC_WORDS } from '../public/exam.js';
import { WORDS } from '../public/words.js';
import { PIC_SENTENCES } from '../public/sentences.js';

const ALL = ['words', 'sentences', ...SECTIONS.map((s) => s.mode), 'exam'];

test('בכל סוג שאלה: התשובה הנכונה בין התשובות, בלי כפילויות', () => {
  for (const mode of ALL) {
    for (let round = 0; round < 5; round++) {
      const qs = build(mode);
      assert.ok(qs.length > 0, mode);
      for (const q of qs) {
        assert.ok(q.options.includes(q.answer), `${mode}: ${q.key}`);
        assert.equal(new Set(q.options).size, q.options.length, `${mode}: ${q.key}`);
        assert.ok(q.options.length >= 2 && q.options.length <= 5, mode);
        assert.ok(q.key.length <= 60);
      }
    }
  }
});

test('מבחן לדוגמה: כל הסעיפים, לפי הסדר', () => {
  const qs = build('exam');
  assert.equal(qs.length, 32);
  assert.deepEqual([...new Set(qs.map((q) => q.section))], ['listen', 'letters', 'opening', 'picture', 'bank', 'picsent', 'words', 'sentences']);
});

test('האזנה: מילה דומה בצליל', () => {
  assert.equal(distance('bag', 'bed'), 2);
  const bag = WORDS.find((w) => w.en === 'bag');
  const other = soundAlike(bag);
  assert.ok(distance('bag', other.en) <= 2);
});

test('אותיות: 4 אפשרויות כולל אות דומה', () => {
  const o = letterOptions('b', () => 0.1);
  assert.equal(o.length, 4);
  assert.ok(o.includes('b'));
  assert.ok(o.some((l) => 'dph'.includes(l)));
});

test('מחסן מילים: 5 מילים, כל אחת פעם אחת', () => {
  const qs = build('bank');
  assert.equal(qs.length, 20);
  for (let i = 0; i < 20; i += 5) {
    const answers = qs.slice(i, i + 5).map((q) => q.answer).sort();
    assert.deepEqual([...qs[i].options].sort(), answers);
  }
});

test('יש תמונה לכל מילה שמופיעה עם תמונה, ולכל משפט-תמונה', () => {
  for (const w of PIC_WORDS) assert.ok(w.pic);
  assert.equal(new Set(PIC_SENTENCES.map((s) => s.pic.join(''))).size, PIC_SENTENCES.length);
});
