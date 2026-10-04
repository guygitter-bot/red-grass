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
