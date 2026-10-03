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

const call = (method, path, body, session = '') =>
  worker.fetch(new Request(`https://api.example${path}`, {
    method,
    headers: {
      origin: 'https://mat-kon.pages.dev',
      'content-type': 'application/json',
      ...(session ? { authorization: `Bearer ${session}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env);

test('the owner app is open; an unconfigured server refuses', async () => {
  assert.equal((await call('GET', '/recipes')).status, 200);
  assert.deepEqual(await (await call('GET', '/me')).json().then((d) => [d.owner, d.user]), [true, null]);
  assert.equal((await worker.fetch(new Request('https://api.example/recipes'), {})).status, 500);
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

// ---------- הזמנות ומשתמשים ----------

async function invite(name = 'דנה', session = '') {
  return (await (await call('POST', '/invites', { name }, session)).json()).invite;
}

async function register(token, email = 'dana@example.com') {
  return call('POST', '/register', { token, name: 'דנה', email, password: 'secret12' });
}

test('an invited user registers once and gets an empty book of their own', async () => {
  await call('POST', '/recipes', { url: 'https://cake.example/owner' });
  const inv = await invite();
  assert.deepEqual(await (await call('POST', '/invite', { token: inv.token })).json(), { name: 'דנה', used: false, freeLimit: 10 });

  assert.equal((await call('POST', '/register', { token: inv.token, name: 'דנה', email: 'bad', password: 'secret12' })).status, 400);
  assert.equal((await call('POST', '/register', { token: inv.token, name: 'דנה', email: 'd@x.co', password: '123' })).status, 400);
  const reg = await register(inv.token);
  assert.equal(reg.status, 200);
  const { session, user } = await reg.json();
  assert.equal(user.plan, 'free');
  assert.equal(user.freeLimit, 10);
  assert.equal(user.hash, undefined);

  // הקישור חד-פעמי
  assert.equal((await register(inv.token, 'other@example.com')).status, 409);
  assert.equal((await call('POST', '/register', { token: 'nope-nope-nope', name: 'x', email: 'x@x.co', password: 'secret12' })).status, 404);

  // ספר נפרד: המשתמש לא רואה את המתכונים של בעל האפליקציה ולהפך
  assert.equal((await (await call('GET', '/recipes', undefined, session)).json()).recipes.length, 0);
  const mine = await (await call('POST', '/recipes', { url: 'https://cake.example/dana' }, session)).json();
  assert.equal(mine.user.added, 1);
  assert.equal((await (await call('GET', '/recipes')).json()).recipes.length, 1);
  const ownerId = (await (await call('GET', '/recipes')).json()).recipes[0].id;
  assert.equal((await call('GET', `/recipes/${ownerId}`, undefined, session)).status, 404);

  // משתמש שהוזמן לא מנהל הזמנות
  assert.equal((await call('GET', '/invites', undefined, session)).status, 403);
  const me = await (await call('GET', '/me', undefined, session)).json();
  assert.equal(me.owner, false);
  assert.equal(me.user.email, 'dana@example.com');
});

test('login on another device, logout, wrong password', async () => {
  const inv = await invite();
  await register(inv.token);
  assert.equal((await call('POST', '/login', { email: 'dana@example.com', password: 'wrong' })).status, 401);
  assert.equal((await call('POST', '/login', { email: 'nobody@example.com', password: 'secret12' })).status, 401);
  const { session } = await (await call('POST', '/login', { email: ' Dana@Example.com ', password: 'secret12' })).json();
  assert.equal((await call('GET', '/recipes', undefined, session)).status, 200);
  await call('POST', '/logout', {}, session);
  assert.equal((await call('GET', '/recipes', undefined, session)).status, 401);
  assert.equal((await call('GET', '/recipes', undefined, 'not-a-real-session')).status, 401);
});

test('after the free recipes an invited user must upgrade; the owner never does', async () => {
  env = fakeEnv({ FREE_RECIPES: '2', PAYMENT_URL: 'https://pay.example/matkon' });
  const inv = await invite();
  const { session, user } = await (await register(inv.token)).json();

  assert.equal((await call('POST', '/recipes', { url: 'https://cake.example/1' }, session)).status, 200);
  // אותו קישור שוב לא נספר
  assert.equal((await (await call('POST', '/recipes', { url: 'https://cake.example/1' }, session)).json()).updated, true);
  assert.equal((await call('POST', '/recipes', { url: 'https://cake.example/2' }, session)).status, 200);
  const calls = apiCalls.length;
  const blocked = await call('POST', '/recipes', { url: 'https://cake.example/3' }, session);
  assert.equal(blocked.status, 402);
  assert.deepEqual(await blocked.json().then((d) => [d.paywall, d.paymentUrl]), [true, 'https://pay.example/matkon']);
  assert.equal(apiCalls.length, calls, 'no Claude call when blocked');

  // רענון ועריכה של מתכונים קיימים עדיין עובדים
  const [first] = (await (await call('GET', '/recipes', undefined, session)).json()).recipes;
  assert.equal((await call('POST', `/recipes/${first.id}/refresh`, undefined, session)).status, 200);

  // בעל האפליקציה מסמן מנוי בתשלום
  const list = await (await call('GET', '/invites')).json();
  assert.equal(list.invites[0].user.added, 2);
  assert.equal((await call('PUT', `/users/${user.id}/plan`, { plan: 'paid' })).status, 200);
  assert.equal((await call('POST', '/recipes', { url: 'https://cake.example/3' }, session)).status, 200);

  for (let i = 0; i < 4; i++) assert.equal((await call('POST', '/recipes', { url: `https://cake.example/o${i}` })).status, 200);
});

test('deleting an invite removes the user and their recipes', async () => {
  const inv = await invite();
  const { session, user } = await (await register(inv.token)).json();
  await call('POST', '/recipes', { url: 'https://cake.example/dana' }, session);
  assert.equal((await call('DELETE', `/invites/${inv.token}`)).status, 200);
  assert.equal((await call('GET', '/recipes', undefined, session)).status, 401);
  assert.equal((await call('POST', '/login', { email: 'dana@example.com', password: 'secret12' })).status, 401);
  assert.equal(env.BOOK.objects.get(`user:${user.id}`).storage.map.size, 0, 'their recipes are deleted');
  const again = await (await call('GET', '/invites')).json();
  assert.equal(again.invites.length, 0);
});

// ---------- ייבוא מווטסאפ ----------

test('a recipe written in a WhatsApp message: no web tools, counted once, refreshable', async () => {
  const body = { key: 'wa:abc123', text: 'עוגה\nמצרכים: 2 ביצים, כוס סוכר\nאופים 30 דקות', chat: 'המשפחה', author: 'סבתא', date: '3.10.2026' };
  const res = await call('POST', '/recipes/text', body);
  assert.equal(res.status, 200);
  const { recipe } = await res.json();
  assert.deepEqual(recipe.source, { url: null, key: 'wa:abc123', kind: 'whatsapp', chat: 'המשפחה', author: 'סבתא', date: '3.10.2026', text: body.text });
  assert.equal(apiCalls[0].tools.length, 1, 'only submit_recipe');
  assert.match(apiCalls[0].messages[0].content, /WhatsApp/);
  assert.match(apiCalls[0].messages[0].content, /2 ביצים/);

  // אותה הודעה שוב מתעדכנת ולא נכפלת
  assert.equal((await (await call('POST', '/recipes/text', body)).json()).updated, true);
  const refreshed = await call('POST', `/recipes/${recipe.id}/refresh`);
  assert.equal(refreshed.status, 200);
  assert.match(apiCalls.at(-1).messages[0].content, /2 ביצים/);
  assert.equal((await (await call('GET', '/recipes')).json()).recipes.length, 1);

  assert.equal((await call('POST', '/recipes/text', { text: 'קצר' })).status, 400);
});

test('WhatsApp text recipes count toward the free recipes', async () => {
  env = fakeEnv({ FREE_RECIPES: '1' });
  const inv = await invite();
  const { session } = await (await register(inv.token)).json();
  const text = 'מצרכים: קמח, סוכר, ביצים. אופן ההכנה: מערבבים ואופים.';
  const first = await (await call('POST', '/recipes/text', { key: 'wa:1', text }, session)).json();
  assert.equal(first.user.added, 1);
  assert.equal((await call('POST', '/recipes/text', { key: 'wa:2', text: `${text} עוד` }, session)).status, 402);
});

// ---------- רשתות חברתיות ----------

test('an Instagram reel: caption, creator comments and the WhatsApp hint reach the agent', async () => {
  deps.fetch = async (url, init = {}) => {
    if (String(url).endsWith('/graphql/query') && init.method === 'POST') {
      return new Response(JSON.stringify({ data: { xdt_shortcode_media: {
        owner: { username: 'chef' },
        edge_media_to_caption: { edges: [{ node: { text: 'עוגת גבינה - המתכון בתגובות' } }] },
        edge_media_to_parent_comment: { edges: [{ node: { text: 'מצרכים: 500 גרם גבינה, 3 ביצים', owner: { username: 'chef' } } }] },
      } } }));
    }
    return new Response('', { status: 404 });
  };
  const res = await call('POST', '/recipes', { url: 'https://www.instagram.com/reel/DXCJXPRjQfE/?igsh=abc', hint: 'עוגת הגבינה של דנה' });
  assert.equal(res.status, 200);
  const prompt = apiCalls[0].messages[0].content;
  assert.match(prompt, /המתכון בתגובות/);
  assert.match(prompt, /\[CREATOR\] @chef: מצרכים: 500 גרם גבינה/);
  assert.match(prompt, /The person who shared this link wrote: עוגת הגבינה של דנה/);
  assert.ok(apiCalls[0].tools.some((t) => t.name === 'web_search'));
  const { recipe } = await res.json();
  assert.equal(recipe.source.url, 'https://www.instagram.com/reel/DXCJXPRjQfE/');
  assert.equal(recipe.source.hint, 'עוגת הגבינה של דנה');

  // רענון שולח שוב את אותו רמז
  await call('POST', `/recipes/${recipe.id}/refresh`);
  assert.match(apiCalls.at(-1).messages[0].content, /עוגת הגבינה של דנה/);

  const probe = await (await call('GET', `/debug/source?url=${encodeURIComponent('https://www.instagram.com/reel/DXCJXPRjQfE/')}`)).json();
  assert.equal(probe.comments, 1);
  assert.equal(probe.creatorComments, 1);
});

test('text pasted for a link that could not be read keeps the link on top and refreshes from the text', async () => {
  const link = 'https://www.facebook.com/groups/hungryinyourhunger/permalink/2154404724737365/';
  const res = await call('POST', '/recipes/text', { url: link, text: '3 קילו בשר מפורק. מצרכים: כתף בקר, בצל, יין אדום. מבשלים 6 שעות.' });
  assert.equal(res.status, 200);
  const { recipe } = await res.json();
  assert.equal(recipe.source.url, link);
  assert.equal(recipe.source.kind, 'facebook');
  assert.equal(recipe.source.key, undefined);
  assert.match(recipe.source.text, /כתף בקר/);
  assert.equal(apiCalls[0].tools.length, 1, 'no web tools for pasted text');
  assert.match(apiCalls[0].messages[0].content, /text the user copied from the post at https:\/\/www\.facebook\.com/);

  // אותו קישור שוב (גם דרך הוספה רגילה) מעדכן את אותו מתכון
  assert.equal((await (await call('POST', '/recipes/text', { url: link, text: 'מתכון מעודכן: כתף בקר, בצל, יין, 6 שעות בתנור' })).json()).updated, true);
  await call('POST', `/recipes/${recipe.id}/refresh`);
  assert.match(apiCalls.at(-1).messages[0].content, /מתכון מעודכן/);
  assert.equal((await (await call('GET', '/recipes')).json()).recipes.length, 1);
});

// ---------- מתכון מתמונה, מתכון ידני, רשימת קניות ----------

const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

test('a recipe from photos: images go to the agent, no web tools, counted, no refresh', async () => {
  const res = await call('POST', '/recipes/photo', {
    images: [{ type: 'image/png', data: PIXEL }, { type: 'image/jpeg', data: PIXEL }],
    hint: 'העוגה של סבתא',
    thumb: `data:image/png;base64,${PIXEL}`,
  });
  assert.equal(res.status, 200);
  const { recipe } = await res.json();
  assert.equal(recipe.source.kind, 'photo');
  assert.match(recipe.source.key, /^photo:/);
  assert.match(recipe.image, /^https:\/\/api\.example\/img\/book\//);
  const content = apiCalls[0].messages[0].content;
  assert.equal(content.filter((b) => b.type === 'image').length, 2);
  assert.match(content.at(-1).text, /photos of a recipe/);
  assert.match(content.at(-1).text, /העוגה של סבתא/);
  assert.equal(apiCalls[0].tools.length, 1);
  assert.equal((await call('POST', `/recipes/${recipe.id}/refresh`)).status, 400);

  assert.equal((await call('POST', '/recipes/photo', { images: [] })).status, 400);
  assert.equal((await call('POST', '/recipes/photo', { images: [{ type: 'text/html', data: 'x' }] })).status, 400);
});

test('a manual recipe is saved as written, without the agent and without the quota', async () => {
  env = fakeEnv({ FREE_RECIPES: '0' });
  const inv = await invite();
  const { session } = await (await register(inv.token)).json();
  const res = await call('POST', '/recipes/manual', {
    title: 'קציצות של אמא', category: 'בשר', servings: '4 מנות',
    ingredients: [{ title: '', items: ['500 גרם בשר טחון', 'בצל'] }], steps: [{ title: '', items: ['מערבבים', 'מטגנים'] }],
  }, session);
  assert.equal(res.status, 200);
  const { recipe } = await res.json();
  assert.equal(recipe.title, 'קציצות של אמא');
  assert.equal(recipe.source.kind, 'manual');
  assert.equal(apiCalls.length, 0);
  assert.equal((await call('POST', '/recipes/manual', { title: '' }, session)).status, 400);
  assert.equal((await call('POST', '/recipes/manual', { title: 'x', ingredients: [] }, session)).status, 400);
  // החלפת תמונה בעריכה
  assert.equal((await call('PUT', `/recipes/${recipe.id}`, { image: `data:image/png;base64,${PIXEL}` }, session)).status, 200);
  assert.equal((await call('PUT', `/recipes/${recipe.id}`, { image: 'javascript:alert(1)' }, session)).status, 400);
});

test('shopping list: saved per book, cleaned, and organized by the agent', async () => {
  assert.deepEqual((await (await call('GET', '/shopping')).json()).items, []);
  const put = await call('PUT', '/shopping', { items: [{ id: 'a', text: ' 2 כוסות קמח ', recipeId: 'r1', recipeTitle: 'עוגה' }, { text: '' }, { text: 'חלב', checked: 1 }] });
  const { items } = await put.json();
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { id: 'a', text: '2 כוסות קמח', checked: false, recipeId: 'r1', recipeTitle: 'עוגה' });
  assert.equal(items[1].checked, true);
  assert.equal((await (await call('GET', '/shopping')).json()).items.length, 2);

  // הספר של משתמש מוזמן נפרד
  const inv = await invite();
  const { session } = await (await register(inv.token)).json();
  assert.deepEqual((await (await call('GET', '/shopping', undefined, session)).json()).items, []);

  reply = () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_list', input: { groups: [{ title: 'מזווה', items: ['קמח: 3 כוסות'] }, { title: 'ריק', items: [] }] } }] });
  const org = await (await call('POST', '/shopping/organize', { items: ['2 כוסות קמח', '1 כוס קמח'] })).json();
  assert.deepEqual(org.groups, [{ title: 'מזווה', items: ['קמח: 3 כוסות'] }]);
  assert.match(apiCalls.at(-1).messages[0].content, /- 2 כוסות קמח\n- 1 כוס קמח/);
  assert.equal((await call('POST', '/shopping/organize', { items: [] })).status, 400);
});

test('weekly plan: saved per book and cleaned', async () => {
  assert.deepEqual((await (await call('GET', '/plan')).json()).plan, {});
  const plan = {
    '2026-10-04': [{ id: 'm1', recipeId: 'r1', title: 'שקשוקה', meal: 'ארוחת ערב' }, { title: '' }, { title: 'ארוחה בחוץ' }],
    '2026-10-05': [],
    'not-a-date': [{ title: 'x' }],
  };
  const saved = (await (await call('PUT', '/plan', { plan })).json()).plan;
  assert.deepEqual(Object.keys(saved), ['2026-10-04']);
  assert.equal(saved['2026-10-04'].length, 2);
  assert.deepEqual(saved['2026-10-04'][0], { id: 'm1', title: 'שקשוקה', recipeId: 'r1', meal: 'ארוחת ערב' });
  assert.equal((await (await call('GET', '/plan')).json()).plan['2026-10-04'][1].title, 'ארוחה בחוץ');
  assert.equal((await call('PUT', '/plan', { plan: [] })).status, 400);
  assert.equal((await call('PUT', '/plan', { plan: { '2026-10-04': 'x' } })).status, 400);
});

// ---------- קטגוריות משלי, חיפוש ברשת, דירוג ותגיות, גיבוי ושחזור ----------

test('custom categories: added, offered to the agent, accepted on edit, removed to "other"', async () => {
  assert.equal((await call('POST', '/categories', { name: 'עוגות' })).status, 409);
  assert.deepEqual((await (await call('POST', '/categories', { name: '  מתכוני סבתא ' })).json()).custom, ['מתכוני סבתא']);
  assert.ok((await (await call('GET', '/me')).json()).categories.includes('מתכוני סבתא'));

  reply = () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_recipe', input: { ...recipeInput, category: 'מתכוני סבתא' } }] });
  const { recipe } = await (await call('POST', '/recipes', { url: 'https://cake.example/grandma' })).json();
  assert.equal(recipe.category, 'מתכוני סבתא');
  assert.ok(apiCalls[0].tools.find((t) => t.name === 'submit_recipe').input_schema.properties.category.enum.includes('מתכוני סבתא'));
  assert.match(apiCalls[0].messages[0].content, /own categories: מתכוני סבתא/);

  assert.equal((await call('PUT', `/recipes/${recipe.id}`, { category: 'לא קיים' })).status, 400);
  const removed = await (await call('POST', '/categories/remove', { name: 'מתכוני סבתא' })).json();
  assert.deepEqual(removed, { custom: [], moved: 1 });
  assert.equal((await (await call('GET', `/recipes/${recipe.id}`)).json()).recipe.category, 'אחר');
  assert.equal((await call('POST', '/categories/remove', { name: 'עוגות' })).status, 400);
});

test('rating and tags are validated on edit', async () => {
  const { recipe } = await (await call('POST', '/recipes', { url: 'https://cake.example/choc' })).json();
  assert.equal((await (await call('PUT', `/recipes/${recipe.id}`, { rating: 4 })).json()).recipe.rating, 4);
  assert.equal((await call('PUT', `/recipes/${recipe.id}`, { rating: 9 })).status, 400);
  const tagged = await (await call('PUT', `/recipes/${recipe.id}`, { tags: [' לשבת ', 'לשבת', '', 'מהיר'] })).json();
  assert.deepEqual(tagged.recipe.tags, ['לשבת', 'מהיר']);
});

test('web search by dish name returns recipe links', async () => {
  reply = () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_results', input: { results: [
    { title: 'עוגת גבינה פירורים', url: 'https://www.10dakot.co.il/recipe/x', site: '10 דקות', description: 'קלאסית' },
    { title: 'bad', url: 'javascript:alert(1)', site: '', description: '' },
  ] } }] });
  const res = await (await call('POST', '/search', { q: 'עוגת גבינה פירורים' })).json();
  assert.deepEqual(res.results.map((r) => r.url), ['https://www.10dakot.co.il/recipe/x']);
  assert.ok(apiCalls[0].tools.some((t) => t.name === 'web_search'));
  assert.equal((await call('POST', '/search', { q: 'א' })).status, 400);
});

test('backup restore: valid recipes saved as they were, bad ones skipped, same source updates', async () => {
  const backup = {
    categories: ['מתכוני סבתא'],
    recipes: [
      { title: 'קציצות', category: 'מתכוני סבתא', rating: 5, favorite: true, myNotes: 'יותר שום', createdAt: '2025-01-01T10:00:00.000Z',
        ingredients: [{ title: '', items: ['בשר טחון'] }], steps: [{ title: '', items: ['מטגנים'] }], source: { url: 'https://site.example/r/1?utm_source=x', kind: 'page' } },
      { title: 'מהווטסאפ', ingredients: [{ title: '', items: ['קמח'] }], steps: [], source: { key: 'wa:abc', kind: 'whatsapp', text: 'קמח' } },
      { title: '', ingredients: [] },
      { title: 'בלי מצרכים', ingredients: [], steps: [] },
      { title: 'תמונה רעה', ingredients: [{ title: '', items: ['x'] }], image: 'javascript:1', source: {} },
    ],
  };
  const res = await (await call('POST', '/recipes/restore', backup)).json();
  assert.deepEqual(res, { restored: 3, skipped: 2, ids: {} });
  const list = (await (await call('GET', '/recipes')).json()).recipes;
  const meat = list.find((r) => r.title === 'קציצות');
  assert.equal(meat.category, 'מתכוני סבתא');
  assert.equal(meat.rating, 5);
  assert.equal(meat.createdAt, '2025-01-01T10:00:00.000Z');
  assert.equal(meat.source.url, 'https://site.example/r/1');
  assert.equal(list.find((r) => r.title === 'תמונה רעה').image, null);
  assert.equal(apiCalls.length, 0, 'no agent');
  // שחזור שוב לא מכפיל
  await call('POST', '/recipes/restore', backup);
  assert.equal((await (await call('GET', '/recipes')).json()).recipes.length, 3);
  assert.equal((await call('POST', '/recipes/restore', { recipes: 'x' })).status, 400);
});

test('pantry: saved per book and cleaned; a photo is scanned into items without saving', async () => {
  const put = await call('PUT', '/pantry', { items: [{ name: ' חלב ', place: 'fridge', qty: '1 ליטר' }, { name: 'אורז', place: 'weird' }, { name: '' }] });
  assert.equal(put.status, 200);
  const { items } = await (await call('GET', '/pantry')).json();
  assert.deepEqual(items.map((i) => [i.name, i.place, i.qty]), [['חלב', 'fridge', '1 ליטר'], ['אורז', 'fridge', undefined]]);
  assert.equal((await call('PUT', '/pantry', { items: 'x' })).status, 400);

  reply = () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_items', input: { items: [
    { name: 'שמנת מתוקה', qty: '2 קופסאות', place: 'fridge' }, { name: 'רסק עגבניות', qty: '', place: 'pantry' },
  ] } }] });
  const scan = await call('POST', '/pantry/scan', { images: [{ type: 'image/jpeg', data: 'AAAA' }], mode: 'many', place: 'fridge' });
  assert.equal(scan.status, 200);
  assert.deepEqual((await scan.json()).items.map((i) => i.name), ['שמנת מתוקה', 'רסק עגבניות']);
  assert.equal(apiCalls.at(-1).messages[0].content[0].type, 'image');
  assert.match(apiCalls.at(-1).messages[0].content.at(-1).text, /whole fridge/);
  // לא נשמר לפני אישור
  assert.equal((await (await call('GET', '/pantry')).json()).items.length, 2);
  assert.equal((await call('POST', '/pantry/scan', { images: [] })).status, 400);
});

test('recipe ideas from what is at home use web search', async () => {
  reply = () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_results', input: { results: [
    { title: 'פסטה ברוטב שמנת', url: 'https://food.example/pasta', site: 'food', description: 'משתמש בשמנת ובפסטה' },
  ] } }] });
  const res = await call('POST', '/pantry/ideas', { items: ['שמנת מתוקה', 'פסטה'], wish: 'מהיר' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).results[0].url, 'https://food.example/pasta');
  assert.match(apiCalls[0].messages[0].content, /שמנת מתוקה[\s\S]*מהיר/);
  assert.ok(apiCalls[0].tools.some((t) => t.type.startsWith('web_search')));
  assert.equal((await call('POST', '/pantry/ideas', { items: [] })).status, 400);
});

test('stores: nearby supermarkets from OpenStreetMap, chains recognized, prices estimated when there is no price list', async () => {
  deps.fetch = async (url) => {
    if (String(url).includes('overpass')) {
      return Response.json({ elements: [
        { type: 'node', id: 1, lat: 32.081, lon: 34.781, tags: { shop: 'supermarket', name: 'רמי לוי', 'addr:street': 'הרצל', 'addr:housenumber': '5' } },
        { type: 'way', id: 2, center: { lat: 32.09, lon: 34.79 }, tags: { shop: 'supermarket', brand: 'Shufersal', name: 'שופרסל דיל' } },
        { type: 'node', id: 3, lat: 32.0805, lon: 34.7805, tags: { shop: 'convenience', name: 'המכולת של משה' } },
      ] });
    }
    return new Response('', { status: 404 });
  };
  reply = () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_prices', input: { note: 'הערכה', chains: [
    { chain: 'שופרסל', total: 99, items: [{ item: 'שמנת', product: 'שמנת מתוקה 250 מ"ל', price: 6.9 }] },
    { chain: 'רמי לוי', total: 5.5, items: [{ item: 'שמנת', product: 'שמנת מתוקה 250 מ"ל', price: 5.5 }] },
  ] } }] });
  const res = await call('POST', '/stores', { lat: 32.08, lon: 34.78, items: ['שמנת מתוקה'] });
  assert.equal(res.status, 200);
  const { stores, prices } = await res.json();
  assert.deepEqual(stores.map((s) => s.chain), ['ramilevy', 'shufersal', null]);
  assert.equal(stores[0].address, 'הרצל 5');
  assert.ok(stores[0].orderUrl.startsWith('https://www.rami-levy.co.il'));
  assert.equal(prices.source, 'estimate');
  assert.deepEqual(prices.chains.map((c) => [c.chainName, c.total]), [['רמי לוי', 5.5], ['שופרסל', 6.9]]);
  assert.equal((await call('POST', '/stores', { lat: 'x', lon: 1 })).status, 400);
});

test('stores: with a Cheapersal key, real prices by barcode in the city, cheapest chain first', async () => {
  env.CHEAPERSAL_API_KEY = 'csal_test';
  const seen = [];
  deps.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('overpass')) return new Response('busy', { status: 504 });
    if (u.startsWith('https://api.cheapersal.co.il/api/v1/')) {
      seen.push([u, init.headers['X-API-Key']]);
      if (u.includes('/branches?')) {
        return Response.json({ success: true, data: { branches: [
          { id: 'b1', name: 'רמי לוי תלפיות', city: 'ירושלים', address: 'יד חרוצים 1', isOnline: false, location: { lat: 31.76, lon: 35.21 }, chain: { name: 'רמי לוי' } },
          { id: 'b2', name: 'שופרסל דיל תלפיות', city: 'ירושלים', address: 'פייר קניג 2', isOnline: false, location: { lat: 31.755, lon: 35.215 }, chain: { name: 'שופרסל דיל' } },
        ] } });
      }
      if (u.includes('/products/7290000000001/prices')) {
        return Response.json({ success: true, data: { product: { name: 'שמנת מתוקה 38%' }, prices: [
          { price: 6.9, chain: { name: 'שופרסל דיל' }, branch: { isOnline: false } },
          { price: 6.5, chain: { name: 'רמי לוי' }, branch: { isOnline: false }, promo: { promoPrice: 4.9, minQuantity: 1, requiresClub: false } },
          { price: 3, chain: { name: 'רמי לוי' }, branch: { isOnline: true } },
        ] } });
      }
      return Response.json({ success: false, error: { message: 'Product not found.' } }, { status: 404 });
    }
    return new Response('', { status: 404 });
  };
  reply = () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_barcodes', input: { products: [
    { item: 'שמנת מתוקה', barcode: '7290000000001', product: 'טרה שמנת מתוקה' },
    { item: 'פטרוזיליה', barcode: '', product: '' },
  ] } }] });
  const res = await call('POST', '/stores', { lat: 31.76, lon: 35.21, items: ['שמנת מתוקה', 'פטרוזיליה'] });
  assert.equal(res.status, 200);
  const { stores, prices } = await res.json();
  assert.deepEqual(stores.map((s) => s.chain), ['ramilevy', 'shufersal']);
  assert.equal(prices.source, 'cheapersal');
  assert.deepEqual(prices.chains.map((c) => [c.chainName, c.total]), [['רמי לוי', 4.9], ['שופרסל', 6.9]]);
  assert.match(prices.note, /1 מתוך 2.*ירושלים/);
  assert.ok(seen.every(([, key]) => key === 'csal_test'));
  assert.ok(seen.some(([u]) => u.includes('prices?city=%D7%99%D7%A8%D7%95%D7%A9%D7%9C%D7%99%D7%9D')));
});

test('errors from the AI service reach the user in Hebrew, never as raw JSON', async () => {
  const credit = Object.assign(new Error('400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}'), { status: 400 });
  deps.anthropic = () => ({ beta: { messages: { create: async () => { throw credit; } } } });
  const { session } = await (await register((await invite()).token)).json();

  const guest = await call('POST', '/search', { q: 'עוף' }, session);
  assert.equal(guest.status, 503);
  assert.equal((await guest.json()).error, 'השירות לא זמין כרגע. נסו שוב מאוחר יותר.');

  const owner = await (await call('POST', '/recipes', { url: 'https://cake.example/x' })).json();
  assert.match(owner.error, /נגמר הקרדיט.*console\.anthropic\.com/);

  const photo = await call('POST', '/recipes/photo', { images: [{ type: 'image/jpeg', data: 'AAAA' }] }, session);
  assert.equal(photo.status, 503);

  deps.anthropic = () => ({ beta: { messages: { create: async () => { throw Object.assign(new Error('529 overloaded'), { status: 529 }); } } } });
  assert.equal((await (await call('POST', '/shopping/organize', { items: ['חלב'] })).json()).error, 'יש עומס כרגע. נסו שוב בעוד דקה.');
});

test('Google sign-in: registers only with an invite, then logs in; the token is verified', async () => {
  assert.equal((await (await call('GET', '/auth-config')).json()).googleClientId, '');
  assert.equal((await call('POST', '/google', { credential: 'a.b.c' })).status, 400);

  env.GOOGLE_CLIENT_ID = 'cid.apps.googleusercontent.com';
  const claims = { aud: env.GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', email_verified: 'true', exp: String(Date.now() / 1000 + 600), sub: 'g-123', email: 'Dana@Gmail.com', name: 'דנה כהן' };
  deps.fetch = async (url) => {
    const u = new URL(url);
    if (u.hostname !== 'oauth2.googleapis.com') return new Response('', { status: 404 });
    const t = u.searchParams.get('id_token');
    if (t === 'good.jwt.token') return Response.json(claims);
    if (t === 'other.aud.token') return Response.json({ ...claims, aud: 'someone-else' });
    return Response.json({ error: 'invalid_token' }, { status: 400 });
  };
  assert.equal((await (await call('GET', '/auth-config')).json()).googleClientId, env.GOOGLE_CLIENT_ID);
  assert.equal((await call('POST', '/google', { credential: 'bad.jwt.token' })).status, 401);
  assert.equal((await call('POST', '/google', { credential: 'other.aud.token' })).status, 401);
  // בלי הזמנה אי אפשר להירשם
  assert.equal((await call('POST', '/google', { credential: 'good.jwt.token' })).status, 404);

  const inv = await invite();
  const reg = await call('POST', '/google', { credential: 'good.jwt.token', token: inv.token });
  assert.equal(reg.status, 200);
  const { session, user } = await reg.json();
  assert.deepEqual([user.name, user.email, user.plan], ['דנה כהן', 'dana@gmail.com', 'free']);
  assert.equal((await call('GET', '/me', undefined, session)).status, 200);
  // ההזמנה נוצלה
  assert.equal((await call('POST', '/google', { credential: 'good.jwt.token', token: inv.token })).status, 200);
  assert.equal((await (await call('POST', '/invite', { token: inv.token })).json()).used, true);
  // כניסה במכשיר אחר בלי הזמנה
  const again = await (await call('POST', '/google', { credential: 'good.jwt.token' })).json();
  assert.equal(again.user.id, user.id);
  // אין סיסמה למשתמש של גוגל
  const pw = await call('POST', '/login', { email: 'dana@gmail.com', password: 'whatever1' });
  assert.equal(pw.status, 401);
  assert.match((await pw.json()).error, /גוגל/);
});

test('Google sign-in links to an existing password user with the same email', async () => {
  env.GOOGLE_CLIENT_ID = 'cid';
  const { user } = await (await register((await invite()).token, 'same@example.com')).json();
  deps.fetch = async () => Response.json({ aud: 'cid', iss: 'accounts.google.com', email_verified: true, exp: Date.now() / 1000 + 60, sub: 's1', email: 'same@example.com' });
  const res = await (await call('POST', '/google', { credential: 'x.y.z' })).json();
  assert.equal(res.user.id, user.id);
});

test('locked owner book: only devices signed in with the owner password or Google account get in', async () => {
  // לא מוגדר: פתוח כמו קודם
  assert.equal((await call('GET', '/recipes')).status, 200);

  env.OWNER_PASSWORD = 'owner-secret-1';
  assert.equal((await (await call('GET', '/auth-config')).json()).ownerLocked, true);
  const locked = await call('GET', '/recipes');
  assert.equal(locked.status, 401);
  assert.equal((await locked.json()).login, true);
  assert.equal((await call('GET', '/me')).status, 401);
  assert.equal((await call('POST', '/recipes', { url: 'https://cake.example/x' })).status, 401);

  assert.equal((await call('POST', '/owner-login', { password: 'wrong' })).status, 401);
  const ok = await (await call('POST', '/owner-login', { password: 'owner-secret-1' })).json();
  assert.equal(ok.owner, true);
  assert.equal((await call('POST', '/recipes', { url: 'https://cake.example/owner' }, ok.session)).status, 200);
  const me = await (await call('GET', '/me', undefined, ok.session)).json();
  assert.deepEqual([me.owner, me.user], [true, null]);
  assert.equal((await (await call('GET', '/recipes', undefined, ok.session)).json()).recipes.length, 1);
  // ניהול הזמנות עובד במכשיר של הבעלים
  assert.equal((await call('GET', '/invites', undefined, ok.session)).status, 200);

  // משתמש מוזמן עדיין נרשם ורואה רק את הספר שלו
  const { session } = await (await register((await invite('דנה', ok.session)).token)).json();
  assert.equal((await (await call('GET', '/recipes', undefined, session)).json()).recipes.length, 0);
  assert.equal((await call('GET', '/invites', undefined, session)).status, 403);

  // יציאה מבטלת את המכשיר
  await call('POST', '/logout', {}, ok.session);
  assert.equal((await call('GET', '/recipes', undefined, ok.session)).status, 401);

  // הגבלת ניסיונות
  for (let i = 0; i < 10; i++) await call('POST', '/owner-login', { password: `bad${i}` });
  assert.equal((await call('POST', '/owner-login', { password: 'owner-secret-1' })).status, 429);
});

test('the owner can sign in with their Google account', async () => {
  env.GOOGLE_CLIENT_ID = 'cid';
  env.OWNER_EMAIL = 'Owner@Gmail.com';
  deps.fetch = async () => Response.json({ aud: 'cid', iss: 'accounts.google.com', email_verified: 'true', exp: Date.now() / 1000 + 60, sub: 'o1', email: 'owner@gmail.com' });
  assert.equal((await call('GET', '/recipes')).status, 401);
  const res = await (await call('POST', '/google', { credential: 'x.y.z' })).json();
  assert.equal(res.owner, true);
  assert.equal((await call('GET', '/recipes', undefined, res.session)).status, 200);
});

test('shared book: the holder invites a family member, both work on one book with one quota', async () => {
  const holder = await (await register((await invite()).token, 'yossi@example.com')).json();
  const link = await (await call('POST', '/members', {}, holder.session)).json();
  assert.ok(link.join.token);
  assert.deepEqual(await (await call('POST', '/join', { join: link.join.token })).json(), { bookName: 'דנה', freeLimit: 10 });

  const wife = await (await call('POST', '/register', { join: link.join.token, name: 'רונית', email: 'ronit@example.com', password: 'secret12' })).json();
  assert.equal(wife.user.role, 'member');
  assert.equal(wife.user.bookName, 'דנה');
  // הקישור חד-פעמי
  assert.equal((await call('POST', '/register', { join: link.join.token, name: 'x', email: 'x@example.com', password: 'secret12' })).status, 409);

  // אותו ספר: מה שאחד מוסיף השני רואה, והמכסה משותפת
  await call('POST', '/recipes', { url: 'https://cake.example/a' }, wife.session);
  await call('POST', '/recipes', { url: 'https://cake.example/b' }, holder.session);
  const seen = await (await call('GET', '/recipes', undefined, holder.session)).json();
  assert.equal(seen.recipes.length, 2);
  const me = await (await call('GET', '/me', undefined, wife.session)).json();
  assert.equal(me.user.added, 2);
  await call('PUT', '/shopping', { items: [{ text: 'חלב' }] }, wife.session);
  assert.equal((await (await call('GET', '/shopping', undefined, holder.session)).json()).items[0].text, 'חלב');

  // רק בעל הספר מנהל את השיתוף
  assert.equal((await call('POST', '/members', {}, wife.session)).status, 403);
  const list = await (await call('GET', '/members', undefined, holder.session)).json();
  assert.deepEqual(list.members.map((m) => m.name), ['רונית']);
  // בעל האפליקציה רואה כמה חברים יש בספר
  const inv = (await (await call('GET', '/invites')).json()).invites.find((i) => i.user?.email === 'yossi@example.com');
  assert.equal(inv.user.members, 1);

  // מנוי של בעל הספר חל על כולם
  for (let i = 0; i < 8; i++) await call('POST', '/recipes', { url: `https://cake.example/n${i}` }, holder.session);
  assert.equal((await call('POST', '/recipes', { url: 'https://cake.example/over' }, wife.session)).status, 402);
  await call('PUT', `/users/${holder.user.id}/plan`, { plan: 'paid' });
  assert.equal((await call('POST', '/recipes', { url: 'https://cake.example/over' }, wife.session)).status, 200);

  // הסרת חבר מנתקת אותו
  assert.equal((await call('DELETE', `/members/${wife.user.id}`, undefined, holder.session)).status, 200);
  assert.equal((await call('GET', '/recipes', undefined, wife.session)).status, 401);
  assert.equal((await (await call('GET', '/recipes', undefined, holder.session)).json()).recipes.length, 11);
  const removed = await call('POST', '/login', { email: 'ronit@example.com', password: 'secret12' });
  assert.equal(removed.status, 403);
  assert.match((await removed.json()).error, /הוסרתם מהספר/);
  assert.deepEqual((await (await call('GET', '/members', undefined, holder.session)).json()).members, []);
  // הצטרפות חוזרת עם קישור חדש
  const again = await (await call('POST', '/members', {}, holder.session)).json();
  const back = await call('POST', '/register', { join: again.join.token, name: 'רונית', email: 'ronit@example.com', password: 'newpass12' });
  assert.equal(back.status, 200);
  assert.equal((await (await call('GET', '/recipes', undefined, (await back.json()).session)).json()).recipes.length, 11);
});

test('shared book: deleting the holder removes the members; expired and pending links', async () => {
  const inv = await invite();
  const holder = await (await register(inv.token, 'h@example.com')).json();
  const { join } = await (await call('POST', '/members', {}, holder.session)).json();
  const pending = await (await call('POST', '/members', {}, holder.session)).json();
  assert.equal((await (await call('GET', '/members', undefined, holder.session)).json()).pending.length, 2);
  assert.equal((await call('DELETE', `/members/links/${pending.join.token}`, undefined, holder.session)).status, 200);
  assert.equal((await call('POST', '/join', { join: pending.join.token })).status, 404);
  const member = await (await call('POST', '/register', { join: join.token, name: 'm', email: 'm@example.com', password: 'secret12' })).json();
  await call('DELETE', `/invites/${inv.token}`);
  assert.equal((await call('GET', '/recipes', undefined, member.session)).status, 401);
  assert.equal((await call('POST', '/login', { email: 'm@example.com', password: 'secret12' })).status, 401);
});

test('shared book: the owner shares their own book, a member joins with Google', async () => {
  env.GOOGLE_CLIENT_ID = 'cid';
  env.OWNER_PASSWORD = 'owner-secret-1';
  const owner = await (await call('POST', '/owner-login', { password: 'owner-secret-1' })).json();
  await call('POST', '/recipes', { url: 'https://cake.example/owner' }, owner.session);
  const { join } = await (await call('POST', '/members', {}, owner.session)).json();
  assert.equal((await (await call('POST', '/join', { join: join.token })).json()).bookName, 'בעל האפליקציה');
  deps.fetch = async (url) => (String(url).includes('oauth2')
    ? Response.json({ aud: 'cid', iss: 'accounts.google.com', email_verified: 'true', exp: Date.now() / 1000 + 60, sub: 'w1', email: 'wife@gmail.com', name: 'אשתי' })
    : new Response('<title>Cake</title>'));
  const wife = await (await call('POST', '/google', { credential: 'a.b.c', join: join.token })).json();
  assert.equal(wife.user.ownerBook, true);
  assert.equal((await (await call('GET', '/recipes', undefined, wife.session)).json()).recipes.length, 1);
  // בלי מכסה בספר של בעל האפליקציה, ובלי ניהול הזמנות
  assert.equal((await call('POST', '/recipes', { url: 'https://cake.example/w' }, wife.session)).status, 200);
  assert.equal((await call('GET', '/invites', undefined, wife.session)).status, 403);
  assert.equal((await call('GET', '/members', undefined, wife.session)).status, 403);
  // כניסה חוזרת עם גוגל במכשיר אחר
  const again = await (await call('POST', '/google', { credential: 'a.b.c' })).json();
  assert.equal(again.user.ownerBook, true);
  assert.deepEqual((await (await call('GET', '/members', undefined, owner.session)).json()).members.map((m) => m.email), ['wife@gmail.com']);
});

test('lists change item by item: two family members editing at once keep both changes', async () => {
  const add = (text, id) => ({ op: 'add', id, item: { text, checked: false } });
  await call('POST', '/shopping/ops', { ops: [add('חלב', 'a'), add('לחם', 'b')] });
  // שני מכשירים עם אותה רשימה: אחד מוסיף ביצים, השני מסמן חלב
  await call('POST', '/shopping/ops', { ops: [add('ביצים', 'c')] });
  const res = await (await call('POST', '/shopping/ops', { ops: [{ op: 'update', id: 'a', item: { text: 'חלב', checked: true } }] })).json();
  assert.deepEqual(res.items.map((i) => [i.text, i.checked]), [['חלב', true], ['לחם', false], ['ביצים', false]]);
  // מחיקה של פריט שמישהו כבר מחק, ועדכון שלו – לא מחזירים אותו
  await call('POST', '/shopping/ops', { ops: [{ op: 'remove', id: 'b' }] });
  const after = await (await call('POST', '/shopping/ops', { ops: [{ op: 'update', id: 'b', item: { text: 'לחם', checked: true } }] })).json();
  assert.deepEqual(after.items.map((i) => i.text), ['חלב', 'ביצים']);
  assert.equal((await call('POST', '/shopping/ops', { ops: [{ op: 'add', id: 'x', item: { text: '' } }] })).status, 400);

  const pantry = await (await call('POST', '/pantry/ops', { ops: [{ op: 'add', id: 'p1', item: { name: 'אורז', place: 'pantry' } }] })).json();
  assert.equal(pantry.items[0].place, 'pantry');
  const plan = await (await call('POST', '/plan/ops', { ops: [
    { op: 'add', id: 'm1', item: { day: '2026-10-05', title: 'שקשוקה' } },
    { op: 'add', id: 'm2', item: { day: '2026-10-06', title: 'פסטה' } },
  ] })).json();
  assert.deepEqual(Object.keys(plan.plan), ['2026-10-05', '2026-10-06']);
  const moved = await (await call('POST', '/plan/ops', { ops: [{ op: 'update', id: 'm1', item: { day: '2026-10-06', title: 'שקשוקה' } }] })).json();
  assert.deepEqual(moved.plan['2026-10-06'].map((m) => m.title).sort(), ['פסטה', 'שקשוקה']);
  assert.equal(moved.plan['2026-10-05'], undefined);
});

test('refresh keeps what the user edited; a recipe edit with a broken shape is refused', async () => {
  const { recipe } = await (await call('POST', '/recipes', { url: 'https://cake.example/keep' })).json();
  await call('PUT', `/recipes/${recipe.id}`, { title: 'העוגה של סבתא', rating: 5, tags: ['של סבתא'] });
  const { recipe: fresh } = await (await call('POST', `/recipes/${recipe.id}/refresh`)).json();
  assert.equal(fresh.title, 'העוגה של סבתא');
  assert.equal(fresh.rating, 5);
  assert.deepEqual(fresh.tags, ['של סבתא']);
  assert.equal((await call('PUT', `/recipes/${recipe.id}`, { ingredients: 'oops' })).status, 400);
  assert.equal((await call('PUT', `/recipes/${recipe.id}`, { title: 12345 })).status, 400);
  assert.equal((await call('PUT', `/recipes/${recipe.id}`, { title: '  ' })).status, 400);
  const ok = await (await call('PUT', `/recipes/${recipe.id}`, { steps: [{ title: '', items: ['לערבב', 7] }] })).json();
  assert.deepEqual(ok.recipe.steps[0].items, ['לערבב', '7']);
});

test('the server fails closed: without an owner password the owner book is not open to everyone', async () => {
  env.OWNER_OPEN = undefined;
  assert.equal((await call('GET', '/recipes')).status, 401);
  assert.equal((await call('GET', '/invites')).status, 401);
  assert.equal((await call('GET', '/debug/source?url=https://cake.example/x')).status, 401);
  assert.equal((await (await call('GET', '/auth-config')).json()).ownerLocked, true);
});

test('AI output keeps decimal amounts (1.5 is not list numbering)', async () => {
  reply = () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_recipe', input: { ...recipeInput, ingredients: [{ title: '', items: ['1.5 כוסות קמח', '0.5 כפית מלח', '2. ביצים'] }] } }] });
  const { recipe } = await (await call('POST', '/recipes', { url: 'https://cake.example/dec' })).json();
  assert.deepEqual(recipe.ingredients[0].items, ['1.5 כוסות קמח', '0.5 כפית מלח', 'ביצים']);
});

test('quota cannot be bypassed: restore + refresh counts, parallel adds stop at the limit, AI routes have a daily budget', async () => {
  env = fakeEnv({ FREE_RECIPES: '3', AI_DAILY_FREE: '12' });
  const { session } = await (await register((await invite()).token)).json();
  // שחזור "מתכונים ריקים" ואז רענון – כל רענון ראשון נספר
  await call('POST', '/recipes/restore', { recipes: [1, 2, 3, 4].map((n) => ({ title: `stub${n}`, ingredients: [{ title: '', items: ['x'] }], source: { url: `https://cake.example/s${n}` } })) }, session);
  const ids = (await (await call('GET', '/recipes', undefined, session)).json()).recipes.map((r) => r.id);
  const statuses = [];
  for (const rid of ids) statuses.push((await call('POST', `/recipes/${rid}/refresh`, undefined, session)).status);
  assert.deepEqual(statuses.sort(), [200, 200, 200, 402]);
  // רענון שני של מתכון שכבר נקרא לא מוסיף מתכון – מותר גם כשהמכסה נגמרה
  const okId = ids[0];
  assert.equal((await call('POST', `/recipes/${okId}/refresh`, undefined, session)).status, 200);

  // משתמש חדש: 10 הוספות במקביל במכסה של 3 – רק 3 עוברות
  const other = await (await register((await invite('יוסי')).token, 'yossi@example.com')).json();
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) => call('POST', '/recipes', { url: `https://cake.example/p${i}` }, other.session)));
  assert.equal(results.filter((r) => r.status === 200).length, 3);
  assert.equal((await (await call('GET', '/me', undefined, other.session)).json()).user.added, 3);

  // תקציב יומי לפעולות AI (12 בתקציב החינמי בבדיקה הזו)
  reply = () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_list', input: { groups: [{ title: 'א', items: ['חלב'] }] } }] });
  const third = await (await register((await invite('רות')).token, 'rut@example.com')).json();
  const codes = [];
  for (let i = 0; i < 14; i++) codes.push((await call('POST', '/shopping/organize', { items: ['חלב'] }, third.session)).status);
  assert.equal(codes.filter((c) => c === 200).length, 12);
  assert.equal(codes.at(-1), 429);
});

test('rate limits on sign-in, sessions end when the owner password changes, logout everywhere', async () => {
  const { session } = await (await register((await invite()).token)).json();
  const codes = [];
  for (let i = 0; i < 12; i++) codes.push((await call('POST', '/login', { email: 'dana@example.com', password: `wrong${i}` })).status);
  assert.equal(codes.at(-1), 429);

  env.OWNER_PASSWORD = 'first-pass-1';
  const owner = await (await call('POST', '/owner-login', { password: 'first-pass-1' })).json();
  assert.equal((await call('GET', '/recipes', undefined, owner.session)).status, 200);
  env.OWNER_PASSWORD = 'second-pass-2';
  const fresh = fakeEnv({ OWNER_PASSWORD: 'second-pass-2' });
  // אותו אחסון, סיסמה חדשה: ה-DO קורא את הסיסמה מה-env שלו
  fresh.ACCOUNTS = env.ACCOUNTS;
  for (const obj of env.ACCOUNTS.objects.values()) obj.env = fresh;
  env = Object.assign(fresh, { BOOK: env.BOOK });
  assert.equal((await call('GET', '/recipes', undefined, owner.session)).status, 401);

  void session;
  const b = (await (await call('POST', '/register', { token: (await invite('ב', (await (await call('POST', '/owner-login', { password: 'second-pass-2' })).json()).session)).token, name: 'b', email: 'b@example.com', password: 'secret12' })).json()).session;
  const b2 = (await (await call('POST', '/login', { email: 'b@example.com', password: 'secret12' })).json()).session;
  assert.equal((await call('POST', '/logout-all', {}, b)).status, 200);
  assert.equal((await call('GET', '/recipes', undefined, b2)).status, 401);
});

test('Google proves the email: a squatted password account loses its password and sessions', async () => {
  env.GOOGLE_CLIENT_ID = 'cid';
  const squatter = await (await register((await invite()).token, 'victim@gmail.com')).json();
  deps.fetch = async () => Response.json({ aud: 'cid', iss: 'accounts.google.com', email_verified: 'true', exp: Date.now() / 1000 + 60, sub: 'v1', email: 'victim@gmail.com' });
  const victim = await (await call('POST', '/google', { credential: 'a.b.c' })).json();
  assert.equal(victim.user.id, squatter.user.id);
  assert.equal((await call('GET', '/recipes', undefined, squatter.session)).status, 401);
  assert.equal((await call('POST', '/login', { email: 'victim@gmail.com', password: 'secret12' })).status, 401);
});

test('a user deletes their own account (and their shared book)', async () => {
  const inv = await invite();
  const holder = await (await register(inv.token, 'h@example.com')).json();
  const { join } = await (await call('POST', '/members', {}, holder.session)).json();
  const member = await (await call('POST', '/register', { join: join.token, name: 'm', email: 'm@example.com', password: 'secret12' })).json();
  await call('POST', '/recipes', { url: 'https://cake.example/del' }, holder.session);
  assert.equal((await call('DELETE', '/account', undefined, holder.session)).status, 200);
  assert.equal((await call('GET', '/recipes', undefined, member.session)).status, 401);
  assert.equal((await call('POST', '/login', { email: 'h@example.com', password: 'secret12' })).status, 401);
  assert.equal((await call('POST', '/invite', { token: inv.token })).status, 404);
  assert.equal((await call('DELETE', '/account')).status, 400);
});

test('safe fetch: internal hosts and redirects to them are refused', async () => {
  const { isPublicUrl, safeFetch } = await import('./net.js');
  for (const u of ['http://localhost./x', 'http://127.0.0.1.nip.io/', 'http://10.0.0.1/', 'http://intranet/', 'http://a.internal/', 'file:///etc/passwd', 'http://user:pw@site.example/']) {
    assert.equal(isPublicUrl(u), false, u);
  }
  assert.equal(isPublicUrl('https://www.10dakot.co.il/recipe'), true);
  const hop = async (url) => (url.includes('start') ? new Response('', { status: 302, headers: { location: 'http://169.254.169.254/latest' } }) : new Response('secret'));
  await assert.rejects(() => safeFetch(hop, 'https://site.example/start'));
});

const waitJob = async (id, session) => {
  for (let i = 0; i < 50; i++) {
    const { job } = await (await call('GET', `/jobs/${id}`, undefined, session)).json();
    if (job.status === 'done' || job.status === 'error') return job;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('job did not finish');
};

test('background add: returns a job at once, the book finishes it, quota counted once', async () => {
  const { session } = await (await register((await invite()).token)).json();
  const res = await call('POST', '/recipes?async=1', { url: 'https://cake.example/bg' }, session);
  assert.equal(res.status, 202);
  const { job } = await res.json();
  const done = await waitJob(job.id, session);
  assert.equal(done.status, 'done');
  assert.equal(done.title, 'עוגת שוקולד');
  assert.equal(done.input, undefined);
  const recipes = (await (await call('GET', '/recipes', undefined, session)).json()).recipes;
  assert.equal(recipes.length, 1);
  assert.equal((await (await call('GET', '/me', undefined, session)).json()).user.added, 1);
  // אותו קישור שוב ברקע – לא נכפל ולא נספר
  const again = await (await call('POST', '/recipes?async=1', { url: 'https://cake.example/bg' }, session)).json();
  assert.equal((await waitJob(again.job.id, session)).updated, true);
  assert.equal((await (await call('GET', '/me', undefined, session)).json()).user.added, 1);
  // כשלון: המכסה חוזרת והשגיאה בעברית
  reply = () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_recipe', input: { ...recipeInput, found: false, notes: 'זה לא מתכון' } }] });
  const bad = await (await call('POST', '/recipes?async=1', { url: 'https://cake.example/no' }, session)).json();
  const failed = await waitJob(bad.job.id, session);
  assert.deepEqual([failed.status, failed.error], ['error', 'זה לא מתכון']);
  assert.equal((await (await call('GET', '/me', undefined, session)).json()).user.added, 1);
  // אי אפשר לראות עבודה של ספר אחר
  assert.equal((await call('GET', `/jobs/${job.id}`)).status, 404);
});

test('admin: AI costs per book and recent errors, owner only', async () => {
  reply = () => ({ stop_reason: 'tool_use', usage: { input_tokens: 1000, output_tokens: 200, server_tool_use: { web_search_requests: 2 } }, content: [{ type: 'tool_use', name: 'submit_recipe', input: recipeInput }] });
  const { session } = await (await register((await invite()).token)).json();
  await call('POST', '/recipes', { url: 'https://cake.example/cost' }, session);
  await call('POST', '/client-error', { where: 'home', message: 'boom' });
  const usage = await (await call('GET', '/admin/usage')).json();
  const dana = usage.rows.find((r) => r.name === 'דנה');
  assert.deepEqual([dana.ops, dana.calls, dana.input, dana.output, dana.searches], [1, 1, 1000, 200, 2]);
  assert.ok(dana.usd > 0);
  const { errors } = await (await call('GET', '/admin/errors')).json();
  assert.equal(errors[0].message, 'boom');
  assert.equal((await call('GET', '/admin/usage', undefined, session)).status, 403);
});

test('uploaded images are stored apart from the recipe and served by an unguessable link', async () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const { recipe } = await (await call('POST', '/recipes/manual', { title: 'עם תמונה', ingredients: [{ title: '', items: ['x'] }], image: png })).json();
  assert.match(recipe.image, /^https:\/\/api\.example\/img\/book\/[0-9a-f-]{36}$/);
  const img = await worker.fetch(new Request(recipe.image), env);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.equal(new Uint8Array(await img.arrayBuffer())[1], 0x50); // "PNG"
  assert.equal((await worker.fetch(new Request('https://api.example/img/book/00000000-0000-0000-0000-000000000000'), env)).status, 404);
  // החלפה ומחיקה מוחקות את הקובץ הישן
  await call('PUT', `/recipes/${recipe.id}`, { image: null });
  assert.equal((await worker.fetch(new Request(recipe.image), env)).status, 404);
});
