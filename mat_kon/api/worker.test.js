import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker, { deps } from './worker.js';
import { fakeEnv } from './fake-env.js';
import { RECIPE_TOOL } from './extract.js';

let env;
let apiCalls;
let reply;

const recipeInput = {
  found: true, title: 'עוגת שוקולד', original_title: 'Chocolate cake', description: 'עוגה', category: 'עוגות',
  tags: ['פרווה'], servings: '12 פרוסות', prep_time: '15 דקות', cook_time: '30 דקות', total_time: '',
  ingredients: [{ title: '', items: ['2 ביצים', '1 כוס סוכר'] }],
  steps: [{ title: '', items: ['1. מערבבים', 'אופים'] }],
  tips: [], confidence: 'high', notes: '',
};

beforeEach(() => {
  env = fakeEnv();
  apiCalls = [];
  reply = () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_recipe', input: recipeInput }] });
  deps.anthropic = () => ({ beta: { messages: { create: async (p) => { apiCalls.push(p); return reply(apiCalls.length); } } } });
  deps.fetch = async (url) => {
    if (String(url).includes('cake.example')) {
      return new Response('<html><head><meta property="og:image" content="/img.jpg"><title>Cake</title></head><body>Chocolate cake recipe</body></html>');
    }
    return new Response('', { status: 404 });
  };
});

const call = (method, path, body, code = 'code123') =>
  worker.fetch(new Request(`https://api.example${path}`, {
    method,
    headers: { origin: 'https://mat-kon.pages.dev', 'x-access-code': code, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env);

test('rejects a wrong code and an unconfigured server', async () => {
  assert.equal((await call('GET', '/recipes', undefined, 'nope')).status, 401);
  assert.equal((await worker.fetch(new Request('https://api.example/recipes'), { ACCESS_CODE: 'x' })).status, 500);
  const pre = await worker.fetch(new Request('https://api.example/recipes', { method: 'OPTIONS', headers: { origin: 'https://mat-kon.pages.dev' } }), env);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), 'https://mat-kon.pages.dev');
});

test('adds a recipe from a link, with the source on top', async () => {
  const res = await call('POST', '/recipes', { url: 'תראו https://cake.example/choc?utm_source=x' });
  assert.equal(res.status, 200);
  const { recipe } = await res.json();
  assert.equal(recipe.title, 'עוגת שוקולד');
  assert.equal(recipe.category, 'עוגות');
  assert.equal(recipe.source.url, 'https://cake.example/choc');
  assert.equal(recipe.image, 'https://cake.example/img.jpg');
  assert.deepEqual(recipe.steps[0].items, ['מערבבים', 'אופים']);
  // הדף בלי מתכון מובנה: הסוכן מקבל את טקסט הדף וכלי רשת
  assert.match(apiCalls[0].messages[0].content, /Chocolate cake recipe/);
  assert.ok(apiCalls[0].tools.some((t) => t.name === 'web_fetch'));
  assert.equal(apiCalls[0].model, 'claude-opus-5-5');

  const list = await (await call('GET', '/recipes')).json();
  assert.equal(list.recipes.length, 1);
});

test('the same link updates the existing recipe instead of duplicating it', async () => {
  const first = (await (await call('POST', '/recipes', { url: 'https://cake.example/choc' })).json()).recipe;
  await call('PUT', `/recipes/${first.id}`, { favorite: true });
  const again = await (await call('POST', `/recipes/${first.id}/refresh`)).json();
  assert.equal(again.updated, true);
  assert.equal(again.recipe.id, first.id);
  assert.equal(again.recipe.favorite, true);
  assert.equal((await (await call('GET', '/recipes')).json()).recipes.length, 1);
});

test('continues after pause_turn and reports a link without a recipe', async () => {
  reply = (n) => (n === 1
    ? { stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', name: 'web_search' }] }
    : { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_recipe', input: { ...recipeInput, found: false, notes: 'אין כאן מתכון' } }] });
  const res = await call('POST', '/recipes', { url: 'https://cake.example/none' });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).error, 'אין כאן מתכון');
  assert.equal(apiCalls.length, 2);
});

test('edits, validates the category, and deletes', async () => {
  const { recipe } = await (await call('POST', '/recipes', { url: 'https://cake.example/choc' })).json();
  assert.equal((await call('PUT', `/recipes/${recipe.id}`, { category: 'לא קיים' })).status, 400);
  const edited = await (await call('PUT', `/recipes/${recipe.id}`, { category: 'קינוחים', id: 'hack', source: {} })).json();
  assert.equal(edited.recipe.category, 'קינוחים');
  assert.equal(edited.recipe.id, recipe.id);
  assert.equal(edited.recipe.source.url, 'https://cake.example/choc');
  assert.equal((await call('DELETE', `/recipes/${recipe.id}`)).status, 200);
  assert.equal((await call('GET', `/recipes/${recipe.id}`)).status, 404);
});

test('bad input', async () => {
  assert.equal((await call('POST', '/recipes', { url: 'בלי קישור' })).status, 400);
  assert.equal((await call('GET', '/other')).status, 404);
  assert.ok(RECIPE_TOOL.input_schema.properties.category.enum.includes('אחר'));
});
