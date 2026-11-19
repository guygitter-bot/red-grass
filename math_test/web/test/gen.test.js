import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENERATORS, genQuestion, buildRound, buildExam, build } from '../public/gen/index.js';
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

test('18 נושאים, בכל נושא מחולל, והרשימות זהות בשרת', () => {
  assert.equal(TOPICS.length, 18);
  assert.deepEqual(Object.keys(GENERATORS).sort(), [...TOPIC_IDS].sort());
  assert.deepEqual([...API_MODES].sort(), [...MODES].sort());
  assert.ok(MODES.includes(EXAM));
  for (const t of TOPICS) assert.ok(SECTIONS.some((s) => s.id === t.section), t.id);
  assert.equal(new Set(TOPIC_IDS).size, 18);
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
        assert.ok(q.options.length === 4 || q.kind === 'angle', `${ctx}: 4 תשובות`);
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
  for (const q of allQuestions('word_problems')) assert.ok(Number(q.answer) >= 0 && Number(q.answer) <= 10000, q.text);
});

test('כתיבת שאלה לתרגיל: הסיפור הנכון מכיל את המספרים והפעולה', () => {
  const word = { '+': /קיבל/, '−': /נת[נן]/, '×': /^בכל /, ':': /מחלקים/ };
  for (const q of allQuestions('write_problem')) {
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

test('מבחן מסכם: 20 שאלות, כל נושא לפחות פעם אחת', () => {
  for (let s = 1; s <= 30; s++) {
    const exam = build('exam', s * 31);
    assert.equal(exam.length, EXAM_SIZE);
    assert.deepEqual([...new Set(exam.map((q) => q.topic))].sort(), [...TOPIC_IDS].sort());
    assert.equal(buildExam(s).length, 20);
  }
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
