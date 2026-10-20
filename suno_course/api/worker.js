// השרת של אפליקציית הקורס "ערוץ מוזיקה מסונו" (Cloudflare Worker): מעביר שאלות ל-Claude.
//   POST /ai {messages: [{role, content}], tier: 'quick'|'default'|'complex', images?: [{media_type, data}]} -> {text}
//   התמונות (עד 4, base64) מצורפות להודעה האחרונה של המשתמש.
// מוגן בסיסמה (Authorization: Bearer <COURSE_PASSWORD>) כדי שאף אחד אחר לא ישתמש במפתח.
export const MODELS = { quick: 'claude-haiku-5-5', default: 'claude-sonnet-5-5', complex: 'claude-opus-5-5' };
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_IMAGES = 4;
const MAX_IMAGE_B64 = 3 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_CHARS = 150000;
const MAX_TURNS = 30;
const SYSTEM = 'אתה עוזר בתוך אפליקציית קורס בעברית על בניית ערוץ יוטיוב של מוזיקה שנוצרת ב-Suno. ההוראות המדויקות מגיעות בהודעה הראשונה של המשתמש. כשמבקשים JSON – עונים רק ב-JSON תקין.';

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const headers = {
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
  if (origin && env.ALLOWED_ORIGIN_RE && new RegExp(env.ALLOWED_ORIGIN_RE).test(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

// השוואה בזמן קבוע (שלא יהיה אפשר לנחש את הסיסמה לפי זמן התגובה)
export function sameSecret(a, b) {
  const x = new TextEncoder().encode(String(a || '')), y = new TextEncoder().encode(String(b || ''));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0 && x.length > 0;
}

// בדיקת השיחה שנשלחה: תפקידים, אורך, מתחילה ונגמרת במשתמש
export function cleanMessages(list) {
  if (!Array.isArray(list) || !list.length || list.length > MAX_TURNS) return null;
  const out = [];
  let chars = 0;
  for (const m of list) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) return null;
    chars += m.content.length;
    // תורות רצופות של אותו תפקיד מתאחדות
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += '\n\n' + m.content;
    else out.push({ role: m.role, content: m.content });
  }
  if (chars > MAX_CHARS || out[0].role !== 'user' || out[out.length - 1].role !== 'user') return null;
  return out;
}

// תמונות: סוג מותר, base64 בגודל סביר. null = בקשה לא תקינה
export function cleanImages(list) {
  if (list == null) return [];
  if (!Array.isArray(list) || list.length > MAX_IMAGES) return null;
  for (const im of list) {
    if (!im || !IMAGE_TYPES.includes(im.media_type) || typeof im.data !== 'string' || !im.data || im.data.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/=]+$/.test(im.data)) return null;
  }
  return list.map((im) => ({ type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } }));
}

// שגיאות מ-Anthropic בעברית
export function aiMessage(status, text) {
  const t = String(text || '').toLowerCase();
  if (/credit balance|billing|purchase credits/.test(t)) return 'נגמר הקרדיט בחשבון Anthropic (console.anthropic.com ← Billing).';
  if (status === 401 || status === 403) return 'מפתח ה-API של Anthropic לא תקין. צריך לעדכן אותו בסודות של GitHub.';
  if (status === 429 || status === 529 || status >= 500 || /overloaded|rate.?limit/.test(t)) return 'יש עומס כרגע. נסו שוב בעוד דקה.';
  return 'ה-AI לא הצליח לענות. נסו שוב.';
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const { pathname } = new URL(request.url);
    if (pathname === '/' || pathname === '/health') return reply(200, { ok: true });
    if (request.method !== 'POST' || pathname !== '/ai') return reply(404, { error: 'לא נמצא' });
    if (!env.ANTHROPIC_API_KEY || !env.COURSE_PASSWORD) return reply(503, { error: 'השרת לא מוגדר' });

    const auth = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!sameSecret(auth, env.COURSE_PASSWORD)) return reply(401, { error: 'הסיסמה לא נכונה', code: 'bad_key' });

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return reply(413, { error: 'השאלה ארוכה מדי' });
    let body;
    try { body = JSON.parse(raw); } catch { return reply(400, { error: 'בקשה לא תקינה' }); }
    const messages = cleanMessages(body.messages);
    const images = cleanImages(body.images);
    if (!messages || !images) return reply(400, { error: 'בקשה לא תקינה' });
    if (images.length) {
      const last = messages[messages.length - 1];
      last.content = [...images, { type: 'text', text: last.content }];
    }
    const model = MODELS[body.tier] || MODELS.default;

    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 4000, system: SYSTEM, messages }),
      });
    } catch {
      return reply(502, { error: 'אין חיבור ל-AI כרגע. נסו שוב.' });
    }
    const text = await res.text();
    if (!res.ok) return reply(502, { error: aiMessage(res.status, text) });
    let data;
    try { data = JSON.parse(text); } catch { return reply(502, { error: 'ה-AI לא הצליח לענות. נסו שוב.' }); }
    if (data.stop_reason === 'refusal') return reply(200, { error: 'ה-AI לא ענה על השאלה הזאת. נסו לנסח אחרת.', code: 'refused' });
    const out = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (!out) return reply(502, { error: 'ה-AI לא החזיר תשובה. נסו שוב.' });
    return reply(200, { text: out, truncated: data.stop_reason === 'max_tokens' });
  },
};
