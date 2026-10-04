import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PRICE, balanceOf, cleanAmount, haikuCost, historyOf, marker, parseCosts, parseEstimate, priceFor } from './costs.js';

const issue = (size, ...work) => ({
  body: `בקשה\n\n---\nנשלח\n${marker('estimate', { size, usd: 1 })}\n${work.map((usd) => marker('cost', { kind: 'work', usd, at: '2026-10-04T10:00:00Z' })).join('\n')}`,
});

test('estimate and cost notes are read back from the request', () => {
  const body = `טקסט\n---\n${marker('estimate', { size: 'large', usd: 3, note: 'שינוי -- גדול' })}\n${marker('cost', { kind: 'estimate', usd: 0.01, at: '2026-10-04T10:00:00Z' })}\n<!-- seder-cost {פגום} -->`;
  assert.deepEqual(parseEstimate(body), { size: 'large', usd: 3, note: 'שינוי - - גדול' });
  assert.deepEqual(parseCosts(body), [{ kind: 'estimate', usd: 0.01, at: '2026-10-04T10:00:00Z' }]);
  // בקשה ישנה – בלי הערכה ובלי עלות
  assert.equal(parseEstimate('סתם בקשה'), null);
  assert.deepEqual(parseCosts(undefined), []);
  // הערכה שנכשלה
  assert.deepEqual(parseEstimate(marker('estimate', { size: null, usd: null })), { size: null, usd: null, note: '' });
});

test('price follows what similar changes really cost', () => {
  assert.equal(priceFor('small', []), DEFAULT_PRICE.small);
  assert.equal(priceFor('unknown'), DEFAULT_PRICE.medium);
  const history = historyOf([issue('small', 0.32), issue('small', 0.2, 0.3), issue('small', 0.9), issue('large', 4), { body: 'ישנה' }]);
  assert.deepEqual(history.map((h) => h.size), ['small', 'small', 'small', 'large']);
  // החציון של 0.32, 0.5, 0.9 – מעוגל למעלה לעשרה סנט
  assert.equal(priceFor('small', history), 0.5);
  // היסטוריה של בקשה אחת בלבד לא מספיקה
  assert.equal(priceFor('large', history), DEFAULT_PRICE.large);
});

test('balance is what was typed minus what was spent since', () => {
  const credits = { amount: 10, setAt: '2026-10-04T09:00:00Z' };
  const old = { body: marker('cost', { kind: 'work', usd: 2, at: '2026-10-04T08:00:00Z' }) };
  assert.deepEqual(balanceOf(credits, [issue('small', 0.32, 0.5), old]), { amount: 10, setAt: credits.setAt, spent: 0.82, balance: 9.18 });
  assert.equal(balanceOf(null, []), null);
  assert.equal(cleanAmount('12,5$'), 12.5);
  assert.equal(cleanAmount(' 7 '), 7);
  assert.equal(cleanAmount(''), null);
  assert.equal(cleanAmount(-1), null);
  assert.equal(haikuCost({ input_tokens: 8000, output_tokens: 200 }), 0.009);
});
