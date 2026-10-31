// יוצר מוזיקת רקע לריילס עם ElevenLabs Music (הסוד ELEVENLABS_API_KEY), רק לקבצים שעוד לא קיימים
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const key = process.env.ELEVENLABS_API_KEY;
if (!key || key === 'none') { console.log('אין מפתח ElevenLabs – מדלגים'); process.exit(0); }

for (const { file, prompt, seconds = 30 } of JSON.parse(readFileSync(join(HERE, 'prompts.json'), 'utf8'))) {
  const out = join(HERE, file);
  if (existsSync(out)) continue;
  const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, music_length_ms: seconds * 1000, model_id: 'music_v1', force_instrumental: true }),
  });
  if (!res.ok) { console.log(`${file}: ${res.status} ${(await res.text()).slice(0, 300)}`); process.exitCode = 1; continue; }
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`${file}: נוצר`);
}
