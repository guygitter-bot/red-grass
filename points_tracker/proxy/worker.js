// שרת קטן (Cloudflare Worker) שמחזיק את מפתח ה-API של Anthropic.
// האפליקציה שולחת אליו את הבקשות עם קוד גישה, והוא מוסיף את המפתח ומעביר ל-Anthropic.
// כך המפתח לא נמצא באף טלפון ולא בקוד הציבורי של האתר.

import { SharedFoods } from './foods.js';

export { SharedFoods };

const UPSTREAM = 'https://api.anthropic.com';
const ALLOWED_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5']);
const MAX_TOKENS = 16000;
const MAX_BODY_BYTES = 8 * 1024 * 1024; // תמונה מוקטנת + טקסט

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  const headers = {
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': '*',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
  if (allowed.includes(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

function json(status, message, cors) {
  return new Response(JSON.stringify({ type: 'error', error: { type: 'proxy_error', message } }), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

// השוואה בזמן קבוע, כדי שלא יהיה אפשר לנחש את הקוד לפי זמני תגובה.
function sameCode(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (!env.ANTHROPIC_API_KEY || !env.ACCESS_CODE) return json(500, 'Proxy is not configured', cors);
    if (!sameCode(request.headers.get('x-access-code') || '', env.ACCESS_CODE)) {
      return json(401, 'Wrong access code', cors);
    }

    const url = new URL(request.url);

    // מאגר המאכלים המשותף
    if (url.pathname === '/foods') {
      if (!env.FOODS) return json(500, 'Shared foods storage is not configured', cors);
      const admin = env.ADMIN_CODE && sameCode(request.headers.get('x-admin-code') || '', env.ADMIN_CODE);
      const headers = new Headers({ 'content-type': 'application/json', 'x-is-admin': admin ? '1' : '0' });
      const body = ['POST', 'PUT'].includes(request.method) ? await request.text() : undefined;
      if (body && body.length > 20000) return json(413, 'Request too large', cors);
      const stub = env.FOODS.get(env.FOODS.idFromName('shared'));
      const res = await stub.fetch(new Request(url.toString(), { method: request.method, headers, body }));
      return new Response(res.body, { status: res.status, headers: { ...cors, 'content-type': 'application/json' } });
    }

    const isMessages = request.method === 'POST' && url.pathname === '/v1/messages';
    const isModel = request.method === 'GET' && /^\/v1\/models\/[\w.-]+$/.test(url.pathname);
    if (!isMessages && !isModel) return json(404, 'Not found', cors);

    let body;
    if (isMessages) {
      body = await request.text();
      if (body.length > MAX_BODY_BYTES) return json(413, 'Request too large', cors);
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return json(400, 'Invalid JSON', cors);
      }
      // רק מה שהאפליקציה צריכה, כדי שאי אפשר יהיה להשתמש בשרת לדברים אחרים.
      if (!ALLOWED_MODELS.has(parsed.model)) return json(400, 'Model not allowed', cors);
      if (!(parsed.max_tokens <= MAX_TOKENS)) return json(400, 'max_tokens too large', cors);
    }

    const headers = new Headers({
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01',
      'content-type': 'application/json',
    });
    const beta = request.headers.get('anthropic-beta');
    if (beta) headers.set('anthropic-beta', beta);

    const upstream = await fetch(`${UPSTREAM}${url.pathname}${url.search}`, { method: request.method, headers, body });
    const out = new Headers(cors);
    out.set('content-type', upstream.headers.get('content-type') || 'application/json');
    const requestId = upstream.headers.get('request-id');
    if (requestId) out.set('request-id', requestId);
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
