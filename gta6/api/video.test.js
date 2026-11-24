// צפייה בסרטון עם Gemini: יוטיוב ישירות, הורדה אוטומטית (GitHub Actions) והעלאה מהטלפון
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Library } from './worker.js';
import { pickWatchModel } from './google.js';

function fakeStorage() {
  const map = new Map();
  let alarm = null;
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    async get(k) { return clone(map.get(k)); },
    async put(k, v) { map.set(k, clone(v)); },
    async delete(k) { for (const kk of [k].flat()) map.delete(kk); },
    async list({ prefix = '' } = {}) {
      return new Map([...map.keys()].filter((k) => k.startsWith(prefix)).sort().map((k) => [k, clone(map.get(k))]));
    },
    async getAlarm() { return alarm; },
    async setAlarm(t) { alarm = t; },
  };
}

// Claude מדומה: קוד רק כשהחומר כולל את מה ש-Gemini ראה
function fakeAI(calls) {
  return {
    beta: {
      messages: {
        async create(req) {
          calls.push(req);
          const seen = JSON.stringify(req.messages).includes('video-watching AI');
          return {
            stop_reason: 'tool_use',
            content: [{ type: 'tool_use', name: 'file_video', input: {
              title: seen ? 'קוד לנשק מהמסך' : 'סרטון GTA', summary: 's', category: 'קודים', emoji: '🔫', tags: [],
              codes: seen ? [{ code: 'R1, R2, X', effect: 'נשק', platform: 'PlayStation' }] : [],
            } }],
          };
        },
      },
    },
  };
}

// Google, GitHub והדפים – מדומים
function fakeNet(log) {
  return async (url, init = {}) => {
    const u = String(url);
    log.push([init.method || 'GET', u, init]);
    if (u.startsWith('https://api.github.com/')) return new Response(null, { status: 204 });
    if (u.includes('/models?')) return Response.json({ models: [{ name: 'models/gemini-9-flash', supportedGenerationMethods: ['generateContent'] }] });
    if (u.includes('upload_id=1')) return Response.json({ file: { name: 'files/abc', uri: 'https://generativelanguage.googleapis.com/v1beta/files/abc', mimeType: 'video/mp4', state: 'PROCESSING' } });
    if (u.includes('/upload/v1beta/files')) return new Response('{}', { headers: { 'x-goog-upload-url': 'https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=1' } });
    if (u.endsWith('/files/abc')) return init.method === 'DELETE' ? Response.json({}) : Response.json({ state: 'ACTIVE' });
    if (u.includes(':generateContent')) return Response.json({ candidates: [{ content: { parts: [{ text: 'קודים:\nR1, R2, X — נשק' }] } }] });
    if (u.includes('/youtubei/')) return Response.json({ videoDetails: { title: 'GTA 6' } });
    return new Response('<title>reel</title>', { headers: { 'content-type': 'text/html' } });
  };
}

function fakeEnv(extra = {}) {
  const calls = [];
  const log = [];
  const env = {
    ALLOWED_ORIGINS: 'https://gta6-videos-97q.pages.dev', AI_CLIENT: fakeAI(calls), GEMINI_API_KEY: 'g', GITHUB_TOKEN: 'gh-secret',
    GITHUB_REPO: 'o/r', DAILY_VIDEOS: '40', ...extra,
  };
  env.FETCH = fakeNet(log);
  env.lib = new Library({ storage: fakeStorage() }, env);
  env.LIBRARY = { idFromName: (n) => n, get: () => ({ fetch: (req) => env.lib.fetch(req) }) };
  return { env, calls, log };
}

// fetch הגלובלי של השרת (Google) עובר דרך env.FETCH
async function req(env, path, { method = 'POST', body, headers = {} } = {}) {
  const res = await worker.fetch(new Request(`https://api.test${path}`, { method, headers: { 'content-type': 'application/json', ...headers }, body }), env);
  return { status: res.status, data: await res.json() };
}
const post = (env, path, data) => req(env, path, { body: JSON.stringify(data) });
const list = async (env) => (await post(env, '/list', {})).data.items;

test('YouTube: Gemini watches the link, then Claude reads again with what was seen', async () => {
  const { env, calls, log } = fakeEnv();
  await post(env, '/add', { url: 'https://youtu.be/dQw4w9WgXcQ' });
  await env.lib.alarm(); // קריאה ראשונה + תור לצפייה
  assert.equal((await list(env))[0].video.state, 'uploaded');
  await env.lib.alarm(); // צפייה + קריאה שנייה
  const item = (await list(env))[0];
  assert.equal(item.video.state, 'watched');
  assert.equal(item.title, 'קוד לנשק מהמסך');
  assert.deepEqual(item.codes.map((c) => c.code), ['R1, R2, X']);
  const watchCall = log.find(([, u]) => u.includes(':generateContent'));
  assert.match(watchCall[1], /gemini-9-flash/);
  assert.match(watchCall[2].body, /youtube\.com\/watch\?v=dQw4w9WgXcQ/);
  assert.equal(calls.length, 2);
});

test('Facebook: automatic download, upload, watch – and the file is deleted at Google', async () => {
  const { env, log } = fakeEnv();
  const { item } = (await post(env, '/add', { url: 'https://www.facebook.com/share/r/1JVJ2AkHeK/' })).data;
  await env.lib.alarm();
  assert.equal((await list(env))[0].video.state, 'fetching');
  const dispatch = log.find(([, u]) => u.includes('/dispatches'));
  assert.deepEqual(JSON.parse(dispatch[2].body), { event_type: 'gta6-fetch', client_payload: { id: item.id } });

  // ההורדה שואלת מה הקישור – רק עם הטוקן
  assert.equal((await req(env, `/video/job?id=${item.id}`, { method: 'GET' })).status, 401);
  const job = await req(env, `/video/job?id=${item.id}`, { method: 'GET', headers: { authorization: 'Bearer gh-secret' } });
  assert.equal(job.data.url, 'https://www.facebook.com/share/r/1JVJ2AkHeK/');

  const up = await req(env, `/video/upload?id=${item.id}`, { body: new Uint8Array(1000), headers: { 'content-type': 'video/mp4', 'content-length': '1000' } });
  assert.equal(up.status, 200);
  assert.equal(up.data.item.video.state, 'uploaded');
  await env.lib.alarm();
  const done = (await list(env))[0];
  assert.equal(done.video.state, 'watched');
  assert.equal(done.codes.length, 1);
  assert.ok(log.some(([m, u]) => m === 'DELETE' && u.endsWith('/files/abc')));
});

test('download failed -> asks to upload from the phone; uploads are checked', async () => {
  const { env } = fakeEnv();
  const { item } = (await post(env, '/add', { url: 'https://tiktok.com/@a/video/1' })).data;
  await env.lib.alarm();
  const failed = await req(env, '/video/fetch-failed', { body: JSON.stringify({ id: item.id, reason: 'too_big' }), headers: { authorization: 'Bearer gh-secret' } });
  assert.equal(failed.status, 200);
  const v = (await list(env))[0].video;
  assert.equal(v.state, 'need_upload');
  assert.match(v.error, /גדול מדי/);

  assert.equal((await req(env, `/video/upload?id=${item.id}`, { body: 'x', headers: { 'content-type': 'image/png', 'content-length': '1' } })).status, 415);
  assert.equal((await req(env, `/video/upload?id=${item.id}`, { body: 'x', headers: { 'content-type': 'video/mp4', 'content-length': String(200 * 1024 * 1024) } })).status, 413);
  assert.equal((await req(env, '/video/upload?id=nothere1', { body: 'x', headers: { 'content-type': 'video/mp4', 'content-length': '1' } })).status, 404);
});

test('no GitHub token: goes straight to "upload from the phone"; daily watch limit', async () => {
  const { env } = fakeEnv({ GITHUB_TOKEN: '', DAILY_VIDEOS: '1' });
  await post(env, '/add', { url: 'https://instagram.com/reel/x' });
  await env.lib.alarm();
  assert.match((await list(env))[0].video.error, /לא מחוברת/);

  await env.lib.storage.put('vday', { date: new Date().toISOString().slice(0, 10), count: 1 });
  await post(env, '/add', { url: 'https://youtu.be/aaaaaaaaaaa' });
  await env.lib.alarm();
  await env.lib.alarm();
  const yt = (await list(env)).find((i) => i.url.includes('youtu.be'));
  assert.equal(yt.video.state, 'failed');
  assert.match(yt.video.error, /מגבלה היומית/);
  // "לצפות בסרטון" שוב
  const again = await post(env, '/video/watch', { id: yt.id });
  assert.equal(again.data.item.video.state, 'uploaded');
});

test('without a Google key nothing changes', async () => {
  const { env } = fakeEnv({ GEMINI_API_KEY: '' });
  await post(env, '/add', { url: 'https://youtu.be/dQw4w9WgXcQ' });
  await env.lib.alarm();
  assert.equal((await list(env))[0].video, undefined);
  assert.equal((await post(env, '/video/watch', { id: (await list(env))[0].id })).status, 400);
});

test('picks the newest Flash model that can watch', () => {
  const m = (name, methods = ['generateContent']) => ({ name: `models/${name}`, supportedGenerationMethods: methods });
  assert.equal(pickWatchModel([m('gemini-2.5-flash'), m('gemini-3-flash-preview'), m('gemini-3-pro'), m('gemini-3-flash-image'), m('gemini-3-flash-lite')]), 'gemini-3-flash-preview');
  assert.equal(pickWatchModel([m('gemini-3-flash'), m('gemini-3-flash-preview')]), 'gemini-3-flash');
  assert.equal(pickWatchModel([m('gemini-3-pro')]), 'gemini-3-pro');
  assert.equal(pickWatchModel([m('gemini-3-flash', ['embedContent'])]), null);
});
