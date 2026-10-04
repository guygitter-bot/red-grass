// שרת קטן (Cloudflare Worker) שמחזיק את מפתח ה-API של Anthropic.
// האפליקציה שולחת אליו את הבקשות עם קוד גישה, והוא מוסיף את המפתח ומעביר ל-Anthropic.
// כך המפתח לא נמצא באף טלפון ולא בקוד הציבורי של האתר.

import { SharedFoods } from './foods.js';
import { sha256 } from './access.js';
import { feedbackRoute } from './feedback.js';

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
    const url = new URL(request.url);
    const store = () => env.FOODS.get(env.FOODS.idFromName('shared'));
    const internal = (path, method, body) =>
      store().fetch(new Request(`https://store${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }));
    const pass = (res) => new Response(res.body, { status: res.status, headers: { ...cors, 'content-type': 'application/json' } });
    const smallJson = async () => {
      const text = await request.text();
      if (text.length > 2000) return null;
      try {
        return JSON.parse(text) || {};
      } catch {
        return {};
      }
    };

    // פתיחת קישור הזמנה חד-פעמי: בלי קוד, הקישור עצמו הוא ההרשאה (פעם אחת).
    if (url.pathname === '/redeem' && request.method === 'POST') {
      if (!env.FOODS) return json(500, 'Storage is not configured', cors);
      const body = await smallJson();
      if (!body) return json(413, 'Request too large', cors);
      return pass(await internal('/access/redeem', 'POST', { token: body.token, deviceName: body.deviceName }));
    }

    const isAdmin = () => env.ADMIN_CODE && sameCode(request.headers.get('x-admin-code') || '', env.ADMIN_CODE);

    // צילום מסך של בקשת תיקון: רק לתהליך התיקון ב-GitHub (עם קוד המנהל)
    if (url.pathname === '/feedback/image' && request.method === 'GET') {
      if (!isAdmin()) return json(401, 'Admin only', cors);
      const res = await internal(`/feedback/shot?id=${encodeURIComponent(url.searchParams.get('id') || '')}`, 'GET');
      if (!res.ok) return json(404, 'Not found', cors);
      const { data } = await res.json();
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      return new Response(bytes, { headers: { 'content-type': 'image/jpeg' } });
    }

    // בעל האפליקציה (קוד גישה) או מכשיר שהוזמן (מפתח מכשיר)
    const isOwner = sameCode(request.headers.get('x-access-code') || '', env.ACCESS_CODE);
    let allowed = isOwner;
    let deviceName = isOwner ? 'בעל האפליקציה' : '';
    let deviceHash = '';
    const deviceKey = request.headers.get('x-device-key') || '';
    if (!allowed && env.FOODS && deviceKey && deviceKey.length <= 100) {
      deviceHash = await sha256(deviceKey);
      const res = await internal('/access/auth', 'POST', { hash: deviceHash });
      allowed = res.ok;
      if (allowed) deviceName = (await res.json()).name || '';
    }
    if (!allowed) return json(401, 'Wrong access code', cors);

    // הזמנות ומכשירים: רק בעל האפליקציה
    if (url.pathname === '/invites' || url.pathname === '/devices') {
      if (!isOwner) return json(403, 'Owner only', cors);
      if (!env.FOODS) return json(500, 'Storage is not configured', cors);
      if (url.pathname === '/invites' && request.method === 'POST') {
        const body = await smallJson();
        if (!body) return json(413, 'Request too large', cors);
        return pass(await internal('/access/invite', 'POST', { name: body.name }));
      }
      if (url.pathname === '/devices' && request.method === 'GET') return pass(await internal('/access/devices', 'GET'));
      if (url.pathname === '/devices' && request.method === 'DELETE') {
        return pass(await internal('/access/devices', 'DELETE', { id: url.searchParams.get('id') }));
      }
      return json(405, 'Method not allowed', cors);
    }

    // "שלח תיקון": בקשות, המצב שלהן, ואישור / דחייה / תשובה ל-Claude (feedback.js)
    if (url.pathname === '/feedback' || url.pathname.startsWith('/feedback/')) {
      const device = isOwner ? 'owner' : deviceHash;
      return pass(await feedbackRoute({ request, url, env, internal, device, from: deviceName }));
    }

    // מאגר המאכלים המשותף
    if (url.pathname === '/foods') {
      if (!env.FOODS) return json(500, 'Shared foods storage is not configured', cors);
      const admin = isAdmin();
      const headers = new Headers({ 'content-type': 'application/json', 'x-is-admin': admin ? '1' : '0' });
      const body = ['POST', 'PUT'].includes(request.method) ? await request.text() : undefined;
      if (body && body.length > 20000) return json(413, 'Request too large', cors);
      return pass(await store().fetch(new Request(`https://store/foods${url.search}`, { method: request.method, headers, body })));
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
