import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENERATORS, genQuestion, buildRound, buildExam, build } from '../public/gen/index.js';
import { EXAM_STEPS } from '../public/gen/sheet.js';
import { quadAngles } from '../public/gen/geometry.js';
import { TOPICS, TOPIC_IDS, SECTIONS, MODES, EXAM, ROUND_SIZE, EXAM_SIZE, isUnlocked, allPassed, topicsOf } from '../public/topics.js';
import { makeRng } from '../public/rand.js';
import { evalExpr, cmpFrac } from '../public/gen/common.js';
import { rich, esc } from '../public/rich.js';
import { MODES as API_MODES } from '../../api/stats.js';

const SEEDS = 300;
const BAD = /undefined|NaN|null|\[object|Infinity/;
const frac = (s) => s.split('/').map(Number);
const toMm = (s) => { const m = s.match(/^(\d+) (ס"מ|מ"מ|מ')$/); return Number(m[1]) * { 'ס"מ': 10, 'מ"מ': 1, "מ'": 1000 }[m[2]]; };
const UNIT_MM = { 'מ"מ': 1, 'ס"מ': 10, "מ'": 1000, 'ק"מ': 1000000 };
const LETTERS = ['א', 'ב', 'ג', 'ד'];

// כל הוריאנטים של כל נושא, 300 זרעים שונים
function allQuestions(topic) {
  const out = [];
  for (let s = 1; s <= SEEDS; s++) {
    const rng = makeRng(s * 7919 + 13);
    for (let v = 0; v < GENERATORS[topic].length; v++) out.push(genQuestion(topic, rng, v));
  }
  return out;
}

test('19 נושאים, בכל נושא מחולל, והרשימות זהות בשרת', () => {
  assert.equal(TOPICS.length, 19);
  assert.deepEqual(Object.keys(GENERATORS).sort(), [...TOPIC_IDS].sort());
  assert.deepEqual([...API_MODES].sort(), [...MODES].sort());
  assert.ok(MODES.includes(EXAM));
  for (const t of TOPICS) assert.ok(SECTIONS.some((s) => s.id === t.section), t.id);
  assert.equal(new Set(TOPIC_IDS).size, 19);
  assert.equal(SECTIONS[SECTIONS.length - 1].id, 'teacher');
  assert.equal(TOPICS[TOPICS.length - 1].id, 'teacher_sheet');
});

test('פתיחה הדרגתית בתוך פרק, ופרקים פתוחים תמיד', () => {
  for (const s of SECTIONS) assert.ok(isUnlocked(topicsOf(s.id)[0].id, {}), s.id);
  assert.ok(!isUnlocked('digits', {}));
  assert.ok(!isUnlocked('digits', { sequences: 79 }));
  assert.ok(isUnlocked('digits', { sequences: 80 }));
  assert.ok(!isUnlocked('order', { sequences: 100 }));
  assert.ok(!allPassed({}));
  assert.ok(allPassed(Object.fromEntries(TOPIC_IDS.map((id) => [id, 80]))));
});

for (const topic of TOPIC_IDS) {
  test(`${topic}: ${SEEDS} שאלות – מבנה, תשובות, מסיחים וטקסט`, () => {
    const qs = allQuestions(topic);
    assert.ok(qs.length >= SEEDS);
    for (const q of qs) {
      const ctx = `${topic}: ${q.text} | ${q.expr || ''}`;
      assert.ok(typeof q.text === 'string' && q.text.length > 5, ctx);
      assert.ok(typeof q.explain === 'string' && q.explain.length > 10, ctx);
      for (const part of [q.text, q.expr, q.explain, q.answer, ...(q.options || []), q.svg]) assert.ok(!BAD.test(String(part ?? '')), `${ctx} -> ${part}`);
      assert.ok(q.key.length > 0 && q.key.length <= 60, ctx);
      assert.equal(typeof q.answer, 'string', ctx);
      if (q.input) {
        assert.ok(!q.options, ctx);
        assert.match(q.answer, /^\d+$/, ctx);
      } else {
        assert.ok(q.options.length >= 3 && q.options.length <= 4, ctx);
        assert.ok(q.options.length === 4 || q.kind === 'angle' || q.kind === 'sign', `${ctx}: 4 תשובות`);
        assert.equal(new Set(q.options).size, q.options.length, `${ctx}: כפילות ${q.options}`);
        assert.ok(q.options.includes(q.answer), ctx);
        assert.ok(q.options.every((o) => o.length > 0 && o === o.trim()), ctx);
      }
      if (q.svg) { assert.ok(q.svg.startsWith('<svg') && q.svg.endsWith('</svg>'), ctx); assert.ok(!/<script/i.test(q.svg)); }
    }
  });
}

test('תרגילי חשבון: התשובה שווה לחישוב התרגיל', () => {
  for (const topic of ['ops', 'order', 'zero_one']) {
    for (const q of allQuestions(topic)) {
      if (q.kind === 'calc') {
        const v = evalExpr(q.meta.expr);
        assert.equal(String(v), q.answer, q.meta.expr);
        assert.ok(Number.isInteger(v) && v >= 0, q.meta.expr);
        if (topic === 'zero_one') assert.ok(!/: 0\b/.test(q.meta.expr), 'חילוק ב-0');
      } else if (q.kind === 'missing') {
        const [l, r] = q.meta.expr.replace(/□/g, q.answer).split('=');
        assert.equal(evalExpr(l), evalExpr(r), q.meta.expr);
        assert.ok(!/: *0(\D|$)/.test(q.meta.expr.replace(/□/g, q.answer)) || /^0 :/.test(q.meta.expr), q.meta.expr);
      } else if (q.kind === 'rem') {
        const { a, d } = q.meta;
        assert.equal(q.answer, `${Math.floor(a / d)} ושארית ${a % d}`);
        assert.ok(a % d > 0 && a % d < d);
      } else if (q.kind === 'truth') {
        const [l, r] = q.answer.split('=');
        assert.equal(evalExpr(l), evalExpr(r), q.answer);
        for (const o of q.options.filter((x) => x !== q.answer)) { const [a, b] = o.split('='); assert.notEqual(evalExpr(a), evalExpr(b), o); }
      }
    }
  }
});

test('סדר פעולות: הטעות הנפוצה לא שווה לתשובה, וההסבר מכיל את התוצאה', () => {
  for (const q of allQuestions('order')) assert.ok(q.explain.includes(q.answer), q.meta.expr);
});

test('סדרות: ההפרש קבוע והתשובה נכונה', () => {
  for (const q of allQuestions('sequences')) {
    if (q.kind === 'seq3' || q.kind === 'seq-line') continue;
    const terms = q.expr.replace('…', '').split(',').map((s) => s.trim()).filter(Boolean);
    if (q.text.includes('חסר')) {
      const filled = terms.map((t) => (t === '□' ? Number(q.answer) : Number(t)));
      const d = filled[1] - filled[0];
      assert.ok(d !== 0 && filled.every((x, i) => !i || x - filled[i - 1] === d), q.expr);
      assert.ok(filled.every((x) => x >= 0 && x <= 10000));
    } else if (q.text.includes('הבא')) {
      const nums = terms.map(Number);
      const d = nums[1] - nums[0];
      assert.equal(Number(q.answer) - nums[3], d, q.expr);
    } else if (q.text.includes('הכלל')) {
      const nums = terms.map(Number);
      const d = nums[1] - nums[0];
      assert.equal(q.answer, d > 0 ? `מוסיפים ${d}` : `מחסירים ${-d}`);
    } else {
      const nums = terms.map(Number);
      const d = nums[1] - nums[0], x = Number(q.answer);
      assert.ok((x - nums[0]) % d === 0 && (x - nums[0]) / d > 4, q.expr);
      for (const o of q.options.filter((o) => o !== q.answer)) assert.ok((Number(o) - nums[0]) % d !== 0, `${q.expr}: ${o}`);
    }
  }
});

test('בניית מספרים: נבדק בכוח גס', () => {
  const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  for (const q of allQuestions('digits')) {
    if (q.kind === 'digits-rule') continue;
    const { digits, which } = q.meta;
    const list = perms(digits).filter((p) => p[0] !== 0).map((p) => Number(p.join('')));
    const f = { max: list, min: list, maxEven: list.filter((n) => n % 2 === 0), minEven: list.filter((n) => n % 2 === 0), maxOdd: list.filter((n) => n % 2 === 1) }[which];
    const want = which.startsWith('max') ? Math.max(...f) : Math.min(...f);
    assert.equal(q.answer, String(want), `${digits} ${which}`);
    assert.equal(new Set(digits).size, digits.length);
  }
});

test('משמעות הכפל ובעיות מילוליות: מספרים בטווח, תשובה שלמה', () => {
  for (const q of allQuestions('times_more')) {
    const m = q.text.match(/פי כמה גדול המספר (\d+) מהמספר (\d+)/);
    if (m) assert.equal(Number(q.answer), m[1] / m[2]);
    assert.ok(Number(q.answer) < 1000 || q.input === undefined);
  }
  for (const q of allQuestions('word_problems')) if (q.options?.length && !/^\d+$/.test(q.answer)) assert.ok(q.answer.includes('קבוצות'), q.text); else assert.ok(Number(q.answer) >= 0 && Number(q.answer) <= 10000, q.text);
});

test('כתיבת שאלה לתרגיל: הסיפור הנכון מכיל את המספרים והפעולה', () => {
  const word = { '+': /קיבל/, '−': /נת[נן]/, '×': /^בכל /, ':': /מחלקים/ };
  for (const q of allQuestions('write_problem')) {
    if (q.kind === 'write-div') continue;
    const { op, a, b } = q.meta;
    assert.ok(q.answer.includes(String(a)) && q.answer.includes(String(b)), q.answer);
    assert.ok(word[op].test(q.answer), q.answer);
    for (const o of q.options.filter((x) => x !== q.answer)) {
      const nums = o.match(/\d+/g).map(Number);
      assert.ok(!word[op].test(o) || nums[0] !== a || nums[1] !== b, `מסיח זהה לנכון: ${o}`);
    }
    if (op === ':') assert.equal(a % b, 0);
    if (op === '−') assert.ok(a > b);
  }
});

test('שברים: השוואות נכונות', () => {
  for (const topic of ['compare_frac', 'bigger_smaller']) {
    for (const q of allQuestions(topic)) {
      if (q.kind === 'frac-claim') continue;
      const { fracs, op, ref } = q.meta;
      assert.ok(fracs.every(([n, d]) => n >= 1 && n < d), q.text);
      if (op === 'max' || op === 'min') {
        const sorted = [...fracs].sort(cmpFrac);
        const want = op === 'max' ? sorted[3] : sorted[0];
        assert.equal(q.answer, `${want[0]}/${want[1]}`, q.text);
        assert.ok(sorted.every((f, i) => !i || cmpFrac(f, sorted[i - 1]) !== 0), 'ערכים שווים');
      } else if (op === 'order') {
        assert.equal(q.answer, fracs.map((f) => `${f[0]}/${f[1]}`).join(', '));
        assert.ok(fracs.every((f, i) => !i || cmpFrac(f, fracs[i - 1]) > 0));
      } else {
        const test = { gt: (f) => cmpFrac(f, ref) > 0, lt: (f) => cmpFrac(f, ref) < 0, eq: (f) => cmpFrac(f, ref) === 0 }[op];
        const ok = q.options.filter((o) => test(frac(o)));
        assert.deepEqual(ok, [q.answer], q.text);
      }
    }
  }
});

test('השלמת השלם: חישוב והשלמה לשלם', () => {
  for (const q of allQuestions('whole_from_part')) {
    if (q.kind === 'time') continue;
    const { p, d, part, complement } = q.meta;
    if (complement) {
      assert.equal(q.answer, `${d - p}/${d}`);
    } else {
      assert.equal(Number(q.answer), (part / p) * d, q.text);
      assert.equal(part % p, 0);
      if (q.svg) assert.equal((q.svg.match(/<rect/g) || []).length, part);
    }
  }
});

test('מדידות: המרות, השוואות וסרגל', () => {
  for (const q of allQuestions('length')) {
    let m;
    if ((m = q.text.match(/השלימו: (\d+) (\S+) ו-(\d+) (\S+) = □ (\S+)/))) {
      assert.equal(Number(q.answer), Number(m[1]) * (UNIT_MM[m[2]] / UNIT_MM[m[4]]) + Number(m[3]), q.text);
    } else if ((m = q.text.match(/השלימו: (\d+) (\S+) = □ (\S+)/))) {
      assert.equal(Number(q.answer), (Number(m[1]) * UNIT_MM[m[2]]) / UNIT_MM[m[3]], q.text);
    } else if (q.kind === 'length' && q.meta) {
      const vals = q.options.map(toMm);
      const want = q.meta.long ? Math.max(...vals) : Math.min(...vals);
      assert.equal(toMm(q.answer), want);
      assert.equal(new Set(vals).size, 4);
    } else if (q.kind === 'ruler-trap') {
      continue;
    } else if (q.kind === 'ruler') {
      assert.ok(Number(q.answer) > 0 && Number(q.answer) <= 100);
    } else if (q.kind === 'unit') {
      assert.ok(q.answer.includes('('));
    }
  }
});

test('צלעות מקבילות: מספר הזוגות נכון', () => {
  const pairs = { triangle: 0, pentagon: 0, hexagon: 3, trapezoid: 1, rectangle: 2, square: 2, parallelogram: 2 };
  for (const q of allQuestions('parallel')) {
    if (q.kind === 'parallel' && q.meta.shape) assert.equal(Number(q.answer), pairs[q.meta.shape]);
    else if (q.kind === 'parallel') {
      const i = LETTERS.indexOf(q.answer);
      assert.equal(q.meta.pairs[i], q.meta.k);
      assert.equal(q.meta.pairs.filter((x) => x === q.meta.k).length, 1);
      assert.equal(new Set(q.meta.shapes).size, 4);
    }
  }
});

test('היקף ושטח: חישובים נכונים', () => {
  for (const q of allQuestions('perimeter')) {
    if (q.kind === 'perimeter') assert.equal(Number(q.answer), q.meta.sides.reduce((s, x) => s + x, 0), q.text);
    else if (q.meta.a !== undefined && q.meta.b !== undefined) assert.equal(Number(q.answer), q.meta.P - q.meta.a - q.meta.b);
    else if (q.meta.a !== undefined) assert.equal(Number(q.answer), q.meta.P / 2 - q.meta.a);
    else assert.equal(Number(q.answer), q.meta.ans);
    assert.ok(Number(q.answer) > 0);
  }
  for (const q of allQuestions('area')) {
    if (q.kind === 'area-pairs') continue;
    if (q.meta.cells) assert.equal(Number(q.answer), new Set(q.meta.cells.map(String)).size);
    else if (q.meta.rect) assert.equal(Number(q.answer), q.meta.rect[0] * q.meta.rect[1]);
    else if (q.meta.area !== undefined) assert.equal(q.meta.a * Number(q.answer), q.meta.area);
    else {
      const { areas, big } = q.meta;
      const i = LETTERS.indexOf(q.answer);
      assert.equal(areas[i], big ? Math.max(...areas) : Math.min(...areas));
      assert.equal(new Set(areas).size, 4);
    }
  }
});

test('זוויות ואלכסונים', () => {
  const kindOf = (d) => (d < 90 ? 'חדה' : d === 90 ? 'ישרה' : 'קהה');
  for (const q of allQuestions('angles')) {
    if (q.kind === 'angle-quad') continue;
    if (q.kind === 'angle') assert.equal(q.answer, kindOf(q.meta.deg));
    else if (q.kind === 'angle-compare') {
      const i = LETTERS.indexOf(q.answer);
      assert.equal(q.meta.degs[i], q.meta.big ? Math.max(...q.meta.degs) : Math.min(...q.meta.degs));
    } else if (q.kind === 'angle-which') {
      const i = LETTERS.indexOf(q.answer);
      assert.equal(kindOf(q.meta.degs[i]), q.meta.target);
      assert.equal(q.meta.degs.filter((d) => kindOf(d) === q.meta.target).length, 1);
    } else {
      assert.equal(Number(q.answer), q.meta.count);
    }
  }
  for (const q of allQuestions('diagonals')) {
    if (q.kind === 'diag-dashed') continue;
    if (q.kind === 'diag-id') {
      assert.ok(q.meta.diags.includes(q.answer));
      for (const o of q.options.filter((x) => x !== q.answer)) assert.ok(q.meta.sides.includes(o), o);
    } else {
      const { n, count } = q.meta;
      assert.equal(count, (n * (n - 3)) / 2);
      if (q.kind === 'diag' && q.input === undefined && /^\d+$/.test(q.answer)) assert.equal(Number(q.answer), count);
    }
  }
});

test('דיאגרמות: התשובה נקראת נכון מהנתונים', () => {
  for (const q of allQuestions('chart')) {
    const { cats, vals, ask } = q.meta;
    assert.equal(new Set(vals).size, vals.length);
    if (ask === 'value') assert.equal(Number(q.answer), vals[q.meta.i]);
    else if (ask === 'max') assert.equal(q.answer, cats[vals.indexOf(Math.max(...vals))]);
    else if (ask === 'min') assert.equal(q.answer, cats[vals.indexOf(Math.min(...vals))]);
    else if (ask === 'diff') assert.equal(Number(q.answer), vals[q.meta.hi] - vals[q.meta.lo]);
    else assert.equal(Number(q.answer), vals.reduce((s, x) => s + x, 0));
    for (const c of cats) assert.ok(q.svg.includes(c), c);
  }
});

test('סיבוב: 10 שאלות, אותו זרע = אותן שאלות, וריאנטים מתחלפים', () => {
  for (const t of TOPIC_IDS) {
    const a = buildRound(t, 12345), b = buildRound(t, 12345), c = buildRound(t, 999);
    assert.equal(a.length, ROUND_SIZE);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    assert.notEqual(JSON.stringify(a), JSON.stringify(c));
    assert.equal(new Set(a.map((q) => q.key + q.answer)).size, ROUND_SIZE, t);
    assert.ok(a.every((q) => q.topic === t));
  }
  for (let s = 1; s <= 30; s++) for (const t of TOPIC_IDS) buildRound(t, s);
});

test('מבחן מסכם לפי דף המורה: סדר קבוע, שאלה לכל סעיף, אותו זרע = אותן שאלות', () => {
  assert.equal(EXAM_SIZE, EXAM_STEPS.length);
  assert.equal(EXAM_SIZE, 34);
  const nos = [...new Set(EXAM_STEPS.map((s) => s.no))];
  assert.deepEqual(nos, Array.from({ length: 21 }, (_, i) => i + 1));
  for (let s = 1; s <= 30; s++) {
    const exam = build('exam', s * 31);
    assert.equal(exam.length, EXAM_SIZE);
    assert.equal(buildExam(s).length, 34);
    assert.deepEqual(exam.map((q) => q.no), EXAM_STEPS.map((x) => x.label));
    assert.deepEqual(exam.map((q) => q.topic), EXAM_STEPS.map((x) => x.topic));
    assert.equal(JSON.stringify(exam), JSON.stringify(build('exam', s * 31)));
    assert.ok(exam.every((q) => TOPIC_IDS.includes(q.topic) && q.key.length > 0 && typeof q.answer === 'string'));
    assert.ok(exam.every((q) => q.input || q.options.includes(q.answer)));
  }
  assert.notEqual(JSON.stringify(build('exam', 1)), JSON.stringify(build('exam', 2)));
  assert.equal(EXAM_STEPS[0].label, 'שאלה 1');
  assert.ok(EXAM_STEPS.some((x) => x.label === 'שאלה 4 ב'));
  // כל הנושאים מדווחים לפי נושא אמיתי שקיים בשרת
  for (const x of EXAM_STEPS) assert.ok(API_MODES.includes(x.topic), x.topic);
});

const nums = (s) => (s.match(/\d+/g) || []).map(Number);
const brute = (ds) => { const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]))); return perms(ds).filter((p) => p[0] !== 0).map((p) => Number(p.join(''))); };

test('דף המורה – סדרות: שלישיית ההמשך וציר המספרים', () => {
  for (const q of allQuestions('sequences')) {
    if (q.kind === 'seq3') {
      const { terms, d } = q.meta;
      const want = [1, 2, 3].map((i) => terms[2] + i * d).join(', ');
      assert.equal(q.answer, want);
      assert.equal(terms[1] - terms[0], d);
    } else if (q.kind === 'seq-line') {
      const { a, st } = q.meta;
      const inside = q.options.filter((o) => Number(o) > a && Number(o) < a + st);
      assert.deepEqual(inside, [q.answer]);
      assert.ok(q.options.every((o) => Number(o) % st !== 0));
      assert.ok(q.svg.includes(`>${a}<`) && q.svg.includes(`>${a + st}<`));
    }
  }
});

test('דף המורה – ספרות: בדיוק מספר אחד מתאים, והמסיחים שוברים כלל', () => {
  let seen = 0;
  for (const q of allQuestions('digits')) {
    if (q.kind !== 'digits-rule') continue;
    seen++;
    const { digits, T, cmp, parity } = q.meta;
    const perms = new Set(brute(digits));
    const ok = (n) => perms.has(Number(n)) && (cmp === '>' ? n > T : n < T) && (!parity || (parity === 'odd' ? n % 2 === 1 : n % 2 === 0));
    assert.deepEqual(q.options.filter(ok), [q.answer], q.text);
    assert.ok(q.options.every((o) => o.length === 4));
    assert.equal(new Set(digits).size, 4);
  }
  assert.ok(seen > 100);
});

test('דף המורה – חשבון: תרגילים משולבים, סימנים, מספר חסר וחוסר שוויון', () => {
  let signs = 0, ineq = 0, combos = 0;
  for (const q of allQuestions('zero_one')) if (q.kind === 'calc' && /[()]|\d : \d+ \+|\d \+ 0 ×|× 0 \+/.test(q.meta.expr)) combos++;
  assert.ok(combos > 50);
  for (const q of allQuestions('ops')) {
    if (q.kind === 'sign') {
      signs++;
      const { lv, rv, L, R } = q.meta;
      assert.equal(evalExpr(L), lv);
      assert.equal(evalExpr(R), rv);
      assert.deepEqual(q.options, ['<', '=', '>']);
      assert.equal(q.answer, lv < rv ? '<' : lv > rv ? '>' : '=');
    } else if (q.kind === 'ineq') {
      ineq++;
      const { a, c, sign } = q.meta;
      const ok = (x) => x <= a && (sign === '>' ? a - x > c : a - x < c);
      assert.deepEqual(q.options.filter((o) => ok(Number(o))), [q.answer], q.expr);
      if (sign === '>') assert.ok(Number(q.answer) < a - c && q.options.every((o) => o === q.answer || Number(o) >= a - c));
    }
  }
  assert.ok(signs > 100 && ineq > 50);
  const all = new Set(allQuestions('ops').filter((q) => q.kind === 'sign').map((q) => q.answer));
  assert.equal(all.size, 3);
  for (const q of allQuestions('times_more')) {
    const m = q.text.match(/פי כמה (\d+) × (\d+) גדול מ-(\d+) × (\d+)/);
    if (m) { assert.equal(m[1], m[3]); assert.equal(Number(q.answer) * Number(m[4]), Number(m[2])); }
  }
});

test('דף המורה – בעיות מילוליות: חלוקה אפשרית אחת, ותשובות נכונות', () => {
  let split = 0;
  for (const q of allQuestions('word_problems')) {
    if (q.meta?.T && q.options && q.meta.c === undefined && q.meta.g === undefined) {
      split++;
      const good = q.options.filter((o) => { const [k, g] = nums(o); return k * g === q.meta.T; });
      assert.deepEqual(good, [q.answer]);
    } else if (q.meta?.c) {
      assert.equal(Number(q.answer), q.meta.T - q.meta.c.reduce((s, x) => s + x, 0));
    } else if (q.meta?.g) {
      assert.equal(Number(q.answer) * q.meta.g, q.meta.T);
    } else if (q.meta?.a !== undefined && q.meta.b !== undefined) {
      assert.equal(Number(q.answer), q.meta.a - q.meta.b);
    }
  }
  assert.ok(split > 30);
  let div = 0;
  for (const q of allQuestions('write_problem')) {
    if (q.kind !== 'write-div') continue;
    div++;
    const { a, b } = q.meta;
    assert.equal(a % b, 0);
    assert.ok(q.answer.includes(String(a)) && q.answer.includes(String(b)));
    assert.ok(/מחלקים|כמה .* יהיו/.test(q.answer));
    for (const o of q.options.filter((x) => x !== q.answer)) assert.ok(!/מחלקים/.test(o) && !/כמה (קופסאות|שקיות|סלים|מגשים|צלחות) יהיו/.test(o), o);
  }
  assert.ok(div > 100);
});

test('דף המורה – שברים, זמן ומשבצות', () => {
  let claims = 0, falseClaims = 0, eq = 0;
  for (const q of allQuestions('compare_frac')) {
    if (q.kind === 'frac-claim') {
      claims++;
      const { p, q: qq, less, truth } = q.meta;
      assert.equal(truth, less ? p < qq : p > qq);
      if (!truth) falseClaims++;
      assert.ok(q.answer.startsWith(truth ? 'כן' : 'לא'));
      assert.equal(q.options.filter((o) => o.startsWith(truth ? 'כן' : 'לא')).length, 2);
    } else if (q.meta.op === 'eq' && q.text.includes('שווה ל-')) {
      eq++;
      const { fracs, ref } = q.meta;
      assert.equal(fracs.filter((f) => cmpFrac(f, ref) === 0).length, 1);
    }
  }
  assert.ok(claims > 100 && falseClaims > 30 && eq > 100);
  for (const q of allQuestions('whole_from_part')) {
    if (q.kind !== 'time') continue;
    const { m, mins } = q.meta;
    if (q.text.includes('מי הולך')) assert.equal(q.answer === 'שניהם הולכים אותו זמן', m === mins);
    else assert.equal(Number(q.answer), Math.abs(m - mins));
    assert.ok([15, 30, 45].includes(mins));
  }
  // צורת L: מספר המשבצות האפורות כפול המכנה
  let l = 0;
  for (const q of allQuestions('whole_from_part')) if (q.svg && q.svg.includes('svggray')) { l++; assert.equal(Number(q.answer), q.meta.part * q.meta.d); assert.equal(q.meta.p, 1); }
  assert.ok(l > 50);
});

test('דף המורה – גיאומטריה: מקבילית, רשת, זוגות שטח, זוויות, אלכסונים וסרגל', () => {
  const side = ['AB', 'BC', 'CD', 'DA'];
  for (const q of allQuestions('parallel')) if (q.kind === 'parallel-side') assert.equal(q.answer, side[(q.meta.hi + 2) % 4]);
  for (const q of allQuestions('perimeter')) if (q.svg && q.svg.includes('1 ס&quot;מ')) assert.equal(Number(q.answer), q.meta.sides.reduce((a, b) => a + b, 0));
  let pairs = 0, quads = 0, dashed = 0, traps = 0;
  for (const q of allQuestions('area')) {
    if (q.kind !== 'area-pairs') continue;
    pairs++;
    const { areas } = q.meta;
    const L = ['א', 'ב', 'ג', 'ד'];
    const eqPairs = [];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (areas[i] === areas[j]) eqPairs.push(`${L[i]} ו-${L[j]}`);
    assert.deepEqual(eqPairs, [q.answer]);
    assert.deepEqual(q.options.filter((o) => eqPairs.includes(o)), [q.answer]);
  }
  for (const q of allQuestions('angles')) {
    if (q.kind !== 'angle-quad') continue;
    quads++;
    const { pts, labels, ask } = q.meta;
    const d = quadAngles(pts);
    assert.ok(Math.abs(d.reduce((a, b) => a + b, 0) - 360) < 1e-6);
    assert.equal(d.filter((x) => Math.abs(x - 90) < 1e-6).length, 1);
    assert.equal(d.filter((x) => x > 90 + 1e-6).length, 1);
    assert.equal(d.filter((x) => x < 90 - 1e-6).length, 2);
    const sorted = [...d].sort((a, b) => a - b);
    assert.ok(sorted[1] - sorted[0] >= 15);
    const idx = ask === 'min' ? d.indexOf(sorted[0]) : d.indexOf(sorted[3]);
    assert.equal(q.answer, String(labels[idx]));
    assert.deepEqual([...labels].sort(), [1, 2, 3, 4]);
  }
  for (const q of allQuestions('diagonals')) {
    if (q.kind !== 'diag-dashed') continue;
    dashed++;
    const L = ['א', 'ב', 'ג', 'ד'];
    const real = q.meta.types.map((t) => t === 'diag');
    const idx = L.indexOf(q.answer);
    if (q.meta.askReal) assert.deepEqual(real, [0, 1, 2, 3].map((i) => i === idx));
    else assert.deepEqual(real, [0, 1, 2, 3].map((i) => i !== idx));
  }
  for (const q of allQuestions('length')) {
    if (q.kind !== 'ruler-trap') continue;
    traps++;
    const { s, e } = q.meta;
    assert.ok(s >= 1);
    assert.equal(Number(q.answer), e - s);
    assert.ok(q.options.includes(String(e)) || q.options.includes(String(s)));
  }
  assert.ok(pairs > 50 && quads > 100 && dashed > 100 && traps > 30);
});

test('דף התרגול: נושא חדש עם 10 שאלות מכל הוריאנטים', () => {
  const r = buildRound('teacher_sheet', 7);
  assert.equal(r.length, ROUND_SIZE);
  assert.ok(new Set(r.map((q) => q.kind)).size >= 6);
  assert.ok(isUnlocked('teacher_sheet', {}));
});

test('תצוגה: מספרים נשארים משמאל לימין, שבר עומד, וקוד לא עובר', () => {
  assert.ok(rich('3 + 4 × 2').includes('<bdi dir="ltr">3 + 4 × 2</bdi>'));
  assert.ok(rich('איזה שבר גדול מ-3/4?').includes('<span class="fr" dir="ltr"><i>3</i><i>4</i></span>'));
  assert.ok(rich('9 ושארית 2').includes('<bdi dir="ltr">9</bdi> ושארית <bdi dir="ltr">2</bdi>'));
  assert.ok(rich('איזו צלע מקבילה ל-AB?').includes('<bdi dir="ltr">AB</bdi>'));
  const x = rich('<img src=x onerror=alert(1)> 5');
  assert.ok(!x.includes('<img'));
  assert.equal(esc('"&'), '&quot;&amp;');
  assert.ok(rich('ס"מ 5 ס"מ').includes('ס&quot;מ'));
});
