import { test, expect } from 'vitest';
import { codeFrom, ranking } from './game';

test('קוד מתוך קישור או כפי שהוקלד', () => {
  expect(codeFrom('https://ma-hashir.pages.dev/?g=abcde')).toBe('ABCDE');
  expect(codeFrom(' ab2de ')).toBe('AB2DE');
  expect(codeFrom('שלום')).toBe('');
});

test('דירוג: ניקוד שווה – אותו מקום', () => {
  const r = ranking([{ id: 'a', total: 10 }, { id: 'b', total: 30 }, { id: 'c', total: 10 }]);
  expect(r.map((x) => [x.id, x.place])).toEqual([['b', 1], ['a', 2], ['c', 2]]);
});
