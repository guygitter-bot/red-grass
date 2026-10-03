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

async function invite(name = 'דנה') {
  return (await (await call('POST', '/invites', { name })).json()).invite;
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
  assert.equal(recipe.image, `data:image/png;base64,${PIXEL}`);
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
