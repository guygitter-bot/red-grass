import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, kidHtml } from '../public/view.js';

const kid = {
  id: 'abcdefgh1234', name: '<img src=x onerror=alert(1)>', lastSeen: 1,
  summary: {
    words: { attempts: 3, passed: true, attemptsToPass: 2, best: 86, average: 75, last: 86, missed: [{ en: 'cat', times: 2 }] },
    sentences: { attempts: 0, passed: false, attemptsToPass: null, best: null, average: null, last: null, missed: [] },
  },
  rounds: [{ mode: 'words', correct: 30, total: 35, percent: 86, at: 1 }],
};

test('שם לא יכול להכניס קוד לדף', () => {
  const html = kidHtml(kid);
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes(esc(kid.name)));
});

test('הכרטיס מראה מצב, ניסיונות ומילים קשות', () => {
  const html = kidHtml(kid);
  assert.ok(html.includes('עבר 80% אחרי 2 ניסיונות'));
  assert.ok(html.includes('עוד לא שיחק'));
  assert.ok(html.includes('cat'));
  assert.ok(html.includes('30/35'));
});
