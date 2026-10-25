// קריינות ואפקטים קוליים לסרטוני הפרסומת, עם ElevenLabs (הסוד ELEVENLABS_API_KEY, רץ ב-ads-voice.yml).
// לכל סרטון: ads/<שם>/voice.json – lines (משפטים להקראה) ו-sfx (תיאור באנגלית של צליל + אורך בשניות).
// הקבצים נשמרים ב-ads/<שם>/audio/<מפתח>.mp3; קובץ שכבר קיים לא נוצר שוב (כדי ליצור מחדש – למחוק אותו).
// הקול והמנוע – כמו בסרטוני ההדרכה של mat-kon (mat_kon/tutorials/voice/eleven.json), "נועה".
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY || KEY === 'none') {
  console.log('אין ELEVENLABS_API_KEY – מדלגים');
  process.exit(0);
}
const cfg = JSON.parse(readFileSync(join(ROOT, '../mat_kon/tutorials/voice/eleven.json'), 'utf8'));

async function call(path, body) {
  const res = await fetch(`https://api.elevenlabs.io${path}`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 400)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function speak(text, energy) {
  const path = `/v1/text-to-speech/${cfg.voice_id}?output_format=mp3_44100_128`;
  const body = { text, model_id: cfg.model_id, language_code: 'he' };
  // פרסומת – קריינות עם יותר אנרגיה מסרטוני ההדרכה
  if (energy) body.voice_settings = { stability: 0.3, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true };
  try {
    return await call(path, body);
  } catch (e) {
    // יש מנועים שלא מקבלים קוד שפה או הגדרות קול
    if (!String(e.message).startsWith('400')) throw e;
    return call(path, { text, model_id: cfg.model_id });
  }
}

let made = 0;
for (const name of readdirSync(ROOT)) {
  const file = join(ROOT, name, 'voice.json');
  if (!existsSync(file)) continue;
  const v = JSON.parse(readFileSync(file, 'utf8'));
  const out = join(ROOT, name, 'audio');
  mkdirSync(out, { recursive: true });
  for (const [key, text] of Object.entries(v.lines || {})) {
    const f = join(out, `${key}.mp3`);
    if (existsSync(f)) continue;
    writeFileSync(f, await speak(text, v.energy !== false));
    made++;
  }
  for (const [key, s] of Object.entries(v.sfx || {})) {
    const f = join(out, `${key}.mp3`);
    if (existsSync(f)) continue;
    // למפתח אין תמיד הרשאה לאפקטים – אז נשארים האפקטים המקומיים (sfx.sh)
    try {
      writeFileSync(f, await call('/v1/sound-generation', { text: s.text, duration_seconds: s.seconds, prompt_influence: 0.6 }));
      made++;
    } catch (e) {
      console.log(`sfx ${key}: ${e.message.slice(0, 120)}`);
    }
  }
}
console.log(`created ${made} files`);
