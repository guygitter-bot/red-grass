import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GOOGLEBOT, readEscapedMedia, captionFromOgDescription, instagram, instagramCode, linksIn, readInstagramEmbed, readInstagramJson, readTiktokPage,
  readYoutubeComments, youtubeCommentsToken,
} from './social.js';
import { gatherSource } from './source.js';
import { RECIPE_TOOL } from './extract.js';

const IG_GRAPHQL = {
  data: {
    xdt_shortcode_media: {
      owner: { username: 'chef_dana' },
      display_url: 'https://cdn.example/ig.jpg',
      edge_media_to_caption: { edges: [{ node: { text: 'עוגת גבינה פירורים 🍰 המתכון בתגובה הראשונה!' } }] },
      edge_media_to_parent_comment: {
        edges: [
          { node: { text: 'וואו איזה יופי', owner: { username: 'fan1' }, edge_threaded_comments: { edges: [] } } },
          {
            node: {
              text: 'מצרכים: 500 גרם גבינה 5%, 3 ביצים, כוס סוכר. אופן ההכנה: מערבבים ואופים 45 דקות ב-170 מעלות',
              owner: { username: 'chef_dana' },
              edge_threaded_comments: { edges: [{ node: { text: 'לפירורים: 2 כוסות קמח, 100 גרם חמאה', owner: { username: 'chef_dana' } } }] },
            },
          },
        ],
      },
    },
  },
};

test('reads Instagram caption and comments, creator first', () => {
  const into = readInstagramJson(IG_GRAPHQL, { caption: '', author: '', image: null, comments: [] });
  assert.equal(into.author, 'chef_dana');
  assert.match(into.caption, /המתכון בתגובה/);
  assert.equal(into.image, 'https://cdn.example/ig.jpg');
  assert.equal(into.comments.length, 3);
  assert.deepEqual(into.comments.filter((c) => c.byCreator).length, 2);
  assert.equal(instagramCode('https://www.instagram.com/reel/DXCJXPRjQfE/?igsh=MTU4'), 'DXCJXPRjQfE');
  assert.equal(instagramCode('https://www.instagram.com/p/Cx1/'), 'Cx1');
});

test('reads the public Instagram embed page', () => {
  const html = `<div class="Caption"><a class="CaptionUsername" href="#">chef_dana</a><br>שקשוקה ירוקה<br>מצרכים בתגובות<div class="CaptionComments">x</div></div>
    <span class="UsernameText">chef_dana</span>`;
  const into = readInstagramEmbed(html, { caption: '', author: '', image: null, comments: [] });
  assert.equal(into.caption, 'שקשוקה ירוקה\nמצרכים בתגובות');
  assert.equal(into.author, 'chef_dana');
  const ctx = JSON.stringify(JSON.stringify({ context: { gql_data: { shortcode_media: IG_GRAPHQL.data.xdt_shortcode_media } } }));
  const fromCtx = readInstagramEmbed(`<script>x = {"contextJSON":${ctx}}</script>`, { caption: '', author: '', image: null, comments: [] });
  assert.equal(fromCtx.comments.length, 3);
  assert.equal(captionFromOgDescription('1,234 likes, 56 comments - chef_dana on March 1, 2026: "פסטה ברוטב שמנת".'), 'פסטה ברוטב שמנת');
});

test('Instagram end to end: embed blocked, GraphQL works, recipe and comments reach the agent', async () => {
  const calls = [];
  const fakeFetch = async (url, init = {}) => {
    calls.push([init.method || 'GET', String(url)]);
    if (String(url).includes('/embed/')) return new Response('blocked', { status: 429 });
    if (String(url).endsWith('/graphql/query') && init.method === 'POST') {
      assert.match(init.body, /DXCJXPRjQfE/);
      return new Response(JSON.stringify(IG_GRAPHQL));
    }
    if (String(url).includes('instagram.com/reel/')) return new Response('<html><head><meta property="og:image" content="https://cdn.example/og.jpg"></head></html>');
    return new Response('', { status: 404 });
  };
  const src = await gatherSource('https://www.instagram.com/reel/DXCJXPRjQfE/', fakeFetch, { hint: 'עוגת גבינה מעולה' });
  assert.equal(src.kind, 'instagram');
  assert.equal(src.author, 'chef_dana');
  assert.match(src.description, /המתכון בתגובה/);
  assert.equal(src.comments[0].byCreator, true);
  assert.equal(src.text, '', 'no menu text from the social page');
  assert.equal(src.hint, 'עוגת גבינה מעולה');
  assert.deepEqual(src.warnings, []);
  assert.ok(src.debug[0].startsWith('instagram: embed-googlebot:HTTP 429, page-googlebot:empty, embed:HTTP 429, graphql:ok'));
  assert.ok(RECIPE_TOOL);
});

test('YouTube comments: finds the token and reads new and old comment shapes', () => {
  const initial = {
    contents: { x: [{ itemSectionRenderer: { sectionIdentifier: 'comment-item-section', contents: [{ continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'TOKEN1' } } } }] } }] },
  };
  assert.equal(youtubeCommentsToken(initial), 'TOKEN1');
  const res = {
    frameworkUpdates: { entityBatchUpdate: { mutations: [
      { payload: { commentEntityPayload: { properties: { content: { content: 'מגניב' } }, author: { displayName: '@fan' } } } },
      { payload: { commentEntityPayload: { properties: { content: { content: 'המתכון המלא: 2 כוסות קמח...' } }, author: { displayName: '@chef', isCreator: true } } } },
    ] } },
    x: { commentRenderer: { contentText: { runs: [{ text: 'ישן ' }, { text: 'וטוב' }] }, authorText: { simpleText: '@old' } } },
  };
  const comments = readYoutubeComments(res, 'chef');
  assert.equal(comments[0].author, '@chef');
  assert.equal(comments[0].byCreator, true);
  assert.deepEqual(comments.map((c) => c.text).sort(), ['ישן וטוב', 'המתכון המלא: 2 כוסות קמח...', 'מגניב'].sort());
});

test('TikTok page data and links in captions', () => {
  const data = { __DEFAULT_SCOPE__: { 'webapp.video-detail': { itemInfo: { itemStruct: { id: '7', desc: 'פסטה #מתכון', author: { uniqueId: 'chef' } } } } } };
  const html = `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(data)}</script>`;
  assert.deepEqual(readTiktokPage(html), { id: '7', caption: 'פסטה #מתכון', author: 'chef', image: null });
  assert.deepEqual(
    linksIn(['המתכון המלא באתר: www.chefblog.co.il/pasta. גם באינסטגרם https://instagram.com/x', 'https://linktr.ee/chef https://food.example/r/1)']),
    ['https://www.chefblog.co.il/pasta', 'https://food.example/r/1'],
  );
});

test('follows a blog link from the caption and reads its recipe', async () => {
  const blog = `<script type="application/ld+json">{"@type":"Recipe","name":"פסטה","recipeIngredient":["פסטה","שמנת"],"recipeInstructions":["מבשלים"]}</script>`;
  const fakeFetch = async (url) => {
    if (String(url).includes('/oembed')) return new Response(JSON.stringify({ title: 'פסטה', author_name: 'chef' }));
    if (String(url).includes('/watch')) return new Response('ytInitialPlayerResponse = {"videoDetails":{"title":"פסטה","author":"chef","shortDescription":"המתכון המלא: https://chefblog.example/pasta"}};');
    if (String(url).includes('chefblog.example')) return new Response(blog);
    return new Response('', { status: 404 });
  };
  const src = await gatherSource('https://youtu.be/AbCdEf12345', fakeFetch);
  assert.equal(src.linked.length, 1);
  assert.equal(src.linked[0].recipes[0].ingredients.length, 2);
});

// כך אינסטגרם מחזיר את דף ה-embed לבוט של גוגל: JSON של הפוסט בתוך מחרוזת (רמת escape אחת)
const MEDIA = {
  owner: { username: 'michi_blog' },
  display_url: 'https://cdn.example/basque.jpg',
  edge_media_to_caption: { edges: [{ node: { text: '⁨\t⁨\tלא סתם עוגת הגבינה הבאסקית כבשה את כולם.\nבתבנית אינגליש קייק.' } }] },
  edge_media_preview_comment: { edges: [{ node: { text: 'המתכון: 750 גרם גבינת שמנת, 4 ביצים', owner: { username: 'michi_blog' } } }] },
};
const escapedPage = (obj) => `<script>s.handle({"contextData":${JSON.stringify(JSON.stringify({ gql_data: obj }))}})</script>`;

test('reads the caption Instagram gives Googlebot (escaped JSON in the embed page)', async () => {
  const into = readEscapedMedia(escapedPage({ shortcode_media: MEDIA }), { caption: '', author: '', image: null, comments: [] });
  assert.equal(into.author, 'michi_blog');
  assert.match(into.caption, /עוגת הגבינה הבאסקית/);
  assert.equal(into.comments[0].byCreator, true);

  // רק הכיתוב (בלי אובייקט פוסט שלם)
  const only = readEscapedMedia(escapedPage({ x: { edge_media_to_caption: MEDIA.edge_media_to_caption } }), { caption: '', author: '', image: null, comments: [] });
  assert.match(only.caption, /אינגליש קייק/);

  const uas = [];
  const fakeFetch = async (url, init) => {
    uas.push([String(url), init.headers['user-agent']]);
    if (String(url).includes('/embed/captioned/') && init.headers['user-agent'] === GOOGLEBOT) return new Response(escapedPage({ shortcode_media: MEDIA }));
    return new Response('<title>Instagram</title> login', { status: 200 });
  };
  const ig = await instagram(fakeFetch, 'https://www.instagram.com/reel/DXCJXPRjQfE/?igsh=x');
  assert.equal(ig.caption.startsWith('לא סתם עוגת הגבינה הבאסקית'), true, 'direction marks and tabs removed');
  assert.equal(ig.author, 'michi_blog');
  assert.equal(ig.image, 'https://cdn.example/basque.jpg');
  assert.equal(uas[0][1], GOOGLEBOT);
});

test('falls back to the og:description of the post page', async () => {
  const og = '<meta property="og:url" content="https://www.instagram.com/michi_blog/reel/DXCJXPRjQfE/" />'
    + '<meta property="og:description" content="&#x200f;11K likes, 726 comments - michi_blog &#x5d1;-April 12, 2026: &quot;&#x2068;\t&#x5dc;&#x5d0; &#x5e1;&#x5ea;&#x5dd; &#x5e2;&#x5d5;&#x5d2;&#x5d4;&quot;" />';
  const fakeFetch = async (url) => (String(url).endsWith('/reel/DXCJXPRjQfE/') ? new Response(og) : new Response('', { status: 403 }));
  const ig = await instagram(fakeFetch, 'https://www.instagram.com/reel/DXCJXPRjQfE/');
  assert.equal(ig.caption, 'לא סתם עוגה');
  assert.equal(ig.author, 'michi_blog');
});

import { FACEBOOK_BOT, readFacebookPage } from './social.js';

test('Facebook group post through the preview bot', async () => {
  const html = `<meta property="og:title" content="&#x5e8;&#x5e2;&#x5d1;&#x5d9;&#x5dd; &#x5d1;&#x5e8;&#x5e2;&#x5d1;&#x5da; | 3 &#x5e7;&#x5d9;&#x5dc;&#x5d5; &#x5d1;&#x5e9;&#x5e8; &#x5de;&#x5e4;&#x5d5;&#x5e8;&#x5e7;.. | Facebook" />
    <meta property="og:image" content="https://cdn.example/fb.jpg" />
    <script>{"message":{"text":"3 \\u05e7\\u05d9\\u05dc\\u05d5 \\u05d1\\u05e9\\u05e8 \\u05de\\u05e4\\u05d5\\u05e8\\u05e7\\n\\u05de\\u05e6\\u05e8\\u05db\\u05d9\\u05dd: \\u05db\\u05ea\\u05e3 \\u05d1\\u05e7\\u05e8"}}</script>`;
  const fb = readFacebookPage(html);
  assert.equal(fb.group, 'רעבים ברעבך');
  assert.equal(fb.title, '3 קילו בשר מפורק..');
  assert.equal(fb.caption, '3 קילו בשר מפורק\nמצרכים: כתף בקר');
  assert.equal(fb.image, 'https://cdn.example/fb.jpg');

  const uas = [];
  const fakeFetch = async (url, init) => {
    uas.push(init.headers['user-agent']);
    return init.headers['user-agent'] === FACEBOOK_BOT ? new Response(html) : new Response('error', { status: 400 });
  };
  const src = await gatherSource('https://www.facebook.com/groups/hungryinyourhunger/permalink/2154404724737365/', fakeFetch);
  assert.equal(src.kind, 'facebook');
  assert.match(src.description, /מצרכים: כתף בקר/);
  assert.equal(src.author, 'רעבים ברעבך');
  assert.deepEqual(src.warnings, [], 'no second fetch with a normal browser');
  assert.equal(uas[0], FACEBOOK_BOT);

  // רק הכותרת (בלי JSON): לפחות תחילת הפוסט
  assert.equal(readFacebookPage(html.split('<script>')[0]).caption, '3 קילו בשר מפורק');
});
