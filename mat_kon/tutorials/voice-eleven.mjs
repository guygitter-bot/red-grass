// יוצר קובצי הקראה עם ElevenLabs (voice/eleven/<key>.mp3) למשפטים ב-voice/lines.json. ההקלטה (kit.mjs) מעדיפה אותם על אלה של גוגל.
// רץ ב-GitHub Actions (mat-kon-voice.yml) עם הסוד ELEVENLABS_API_KEY.
// ההגדרות ב-voice/eleven.json: only – רשימת מפתחות להקראה (לניסיון על סרטון אחד; null = כל המשפטים),
// ו-voice_id / model_id – אם ריקים, נבחרים אוטומטית (קול נשי ומנוע שתומך בעברית) ונשמרים שם, כדי שכל הסרטונים יישמעו אותו דבר.
// הקולות והמנועים שזמינים נרשמים ל-voice/eleven-options.json, כדי שאפשר יהיה לבחור אחר.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'voice');
const OUT = join(DIR, 'eleven');
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY || KEY === 'none') {
  console.log('אין ELEVENLABS_API_KEY – מדלגים');
  process.exit(0);
}
const API = 'https://api.elevenlabs.io';

async function call(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'xi-api-key': KEY, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 400)}`);
  return res;
}

const isHebrew = (l) => l?.language_id === 'he' || l?.language === 'he' || /hebrew/i.test(l?.name || '');

const cfgFile = join(DIR, 'eleven.json');
const cfg = existsSync(cfgFile) ? JSON.parse(readFileSync(cfgFile, 'utf8')) : {};

if (!cfg.model_id || !cfg.voice_id) {
  const models = await (await call('/v1/models')).json();
  const { voices = [] } = await (await call('/v1/voices')).json();
  writeFileSync(join(DIR, 'eleven-options.json'), `${JSON.stringify({
    models: models.map((m) => ({ id: m.model_id, name: m.name, tts: m.can_do_text_to_speech, hebrew: (m.languages || []).some(isHebrew) })),
    voices: voices.map((v) => ({ id: v.voice_id, name: v.name, gender: v.labels?.gender, category: v.category, hebrew: (v.verified_languages || []).some(isHebrew) })),
  }, null, 1)}\n`);
  if (!cfg.model_id) {
    // המנוע החדש ביותר שתומך בעברית
    const rank = (id) => ['v4', 'v3', 'multilingual'].findIndex((k) => id.includes(k));
    const ok = models.filter((m) => m.can_do_text_to_speech !== false && (m.languages || []).some(isHebrew) && rank(m.model_id) >= 0);
    ok.sort((a, b) => rank(a.model_id) - rank(b.model_id));
    if (!ok.length) throw new Error(`לא נמצא מנוע שתומך בעברית: ${models.map((m) => m.model_id).join(', ')}`);
    cfg.model_id = ok[0].model_id;
  }
  if (!cfg.voice_id) {
    // קול נשי, עדיף כזה שאומת בעברית
    const female = voices.filter((v) => v.labels?.gender === 'female');
    const pick = female.find((v) => (v.verified_languages || []).some(isHebrew)) || female[0] || voices[0];
    if (!pick) throw new Error('לא נמצאו קולות בחשבון');
    cfg.voice_id = pick.voice_id;
    cfg.voice_name = pick.name;
  }
  writeFileSync(cfgFile, `${JSON.stringify(cfg, null, 1)}\n`);
}
console.log('model:', cfg.model_id, 'voice:', cfg.voice_name || cfg.voice_id);

const lines = JSON.parse(readFileSync(join(DIR, 'lines.json'), 'utf8'));
const keys = Object.keys(lines).filter((k) => !cfg.only || cfg.only.includes(k));
mkdirSync(OUT, { recursive: true });
let made = 0;
for (const key of keys) {
  const out = join(OUT, `${key}.mp3`);
  if (existsSync(out)) continue;
  const path = `/v1/text-to-speech/${cfg.voice_id}?output_format=mp3_44100_128`;
  const body = { text: lines[key], model_id: cfg.model_id, language_code: 'he' };
  let res;
  try {
    res = await call(path, body);
  } catch (e) {
    // יש מנועים שלא מקבלים קוד שפה
    if (!String(e.message).startsWith('400')) throw e;
    delete body.language_code;
    res = await call(path, body);
  }
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  made++;
}
console.log(`created ${made} files, ${keys.length} lines`);
