import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  captionsToText, compactRecipe, findJsonLdRecipes, gatherSource, jsonAfter, looksComplete, metaTags,
  normalizeUrl, pageText, sourceKind, youtubeId,
} from './source.js';

test('normalizes links, also from shared text', () => {
  assert.equal(normalizeUrl('מתכון מעולה! https://www.foodis.co.il/r/1?utm_source=wa&x=1'), 'https://www.foodis.co.il/r/1?x=1');
  assert.equal(normalizeUrl('youtu.be/abc123XYZ?si=zz'), 'https://youtu.be/abc123XYZ');
  assert.equal(normalizeUrl('not a link'), null);
  assert.equal(normalizeUrl('http://localhost:8787/x'), null);
  assert.equal(normalizeUrl('http://10.0.0.1/x'), null);
  assert.equal(normalizeUrl('javascript:alert(1)'), null);
});

test('detects video sources', () => {
  assert.equal(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://youtube.com/shorts/AbCdEf12345'), 'AbCdEf12345');
  assert.equal(youtubeId('https://youtu.be/AbCdEf12345'), 'AbCdEf12345');
  assert.equal(sourceKind('https://m.youtube.com/watch?v=AbCdEf12345'), 'youtube');
  assert.equal(sourceKind('https://www.tiktok.com/@chef/video/123'), 'tiktok');
  assert.equal(sourceKind('https://vm.tiktok.com/ZMabc/'), 'tiktok');
  assert.equal(sourceKind('https://www.instagram.com/reel/Cx1/'), 'instagram');
  assert.equal(sourceKind('https://www.10dakot.co.il/recipe/x'), 'page');
});

const RECIPE_PAGE = `<html><head><title>עוגה &amp; קפה</title>
<meta property="og:image" content="https://img.example/cake.jpg">
<meta name="description" content="עוגת שוקולד &quot;בחושה&quot;">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},
{"@type":["Recipe"],"name":"עוגת שוקולד","recipeYield":["12","12 פרוסות"],"image":[{"url":"https://img.example/1.jpg"}],
"recipeIngredient":["2 ביצים","1 כוס <b>סוכר</b>"],
"recipeInstructions":[{"@type":"HowToSection","name":"בצק","itemListElement":[{"@type":"HowToStep","text":"מערבבים"}]},{"@type":"HowToStep","text":"אופים 30 דקות"}]}]}</script>
<script type="application/ld+json">{ broken </script>
</head><body><p>שלום</p><script>var x=1</script><p>עולם</p></body></html>`;

test('reads schema.org recipes and meta tags', () => {
  const [r] = findJsonLdRecipes(RECIPE_PAGE).map(compactRecipe);
  assert.equal(r.name, 'עוגת שוקולד');
  assert.deepEqual(r.ingredients, ['2 ביצים', '1 כוס סוכר']);
  assert.deepEqual(r.instructions, ['## בצק', 'מערבבים', 'אופים 30 דקות']);
  assert.equal(r.image, 'https://img.example/1.jpg');
  assert.equal(r.yield, '12 / 12 פרוסות');
  assert.ok(looksComplete({ recipes: [r] }));
  const meta = metaTags(RECIPE_PAGE);
  assert.equal(meta['<title>'], 'עוגה & קפה');
  assert.equal(meta.description, 'עוגת שוקולד "בחושה"');
  assert.equal(pageText(RECIPE_PAGE), 'שלום\nעולם');
});

test('parses YouTube player data and captions', () => {
  const html = 'x var ytInitialPlayerResponse = {"videoDetails":{"title":"פסטה {מהירה}","shortDescription":"מצרכים:\\n200 גרם פסטה"}};var y';
  assert.equal(jsonAfter(html, 'ytInitialPlayerResponse').videoDetails.shortDescription, 'מצרכים:\n200 גרם פסטה');
  assert.equal(captionsToText({ events: [{ segs: [{ utf8: 'שמים ' }, { utf8: 'מים' }] }, {}, { segs: [{ utf8: '\n' }] }] }), 'שמים מים');
});

test('gathers a YouTube video: oEmbed, description and captions', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    if (url.includes('/oembed')) return new Response('{"title":"T","author_name":"שף"}');
    if (url.includes('/watch')) {
      return new Response(`ytInitialPlayerResponse = {"videoDetails":{"title":"פסטה","author":"שף","shortDescription":"מצרכים: פסטה"},
        "captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=1","languageCode":"en"},{"baseUrl":"https://www.youtube.com/api/timedtext?v=2","languageCode":"iw","kind":"asr"}]}}};`);
    }
    if (url.includes('timedtext')) return new Response('{"events":[{"segs":[{"utf8":"מבשלים"}]}]}');
    return new Response('', { status: 404 });
  };
  const src = await gatherSource('https://youtu.be/AbCdEf12345', fakeFetch);
  assert.equal(src.kind, 'youtube');
  assert.equal(src.title, 'פסטה');
  assert.equal(src.description, 'מצרכים: פסטה');
  assert.equal(src.transcript, 'מבשלים');
  assert.equal(src.embed, 'https://www.youtube-nocookie.com/embed/AbCdEf12345');
  assert.ok(calls.some((u) => u.includes('timedtext?v=2&fmt=json3')), 'prefers the Hebrew track');
});

test('a blocked page is a warning, not a crash', async () => {
  const src = await gatherSource('https://blocked.example/r', async () => new Response('no', { status: 403 }));
  assert.equal(src.kind, 'page');
  assert.deepEqual(src.warnings, ['page: HTTP 403']);
});

test('a Pinterest pin: reads the pin and the recipe on the site it links to', async () => {
  assert.equal(sourceKind('https://pin.it/3abcDEF'), 'pinterest');
  assert.equal(sourceKind('https://il.pinterest.com/pin/123456789/'), 'pinterest');
  assert.equal(sourceKind('https://www.pinterest.co.uk/pin/123456789/'), 'pinterest');
  const recipePage = `<html><head><meta property="og:image" content="https://blog.example/cake.jpg"></head><body>
    <script type="application/ld+json">{"@type":"Recipe","name":"Lemon cake","recipeIngredient":["2 eggs","1 cup flour"],"recipeInstructions":["Mix","Bake"]}</script></body></html>`;
  const seen = [];
  const fetchFn = async (url) => {
    seen.push(String(url));
    if (url === 'https://pin.it/3abcDEF') return new Response('', { status: 302, headers: { location: 'https://www.pinterest.com/pin/987654321/sent/' } });
    if (String(url).startsWith('https://widgets.pinterest.com/')) {
      return Response.json({ data: [{ id: '987654321', grid_title: 'עוגת לימון', description: 'הכי טעימה', link: 'https://blog.example/lemon', pinner: { full_name: 'Dana' }, images: { '564x': { url: 'https://i.pinimg.com/564x/a.jpg' } } }] });
    }
    if (url === 'https://blog.example/lemon') return new Response(recipePage);
    return new Response('', { status: 404 });
  };
  const src = await gatherSource('https://pin.it/3abcDEF', fetchFn);
  assert.equal(src.kind, 'pinterest');
  assert.deepEqual([src.title, src.description, src.author, src.image], ['עוגת לימון', 'הכי טעימה', 'Dana', 'https://i.pinimg.com/564x/a.jpg']);
  assert.equal(src.linked[0].url, 'https://blog.example/lemon');
  assert.equal(src.linked[0].recipes[0].ingredients.length, 2);
  assert.ok(seen.includes('https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=987654321'));
  assert.equal(looksComplete(src), true);

  // בלי הממשק הציבורי: התיאור והקישור נלקחים מתוך דף הפין
  const pinHtml = `<html><head><meta property="og:title" content="Pasta"><meta property="og:description" content="Easy pasta"></head>
    <body><script>{"link":"https:\\/\\/www.pinterest.com\\/x","other":1,"link":"https:\\/\\/food.example\\/pasta"}</script></body></html>`;
  const src2 = await gatherSource('https://www.pinterest.com/pin/111222333/', async (url) => {
    if (url === 'https://www.pinterest.com/pin/111222333/') return new Response(pinHtml);
    if (url === 'https://food.example/pasta') return new Response('<html><body><p>Boil pasta with garlic and oil</p></body></html>');
    return new Response('', { status: 500 });
  });
  assert.deepEqual([src2.title, src2.description], ['Pasta', 'Easy pasta']);
  assert.equal(src2.linked[0].url, 'https://food.example/pasta');
  assert.match(src2.linked[0].text, /Boil pasta/);
});
