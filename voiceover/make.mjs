// קריינות כללית מ-ElevenLabs (לעריכת סרטונים בצ'אט): קורא את voiceover/request.json – בקשה אחת או רשימה –
// ({ name, text, voice_name | voice_id, model_id, gender }) ויוצר voiceover/out/<name>.mp3 + <name>.json (תזמון לכל תו).
// רץ ב-GitHub Actions (voiceover.yml) עם הסוד ELEVENLABS_API_KEY.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY || KEY === 'none') { console.log('אין ELEVENLABS_API_KEY'); process.exit(1); }
const API = 'https://api.elevenlabs.io';

async function call(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'xi-api-key': KEY, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

const { voices = [] } = await call('/v1/voices');
console.log('קולות בחשבון:', voices.map((v) => v.name).join(' | '));
const heb = (v) => (v.verified_languages || []).some((l) => l.language === 'he');

// הקול לבקשה: לפי שם (כמה כתיבים, למשל ["ארז", "Erez"]) – ואם ביקשו שם ולא נמצא, עוצרים ולא מחליפים בשקט
function voicesFor(req) {
  const names = [].concat(req.voice_name || []).map((n) => n.toLowerCase());
  if (names.length) {
    const v = voices.find((x) => names.some((n) => x.name.toLowerCase().includes(n)));
    if (!v) throw new Error(`הקול לא נמצא: ${names.join(', ')}`);
    return [v.voice_id];
  }
  const same = voices.filter((v) => !req.gender || v.labels?.gender === req.gender).sort((a, b) => heb(b) - heb(a));
  return [req.voice_id, ...same.map((v) => v.voice_id)].filter(Boolean).slice(0, 4);
}

mkdirSync('voiceover/out', { recursive: true });
let failed = false;
for (const req of [].concat(JSON.parse(readFileSync('voiceover/request.json', 'utf8')))) {
  const out = `voiceover/out/${req.name}`;
  if (existsSync(`${out}.mp3`)) { console.log(req.name, 'כבר קיים'); continue; }
  let res, used;
  try {
    for (const id of voicesFor(req)) {
      try {
        res = await call(`/v1/text-to-speech/${id}/with-timestamps?output_format=mp3_44100_128`, {
          text: req.text, model_id: req.model_id || 'eleven_v4', language_code: 'he',
          voice_settings: { stability: req.stability ?? 0.5, similarity_boost: 0.75 },
        });
        used = id; break;
      } catch (e) { console.log(req.name, 'נכשל עם', id, e.message); }
    }
  } catch (e) { console.log(req.name, e.message); }
  if (!res) { failed = true; continue; }
  writeFileSync(`${out}.mp3`, Buffer.from(res.audio_base64, 'base64'));
  const name = voices.find((v) => v.voice_id === used)?.name || used;
  writeFileSync(`${out}.json`, `${JSON.stringify({ voice_id: used, voice_name: name, alignment: res.alignment }, null, 1)}\n`);
  console.log(req.name, 'נוצר עם', name);
}
if (failed) process.exit(1);
