import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, kidHtml, hardestTopics, hardestQuestions, TOPIC_IDS } from '../public/view.js';
import { MODES, TOPICS, MODE_TITLES } from '../../web/public/topics.js';
import { MODES as API_MODES } from '../../api/stats.js';

const empty = { attempts: 0, passed: false, attemptsToPass: null, best: null, average: null, last: null, missed: [] };
const kid = {
  id: 'abcdefgh1234', name: '<img src=x onerror=alert(1)>', lastSeen: 1,
  summary: {
    ops: { attempts: 3, passed: true, attemptsToPass: 2, best: 90, average: 75, last: 90, missed: [{ q: '47 : 5', times: 2 }] },
    area: { attempts: 2, passed: false, attemptsToPass: null, best: 60, average: 55, last: 60, missed: [{ q: '<b>x</b>', times: 1 }] },
    exam: { ...empty, sections: { angles: { correct: 0, total: 3 } } },
  },
  rounds: [{ mode: 'ops', correct: 9, total: 10, percent: 90, at: 1 }],
};

test('שם ושאלות לא יכולים להכניס קוד לדף', () => {
  const html = kidHtml(kid);
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<b>x</b>'));
  assert.ok(html.includes(esc(kid.name)));
});

test('הכרטיס מראה מצב, ניסיונות ושאלות קשות', () => {
  const html = kidHtml(kid);
  assert.ok(html.includes('עבר 80% אחרי 2 ניסיונות'));
  assert.ok(html.includes('עוד לא הגיע ל-80%'));
  assert.ok(html.includes('עבר 80% ב-1 מתוך 18 נושאים'));
  assert.ok(html.includes('47 : 5'));
  assert.ok(html.includes('9/10'));
  assert.ok(html.includes('המבחן המסכם עוד לא נעשה'));
});

test('נושאים שלא תורגלו לא מוצגים', () => {
  assert.ok(!kidHtml(kid).includes('צלעות מקבילות'));
});

test('הנושאים הכי קשים: ממוצע נמוך וגם תוצאות מהמבחן', () => {
  const hard = hardestTopics(kid.summary);
  assert.deepEqual(hard.map((h) => h.id), ['angles', 'area', 'ops']);
  assert.ok(hard[0].note.includes('במבחן 0%'));
  assert.deepEqual(hardestQuestions(kid.summary)[0], { id: 'ops', q: '47 : 5', times: 2 });
});

test('כרטיס הילד סגור, והשם הוא הכפתור שפותח', () => {
  const html = kidHtml(kid);
  assert.ok(html.startsWith('<details class="card kid"'));
  assert.ok(!html.startsWith('<details class="card kid" open'));
  assert.ok(html.indexOf('<summary class="head">') < html.indexOf('<h2>'));
});

test('הנושאים בניהול זהים לאפליקציה ולשרת', () => {
  assert.deepEqual([...TOPIC_IDS].sort(), TOPICS.map((t) => t.id).sort());
  assert.deepEqual([...API_MODES].sort(), [...MODES].sort());
  // אותו סדר ואותם שמות (בלי האימוג'י)
  const html = kidHtml({ id: 'x', name: 'א', summary: Object.fromEntries(TOPIC_IDS.map((id) => [id, { ...empty, attempts: 1, best: 50, average: 50, last: 50 }])) });
  for (const t of TOPICS) assert.ok(html.includes(MODE_TITLES[t.id]), t.id);
});
