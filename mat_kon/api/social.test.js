import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  captionFromOgDescription, instagram, instagramCode, linksIn, readInstagramEmbed, readInstagramJson, readTiktokPage,
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
  assert.ok(src.debug[0].startsWith('instagram: embed:HTTP 429, graphql:ok'));
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
