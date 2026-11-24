// צפייה בסרטון עם Gemini של Google: Gemini רואה את התמונה ושומע את הקול (Claude לא יכול).
// מה שהוא ראה ושמע (דיבור, טקסט על המסך – כולל קודים, ומה קורה) עובר אחר כך ל-Claude שכותב כותרת ומוציא קודים.
//
// קובץ וידאו עולה ל-Files API של Gemini (העלאה בשני שלבים), מחכים שיהיה ACTIVE, ואז generateContent.
// סרטון יוטיוב – Gemini צופה בו ישירות מהקישור (בלי העלאה).
export const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const UPLOAD = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
const FILE_NAME_RE = /^files\/[\w-]{1,64}$/;

export class GoogleError extends Error {
  constructor(status, raw) {
    super(googleMessage(status, raw));
    this.status = status;
    this.detail = String(raw || '').slice(0, 300);
  }
}

// שגיאות מ-Google בעברית
export function googleMessage(status, raw) {
  const t = String(raw || '').toLowerCase();
  if (status === 400 && /api key|api_key/.test(t)) return 'מפתח Google לא תקין. צריך לעדכן את GEMINI_API_KEY בסודות של GitHub.';
  if (status === 402 || /credits are depleted|prepay/.test(t)) return 'נגמר הקרדיט בחשבון Google (ai.studio ← Billing).';
  if (status === 401 || status === 403) return 'למפתח של Google אין הרשאה לצפות בסרטונים.';
  if (status === 429 || status >= 500) return 'יש עומס אצל Google כרגע. ננסה שוב בעוד דקה.';
  if (status === 413 || /too large|exceeds/.test(t)) return 'הסרטון ארוך או גדול מדי לצפייה.';
  return 'לא הצלחתי לצפות בסרטון.';
}

export const googleTemporary = (e) => e?.status === 429 || e?.status >= 500;

const headers = (env, extra = {}) => ({ 'x-goog-api-key': env.GEMINI_API_KEY, ...extra });
const doFetch = (env) => env.FETCH || fetch;

async function ok(res) {
  if (res.ok) return res;
  throw new GoogleError(res.status, await res.text().catch(() => ''));
}

// ---------- בחירת המודל ----------
// שמות המודלים משתנים – בוחרים מהרשימה של Google את ה-Flash החדש ביותר שיודע generateContent
// (אפשר לקבוע ידנית: WATCH_MODEL ב-wrangler.toml)
const SKIP_RE = /image|tts|audio|live|embed|lite|omni|veo|imagen|robotics|computer|thinking|exp/;
const version = (name) => Number(name.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] || 0);

export function pickWatchModel(models) {
  const ok = (models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => String(m.name || '').replace(/^models\//, ''))
    .filter((n) => /^gemini-\d/.test(n) && !SKIP_RE.test(n));
  const rank = (n) => [/flash/.test(n) ? 1 : 0, version(n), /preview/.test(n) ? 0 : 1];
  ok.sort((a, b) => {
    const [x, y] = [rank(a), rank(b)];
    return y[0] - x[0] || y[1] - x[1] || y[2] - x[2] || a.localeCompare(b);
  });
  return ok[0] || null;
}

export async function listModels(env) {
  const res = await ok(await doFetch(env)(`${BASE}/models?pageSize=200`, { headers: headers(env) }));
  return (await res.json()).models || [];
}

// ---------- קבצים ----------
// העלאה ל-Files API. body = זרם או ArrayBuffer באורך size. מחזיר { name, uri, mimeType, state }
export async function uploadVideo(env, body, size, mime) {
  const f = doFetch(env);
  const start = await ok(await f(UPLOAD, {
    method: 'POST',
    headers: headers(env, {
      'x-goog-upload-protocol': 'resumable',
      'x-goog-upload-command': 'start',
      'x-goog-upload-header-content-length': String(size),
      'x-goog-upload-header-content-type': mime,
      'content-type': 'application/json',
    }),
    body: JSON.stringify({ file: { display_name: 'gta6-video' } }),
  }));
  const url = start.headers.get('x-goog-upload-url');
  if (!url || !url.startsWith('https://generativelanguage.googleapis.com/')) throw new GoogleError(500, 'no upload url');
  const done = await ok(await f(url, {
    method: 'POST',
    headers: { 'content-length': String(size), 'x-goog-upload-offset': '0', 'x-goog-upload-command': 'upload, finalize' },
    body,
  }));
  const { file } = await done.json();
  if (!file?.uri || !FILE_NAME_RE.test(file.name || '')) throw new GoogleError(500, 'bad upload answer');
  return { name: file.name, uri: file.uri, mimeType: file.mimeType || mime, state: file.state || 'PROCESSING' };
}

export async function fileState(env, name) {
  if (!FILE_NAME_RE.test(name)) throw new GoogleError(400, 'bad file name');
  const res = await ok(await doFetch(env)(`${BASE}/${name}`, { headers: headers(env) }));
  return (await res.json()).state || 'PROCESSING';
}

export async function deleteFile(env, name) {
  if (!FILE_NAME_RE.test(name)) return;
  await doFetch(env)(`${BASE}/${name}`, { method: 'DELETE', headers: headers(env) }).catch(() => {});
}

// ---------- הצפייה ----------
export const WATCH_PROMPT = `This is a short video about the game GTA 6 (Grand Theft Auto VI). Watch AND listen to all of it.
Write in Hebrew, but copy every code, button, number, name and on-screen text EXACTLY as it appears or is said.
Use these sections:
דיבור: what is said (a faithful transcript in the original language; skip if there is no speech).
טקסט על המסך: every text that appears on screen, in order.
קודים: every cheat code / button sequence / phone number / password shown or said, one per line, as "<code> — <what it does> — <platform if known>". Write "אין" if there are none. Never guess a code you did not clearly see or hear.
מה רואים: 2-4 sentences about what happens in the video.`;

// מחזיר את הטקסט של מה שנראה ונשמע בסרטון. video = { uri, mimeType } (קובץ) או { youtube: url }
export async function watchVideo(env, model, video) {
  const fileData = video.youtube ? { file_uri: video.youtube } : { file_uri: video.uri, mime_type: video.mimeType };
  const res = await ok(await doFetch(env)(`${BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: headers(env, { 'content-type': 'application/json' }),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ file_data: fileData }, { text: WATCH_PROMPT }] }],
      generationConfig: { maxOutputTokens: 4000, temperature: 0.2 },
    }),
  }));
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
  if (!text) throw new GoogleError(400, `empty answer (${data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason || 'none'})`);
  return text.slice(0, 12000);
}
