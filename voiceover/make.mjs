// קריינות כללית מ-ElevenLabs (לעריכת סרטונים בצ'אט): קורא את voiceover/request.json
// ({ name, text, voice_id, model_id, gender }) ויוצר voiceover/out/<name>.mp3 + <name>.json (תזמון לכל תו).
// רץ ב-GitHub Actions (voiceover.yml) עם הסוד ELEVENLABS_API_KEY. אם הקול לא נגיש – בוחר קול מהחשבון לפי מגדר.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY || KEY === 'none') { console.log('אין ELEVENLABS_API_KEY'); process.exit(1); }
const API = 'https://api.elevenlabs.io';
const req = JSON.parse(readFileSync('voiceover/request.json', 'utf8'));
const out = `voiceover/out/${req.name}`;
if (existsSync(`${out}.mp3`)) { console.log('כבר קיים'); process.exit(0); }

async function call(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'xi-api-key': KEY, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// סדר הניסיון: הקול שביקשו, ואחריו קולות מהחשבון במגדר המבוקש (עדיף שאומתו בעברית)
const { voices = [] } = await call('/v1/voices');
const heb = (v) => (v.verified_languages || []).some((l) => l.language === 'he');
const same = voices.filter((v) => !req.gender || v.labels?.gender === req.gender);
same.sort((a, b) => heb(b) - heb(a));
const tries = [req.voice_id, ...same.map((v) => v.voice_id)].filter(Boolean);
console.log('קולות במגדר המבוקש:', same.map((v) => `${v.name}${heb(v) ? ' (he)' : ''}`).join(', '));

let res, used;
for (const id of tries.slice(0, 4)) {
  try {
    res = await call(`/v1/text-to-speech/${id}/with-timestamps?output_format=mp3_44100_192`, {
      text: req.text, model_id: req.model_id || 'eleven_v4', language_code: 'he',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    });
    used = id; break;
  } catch (e) { console.log('נכשל עם', id, e.message); }
}
if (!res) process.exit(1);
mkdirSync('voiceover/out', { recursive: true });
writeFileSync(`${out}.mp3`, Buffer.from(res.audio_base64, 'base64'));
const name = voices.find((v) => v.voice_id === used)?.name || used;
writeFileSync(`${out}.json`, `${JSON.stringify({ voice_id: used, voice_name: name, alignment: res.alignment }, null, 1)}\n`);
console.log('נוצר עם', name);
