// צוות – שרת הבוטים (Cloudflare Worker): האפליקציה (tsevet/web) ו-Telegram.
//   POST /app/<...>   – האפליקציה: כניסה, שיחות, זיכרון, עלויות, הגדרות (app.js). רק מהאתר של האפליקציה, עם הסוד של המכשיר
//   PUT  /app/upload  – העלאת תמונה / סרטון / שיר (נשמר ב-R2, דלי tsevet-files)
//   GET  /file/<id>   – קובץ שהועלה, בקישור זמני חתום (בלי סיסמה, כדי ש-<img> ו-<video> יוכלו לטעון אותו)
//   /render/<...>     – ה-workflow שעורך וידאו (render.js): מזדהה עם הטוקן של GitHub
//   POST /tg/<agent>  – עדכונים מ-Telegram (בודקים את הסיסמה ש-Telegram שולחת), נכנסים לתור של הצוות
//   POST /setup       – הקמה אחרי כל עלייה: כתובת, שם, תיאור ופקודות לכל בוט (נקרא מ-.github/workflows/tsevet.yml)
import { AGENTS, TG_KEYS as AGENT_KEYS, label } from './agents.js';
import { MAX_BYTES, kindOf, newId } from './app.js';
import { safeEqual } from './auth.js';
import { hookSecret, tg, tokenOf } from './telegram.js';

export { Team } from './team.js';

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const team = (env) => env.TEAM.get(env.TEAM.idFromName('main'));

const COMMANDS = [
  { command: 'costs', description: 'כמה זה עלה' },
  { command: 'memory', description: 'מה הצוות זוכר' },
  { command: 'reset', description: 'להתחיל את הנושא הזה מחדש' },
  { command: 'help', description: 'איך עובדים עם הצוות' },
];

async function setup(request, env) {
  const first = tokenOf(env, AGENT_KEYS[0]);
  if (!first || request.headers.get('x-setup') !== (await hookSecret(`setup:${first}`))) return json(401, { error: 'unauthorized' });
  const origin = new URL(request.url).origin;
  const bots = {};
  const report = {};
  for (const agent of AGENT_KEYS) {
    const token = tokenOf(env, agent);
    if (!token) {
      report[agent] = 'missing token';
      continue;
    }
    const me = await tg(env, token, 'getMe', {});
    bots[agent] = { id: me.id, username: me.username };
    await tg(env, token, 'setWebhook', {
      url: `${origin}/tg/${agent}`,
      secret_token: await hookSecret(token),
      allowed_updates: ['message'],
    });
    // שם, תיאור ופקודות – לא קריטי (Telegram מגביל שינוי שם בתדירות גבוהה)
    const extras = [
      ['setMyName', { name: label(agent) }],
      ['setMyShortDescription', { short_description: `${label(agent)} – ${AGENTS[agent].short}` }],
      ['setMyDescription', { description: `${label(agent)} מצוות השיווק: ${AGENTS[agent].short}.\nבוט פרטי.` }],
      ['setMyCommands', { commands: COMMANDS }],
    ];
    for (const [method, body] of extras) {
      try {
        await tg(env, token, method, body);
      } catch (e) {
        console.log(method, e.message);
      }
    }
    report[agent] = `@${me.username}`;
  }
  await team(env).fetch('https://team/bots', { method: 'POST', body: JSON.stringify({ bots }) });
  return json(200, report);
}

const MAX_BODY = 64 * 1024;

// קריאה ל-Durable Object. מחזיר { status, data }
async function call(env, path, body = {}, request = null) {
  const res = await team(env).fetch(`https://team${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: request?.headers.get('authorization') || '',
      'x-origin': request ? new URL(request.url).origin : '',
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

// כתובת מותרת? (* בהגדרה = כל רצף אותיות, לתת-כתובת של גרסה ב-Cloudflare Pages)
export function originAllowed(origin, list) {
  return (list || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    .some((pattern) => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+')}$`).test(origin));
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const headers = {
    'access-control-allow-methods': 'POST, PUT, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
  if (originAllowed(origin, env.ALLOWED_ORIGINS)) headers['access-control-allow-origin'] = origin;
  return headers;
}

// מחזיר קובץ מ-R2, כולל בקשה לחלק ממנו (Range) – כך סרטון מתנגן ואפשר לדלג בו
async function stream(request, env, key, type, extra = {}) {
  const wantsRange = request.headers.has('range');
  const obj = await env.FILES.get(key, wantsRange ? { range: request.headers } : undefined);
  if (!obj) return json(404, { error: 'not found' });
  const headers = { 'content-type': type || 'application/octet-stream', 'accept-ranges': 'bytes', 'x-content-type-options': 'nosniff', ...extra };
  if (wantsRange && obj.range) {
    const offset = obj.range.offset ?? obj.size - obj.range.suffix;
    const length = obj.range.length ?? obj.size - offset;
    headers['content-range'] = `bytes ${offset}-${offset + length - 1}/${obj.size}`;
    headers['content-length'] = String(length);
    return new Response(obj.body, { status: 206, headers });
  }
  headers['content-length'] = String(obj.size);
  return new Response(request.method === 'HEAD' ? null : obj.body, { headers });
}

// GET /file/<id>?e=<תוקף>&s=<חתימה>[&dl=1]
async function serveFile(request, env, url) {
  const id = url.pathname.slice('/file/'.length);
  if (!env.FILES || !/^[a-z0-9]{8,32}$/.test(id)) return json(404, { error: 'not found' });
  const check = await call(env, '/internal/file-check', { id, e: url.searchParams.get('e'), s: url.searchParams.get('s') });
  if (check.status !== 200) return json(403, { error: 'forbidden' });
  const ext = (check.data.type.split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '').replace('quicktime', 'mov').replace('mpeg', 'mp3');
  return stream(request, env, `files/${id}`, check.data.type, {
    'cache-control': 'private, max-age=3600',
    'cross-origin-resource-policy': 'cross-origin',
    'content-disposition': url.searchParams.get('dl') ? `attachment; filename="tsevet-${id.slice(0, 6)}.${ext}"` : 'inline',
  });
}

// PUT /app/upload?name=&type=&dur=&w=&h=&poster=   (הגוף = הקובץ)
async function upload(request, env, url, reply) {
  if (!env.FILES) return reply(503, { error: 'אחסון הקבצים לא מוגדר' });
  const auth = await call(env, '/app/auth', {}, request);
  if (auth.status !== 200) return reply(auth.status, auth.data);
  const q = url.searchParams;
  const type = String(q.get('type') || '').toLowerCase().slice(0, 80);
  const kind = kindOf(type);
  if (!kind) return reply(415, { error: 'אפשר להעלות תמונה, סרטון או שיר' });
  const max = MAX_BYTES[kind];
  const mb = Math.round(max / 1024 / 1024);
  const declared = Number(request.headers.get('content-length'));
  if (!declared) return reply(411, { error: 'קובץ ריק' });
  if (declared > max) return reply(413, { error: `הקובץ גדול מדי (עד ${mb}MB)` });
  const id = newId(16);
  const obj = await env.FILES.put(`files/${id}`, request.body, { httpMetadata: { contentType: type } });
  if (obj.size > max) {
    await env.FILES.delete(`files/${id}`);
    return reply(413, { error: `הקובץ גדול מדי (עד ${mb}MB)` });
  }
  const saved = await call(env, '/internal/file-add', {
    id, kind, type, size: obj.size, name: q.get('name') || '', dur: q.get('dur'), w: q.get('w'), h: q.get('h'), poster: q.get('poster') || '',
  });
  if (saved.status !== 200) {
    await env.FILES.delete(`files/${id}`);
    return reply(500, { error: 'ההעלאה לא הצליחה' });
  }
  const f = saved.data;
  return reply(200, { id: f.id, kind: f.kind, name: f.name, size: f.size, dur: f.dur, w: f.w, h: f.h });
}

// ה-workflow של עריכת הווידאו (tsevet-render.yml). מזדהה עם הטוקן של GitHub שיש גם לשרת
async function render(request, env, url) {
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!env.GITHUB_TOKEN || !env.FILES || !bearer || !safeEqual(bearer, env.GITHUB_TOKEN)) return json(403, { error: 'forbidden' });
  const id = url.searchParams.get('id') || '';
  const route = `${request.method} ${url.pathname}`;
  if (route === 'GET /render/job') {
    const r = await call(env, '/internal/render-job', { id });
    return json(r.status, r.data);
  }
  if (route === 'GET /render/input') {
    const r = await call(env, '/internal/render-input', { id, n: url.searchParams.get('n') });
    return r.status === 200 ? stream(request, env, r.data.key, r.data.type) : json(r.status, r.data);
  }
  if (route === 'PUT /render/result') {
    const fileId = newId(16);
    const obj = await env.FILES.put(`files/${fileId}`, request.body, { httpMetadata: { contentType: 'video/mp4' } });
    const r = obj.size ? await call(env, '/internal/render-done', { id, file: { id: fileId, size: obj.size } }) : { status: 400, data: { error: 'empty' } };
    if (r.status !== 200) await env.FILES.delete(`files/${fileId}`);
    return json(r.status, r.data);
  }
  if (route === 'POST /render/fail') {
    const r = await call(env, '/internal/render-fail', { id });
    return json(r.status, r.data);
  }
  return json(404, { error: 'not found' });
}

async function app(request, env, url) {
  const cors = corsHeaders(request, env);
  const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json' } });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  // רק מהאפליקציה עצמה (דפדפן מאתר אחר לא יכול לשלוח כלום)
  if (!cors['access-control-allow-origin']) return reply(403, { error: 'אסור' });
  if (request.method === 'PUT' && url.pathname === '/app/upload') return upload(request, env, url, reply);
  if (request.method !== 'POST') return reply(405, { error: 'method' });
  const text = await request.text();
  if (text.length > MAX_BODY) return reply(413, { error: 'גדול מדי' });
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return reply(400, { error: 'בקשה לא תקינה' });
  }
  const r = await call(env, url.pathname, body, request);
  return reply(r.status, r.data);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname.startsWith('/app/')) return app(request, env, url);
    if (pathname.startsWith('/file/') && (request.method === 'GET' || request.method === 'HEAD')) return serveFile(request, env, url);
    if (pathname.startsWith('/render/')) return render(request, env, url);
    if (request.method === 'GET' && pathname === '/') return new Response('צוות 🤖');
    if (request.method !== 'POST') return json(405, { error: 'method' });
    if (pathname === '/setup') return setup(request, env);

    const agent = pathname.match(/^\/tg\/(\w+)$/)?.[1];
    if (!agent || !AGENT_KEYS.includes(agent)) return json(404, { error: 'not found' });
    const token = tokenOf(env, agent);
    if (!token || request.headers.get('x-telegram-bot-api-secret-token') !== (await hookSecret(token))) {
      return json(401, { error: 'unauthorized' });
    }
    const update = await request.json().catch(() => null);
    if (update) await team(env).fetch('https://team/update', { method: 'POST', body: JSON.stringify({ agent, update }) });
    return new Response('ok');
  },
};
