// קריינות, מוזיקה ואפקטים קוליים מ-ElevenLabs (החשבון של הבעלים, הסוד ELEVENLABS_API_KEY):
//   make_audio – הבוט מציע (קריינות: הטקסט המלא; מוזיקה / אפקט: תיאור ואורך). זה צורך קרדיטים במנוי, ולכן רק הצעה:
//                כרטיס עם "ליצור", ותקרה יומית (DAILY_AUDIO). אחרי האישור היצירה רצה ב-alarm של Team (runAudio),
//                והתוצאה נשמרת כקובץ שמע בשיחה – עורך הווידאו יכול לשלב אותו בסרטון.
//   audio_voices – הקולות שבחשבון (לבחירת קול אחר מ"נועה").
//
//   au:<id>       -> { id, key, kind: voice|music|sfx, text, seconds, voice, summary, status: proposed|working|done|failed|cancelled, file, error, at }
//   audio:q       -> מזהים שמחכים ליצירה
//   audio:<תאריך> -> כמה נוצרו היום
import { fail } from './auth.js';
import { addFile, fileView, israelDate, newId } from './app.js';

const API = 'https://api.elevenlabs.io';
// הקול והמנוע של סרטוני ההדרכה (mat_kon/tutorials/voice/eleven.json) – "נועה", תומך בעברית
export const DEFAULT_VOICE = '6WRlPmU1fqPwYbSxeP16';
const TTS_MODEL = 'eleven_v4';
const MAX_TEXT = 3000;
const KINDS = { voice: 'קריינות', music: 'מוזיקה', sfx: 'אפקט קולי' };
export const AUDIO_MAKERS = ['creative', 'editor', 'social'];
export const audioReady = (env) => Boolean(env.ELEVENLABS_API_KEY && env.FILES);
export const dailyAudio = (env) => Number(env.DAILY_AUDIO) || 20;

// ---------- הכלים (agents.js) ----------
export const AUDIO_TOOLS = [
  {
    name: 'make_audio',
    description: 'Propose audio from ElevenLabs (uses the owner\'s ElevenLabs credits): a Hebrew voice-over (kind "voice", the exact script), background music (kind "music", a description + length) or a sound effect (kind "sfx"). The owner sees it with a "create" button; it is generated only after approval and appears in the chat as [file <id>: audio] – the video editor can use it as music or narration.',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['voice', 'music', 'sfx'] },
        text: { type: 'string', description: 'voice: the exact words to read (Hebrew, with punctuation for pauses). music / sfx: an English description – genre, mood, instruments, tempo (music is instrumental)' },
        seconds: { type: 'number', description: 'music: 10-180 seconds; sfx: 1-22 seconds. Ignored for voice' },
        voice: { type: 'string', description: 'voice: a voice id from audio_voices (default: the owner\'s usual Hebrew voice "Noa")' },
        summary: { type: 'string', description: 'One Hebrew sentence for the owner: what this audio is' },
      },
      required: ['kind', 'text', 'summary'],
    },
  },
  {
    name: 'audio_voices',
    description: 'List the voices in the owner\'s ElevenLabs account (id, name, gender, accent), to pick a voice for make_audio.',
    input_schema: { type: 'object', properties: {} },
  },
];

async function eleven(env, method, path, body) {
  const res = await (env.FETCH || fetch)(`${API}${path}`, {
    method,
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw Object.assign(new Error(`ElevenLabs ${res.status}`), { status: res.status, detail: msg.slice(0, 300) });
  }
  return res;
}

export async function audioVoices(t) {
  if (!audioReady(t.env)) return 'ElevenLabs is not connected yet. Tell the owner.';
  try {
    const data = await (await eleven(t.env, 'GET', '/v1/voices')).json();
    const list = (data.voices || []).slice(0, 60).map((v) => ({ id: v.voice_id, name: v.name, gender: v.labels?.gender || '', accent: v.labels?.accent || '', default: v.voice_id === DEFAULT_VOICE }));
    return JSON.stringify(list);
  } catch (e) {
    return `Could not read the voices (${e.message}).`;
  }
}

export async function proposeAudio(t, job, input, started) {
  const { storage, env } = t;
  if (!audioReady(env)) return 'ElevenLabs is not connected yet (the owner has to finish the one-time setup). Tell the owner; meanwhile give the script / music description as text.';
  const kind = KINDS[input.kind] ? input.kind : null;
  if (!kind) return 'kind must be voice, music or sfx.';
  const text = String(input.text || '').trim().slice(0, MAX_TEXT);
  if (text.length < (kind === 'voice' ? 2 : 5)) return 'text is too short.';
  const summary = String(input.summary || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!summary) return 'summary (one Hebrew sentence for the owner) is required.';
  let seconds = null;
  if (kind === 'music') seconds = Math.min(Math.max(Math.round(Number(input.seconds) || 30), 10), 180);
  if (kind === 'sfx') seconds = Math.min(Math.max(Number(input.seconds) || 3, 1), 22);
  const voice = kind === 'voice' ? (/^[A-Za-z0-9]{10,40}$/.test(String(input.voice || '')) ? String(input.voice) : DEFAULT_VOICE) : null;
  const rec = { id: newId(16), key: t.jobKey(job), kind, text, seconds, voice, summary, status: 'proposed', at: Date.now() };
  await storage.put(`au:${rec.id}`, rec);
  started.push(rec.id);
  return `The audio proposal is shown to the owner with a "create" button. Nothing is generated (or charged) until they approve; then it appears in the chat as an audio file. Say briefly what it will be; do not propose the same audio again.`;
}

export async function audioView(t, id, origin) {
  const a = await t.storage.get(`au:${String(id || '')}`);
  if (!a) return null;
  const out = { id: a.id, kind: a.kind, label: KINDS[a.kind], text: a.text, seconds: a.seconds, voice: a.voice && a.voice !== DEFAULT_VOICE ? a.voice : '', summary: a.summary, status: a.status, at: a.at };
  if (a.status === 'working' && Date.now() - (a.startedAt || a.at) > 10 * 60 * 1000) return { ...out, status: 'failed', error: 'היצירה לקחה יותר מדי זמן. אפשר לנסות שוב.' };
  if (a.status === 'failed') out.error = a.error || 'השמע לא נוצר. אפשר לנסות שוב.';
  if (a.status === 'done' && a.file) out.file = await fileView(t.storage, origin, await t.storage.get(`f:${a.file}`));
  return out;
}

// ---------- אישור / ביטול ----------
export async function approveAudio(t, id) {
  const { storage, env } = t;
  const a = await storage.get(`au:${String(id || '')}`);
  if (!a) throw fail(404, 'ההצעה לא נמצאה');
  if (!['proposed', 'failed'].includes(a.status)) throw fail(409, 'ההצעה הזאת כבר טופלה');
  if (!audioReady(env)) throw fail(503, 'ElevenLabs עוד לא מחובר');
  const dayKey = `audio:${israelDate()}`;
  const today = (await storage.get(dayKey)) || 0;
  if (today >= dailyAudio(env)) throw fail(429, `הגעת לתקרה של ${dailyAudio(env)} קבצי שמע ליום. אפשר להמשיך מחר.`);
  await storage.put(dayKey, today + 1);
  await storage.put(`au:${a.id}`, { ...a, status: 'working', error: '', startedAt: Date.now() });
  const q = (await storage.get('audio:q')) || [];
  if (!q.includes(a.id)) await storage.put('audio:q', [...q, a.id]);
  await storage.setAlarm(Date.now());
  return { ok: true };
}

export async function cancelAudio(storage, id) {
  const a = await storage.get(`au:${String(id || '')}`);
  if (!a) throw fail(404, 'ההצעה לא נמצאה');
  if (!['proposed', 'failed'].includes(a.status)) throw fail(409, 'ההצעה הזאת כבר טופלה');
  await storage.put(`au:${a.id}`, { ...a, status: 'cancelled' });
  return { ok: true };
}

// ---------- היצירה (מתוך ה-alarm) ----------
export async function runAudio(t) {
  const { storage } = t;
  const q = (await storage.get('audio:q')) || [];
  if (!q.length) return;
  await storage.put('audio:q', []);
  for (const id of q) {
    const a = await storage.get(`au:${id}`);
    if (a?.status !== 'working') continue;
    try {
      const bytes = await generate(t.env, a);
      const fileId = newId(16);
      await t.env.FILES.put(`files/${fileId}`, bytes, { httpMetadata: { contentType: 'audio/mpeg' } });
      const name = `${a.summary.replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 50) || KINDS[a.kind]}.mp3`;
      const rec = await addFile(storage, { id: fileId, kind: 'audio', name, type: 'audio/mpeg', size: bytes.length, conv: 'made' });
      await storage.put(`au:${a.id}`, { ...a, status: 'done', file: rec.id, doneAt: Date.now() });
      // הקובץ נכנס להודעה שהציעה אותו – כך הבוטים רואים אותו ועורך הווידאו יכול להשתמש בו
      const history = (await storage.get(a.key)) || [];
      const entry = history.find((h) => (h.audios || []).includes(a.id));
      if (entry) {
        entry.made = [...(entry.made || []), { id: rec.id, kind: 'audio', name: rec.name }];
        await storage.put(a.key, history);
      }
      await t.addUsd(0, 'editor', { audios: 1 });
    } catch (e) {
      console.error('audio', e.message, e.detail);
      const error = e.status === 401 ? 'המפתח של ElevenLabs לא תקין' : e.status === 402 || /quota|credit/i.test(e.detail || '') ? 'נגמרו הקרדיטים במנוי של ElevenLabs' : 'השמע לא נוצר. אפשר לנסות שוב.';
      await storage.put(`au:${a.id}`, { ...a, status: 'failed', error });
    }
  }
}

async function generate(env, a) {
  if (a.kind === 'voice') {
    const path = `/v1/text-to-speech/${a.voice || DEFAULT_VOICE}?output_format=mp3_44100_128`;
    const body = { text: a.text, model_id: TTS_MODEL, language_code: 'he' };
    const res = await eleven(env, 'POST', path, body).catch((e) => {
      // מנוע שלא מקבל language_code – שוב בלעדיו
      if (e.status === 400) {
        delete body.language_code;
        return eleven(env, 'POST', path, body);
      }
      throw e;
    });
    return new Uint8Array(await res.arrayBuffer());
  }
  if (a.kind === 'music') {
    const res = await eleven(env, 'POST', '/v1/music?output_format=mp3_44100_128', { prompt: a.text, music_length_ms: a.seconds * 1000, model_id: 'music_v1', force_instrumental: true });
    return new Uint8Array(await res.arrayBuffer());
  }
  const res = await eleven(env, 'POST', '/v1/sound-generation?output_format=mp3_44100_128', { text: a.text, duration_seconds: a.seconds });
  return new Uint8Array(await res.arrayBuffer());
}
