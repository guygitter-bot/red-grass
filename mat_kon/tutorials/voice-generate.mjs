// יוצר את קובצי ההקראה (voice/<key>.mp3) לכל משפט ב-voice/lines.json שעוד אין לו קובץ, עם Google Cloud Text-to-Speech.
// רץ ב-GitHub Actions (mat-kon-voice.yml) עם הסוד GOOGLE_TTS_KEY. הקול נבחר פעם אחת ונשמר ב-voice/voice.json, כדי שכל הסרטונים יישמעו אותו דבר.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'voice');
const KEY = process.env.GOOGLE_TTS_KEY;
if (!KEY || KEY === 'none') {
  console.error('חסר הסוד GOOGLE_TTS_KEY');
  process.exit(1);
}
const API = 'https://texttospeech.googleapis.com/v1';

async function call(path, body) {
  const res = await fetch(`${API}${path}${path.includes('?') ? '&' : '?'}key=${KEY}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${data.error?.message || ''}`);
  return data;
}

// קול נשי בעברית: הטוב ביותר שיש (Chirp3-HD, אחר כך Neural2, Wavenet, Standard)
async function pickVoice() {
  const file = join(DIR, 'voice.json');
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const { voices = [] } = await call('/voices?languageCode=he-IL');
  console.log('Hebrew voices:', voices.map((v) => `${v.name}(${v.ssmlGender})`).join(', '));
  const rank = (v) => ['Chirp3-HD', 'Chirp-HD', 'Neural2', 'Wavenet', 'Standard'].findIndex((k) => v.name.includes(k));
  const female = voices.filter((v) => v.ssmlGender === 'FEMALE' && rank(v) >= 0).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  if (!female.length) throw new Error('לא נמצא קול נשי בעברית');
  const choice = { name: female[0].name, languageCode: 'he-IL', speakingRate: 1.04 };
  writeFileSync(file, `${JSON.stringify(choice, null, 1)}\n`);
  return choice;
}

const lines = JSON.parse(readFileSync(join(DIR, 'lines.json'), 'utf8'));
const voice = await pickVoice();
console.log('voice:', voice.name);
let made = 0;
for (const [key, text] of Object.entries(lines)) {
  const out = join(DIR, `${key}.mp3`);
  if (existsSync(out)) continue;
  const audioConfig = { audioEncoding: 'MP3', sampleRateHertz: 24000, speakingRate: voice.speakingRate };
  let data;
  try {
    data = await call('/text:synthesize', { input: { text }, voice: { languageCode: voice.languageCode, name: voice.name }, audioConfig });
  } catch (e) {
    // יש קולות שלא תומכים בשינוי מהירות
    if (!String(e.message).startsWith('400')) throw e;
    delete audioConfig.speakingRate;
    data = await call('/text:synthesize', { input: { text }, voice: { languageCode: voice.languageCode, name: voice.name }, audioConfig });
  }
  writeFileSync(out, Buffer.from(data.audioContent, 'base64'));
  made++;
}
console.log(`created ${made} files, ${Object.keys(lines).length} lines total`);
