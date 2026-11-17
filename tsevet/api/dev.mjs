// שרת מקומי לבדיקת המסכים (tsevet/web) בלי Cloudflare, בלי Claude ובלי GitHub: הכול בזיכרון.
//   node dev.mjs            -> http://localhost:8787   (לבנות את האפליקציה עם VITE_API_URL=http://localhost:8787)
// הבוטים עונים תשובות קבועות; עורך הווידאו באמת עורך (מריץ את tsevet/render/run.py על המחשב הזה).
import http from 'node:http';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import worker, { Team } from './worker.js';

const PORT = Number(process.env.PORT) || 8787;
const TOKEN = 'dev-token';

function memoryStorage() {
  const map = new Map();
  let timer = null;
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    async get(k) { return clone(map.get(k)); },
    async put(k, v) { map.set(k, clone(v)); },
    async delete(k) { map.delete(k); },
    async list({ prefix = '' } = {}) { return new Map([...map].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, clone(v)])); },
    async setAlarm(t) {
      clearTimeout(timer);
      timer = setTimeout(() => env.team.alarm().catch((e) => console.error('alarm', e)), Math.max(0, t - Date.now()));
    },
  };
}

function memoryBucket() {
  const map = new Map();
  return {
    async put(key, body) {
      const bytes = new Uint8Array(await new Response(body).arrayBuffer());
      map.set(key, bytes);
      return { size: bytes.length };
    },
    async get(key, opts) {
      const bytes = map.get(key);
      if (!bytes) return null;
      const m = opts?.range?.get?.('range')?.match(/bytes=(\d+)-(\d*)/);
      const offset = m ? Number(m[1]) : 0;
      const end = m && m[2] ? Math.min(Number(m[2]), bytes.length - 1) : bytes.length - 1;
      const part = bytes.slice(offset, end + 1);
      return { size: bytes.length, body: part, range: m ? { offset, length: part.length } : undefined, arrayBuffer: async () => bytes.buffer };
    },
    async delete(key) { map.delete(key); },
  };
}

// Claude מדומה: מנתב לפי מילים, והעורך מתחיל עריכה כשיש סרטון בשיחה
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ai = {
  beta: {
    messages: {
      async create(req) {
        const usage = { input_tokens: 2000, output_tokens: 400 };
        const prompt = JSON.stringify(req.messages[0].content);
        if (req.max_tokens === 10) {
          const last = prompt.split('\\n\\n').filter((p) => !p.includes('Who should answer')).pop() || '';
          const pick = /מאגר|תלמד|ללמוד/.test(last) ? 'librarian' : /סרטון|וידאו|לערוך|תערוך/.test(last) ? 'editor' : /קמפיין|תקציב|מודעות/.test(last) ? 'campaigns' : 'creative';
          return { content: [{ type: 'text', text: pick }], usage: { input_tokens: 200, output_tokens: 2 } };
        }
        await wait(1500);
        const role = req.system[0].text;
        const results = req.messages.at(-1).content;
        // הספרן: מחפש במאגר, מלמד את העורך, ומדווח
        if (role.startsWith('You are "ספרן"')) {
          const done = JSON.stringify(req.messages);
          if (!done.includes('maagar_search')) return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'm1', name: 'maagar_search', input: { query: 'עריכת רילס וידאו', area: 'learn' } }], usage };
          if (!done.includes('"teach"')) {
            return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'm2', name: 'teach', input: {
              name: 'reels-editing', title: 'עריכת רילס מהירה', when: 'כשעורכים ריל קצר לרשתות', agents: ['editor', 'creative'], source: 'עריכת רילס מהירה',
              body: '**המטרה:** ריל של 15-20 שניות שמחזיק את הצופה.\n\n• הוק בשתי השניות הראשונות\n• חיתוך כל 2 שניות, על הביט\n• כותרת אחת בכל סצנה\n\nפרומפט להוק: A fast dolly-in on [product], shallow depth of field',
            } }], usage };
          }
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'מצאתי במאגר את **"עריכת רילס מהירה"** ולימדתי את זה את 🎬 עורך הווידאו ואת 🎨 קריאייטיב.\n\n• הוק בשתי השניות הראשונות\n• חיתוך כל 2 שניות\n\nאפשר לראות ולמחוק בהגדרות ← "מה הצוות למד".' }], usage };
        }
        if (Array.isArray(results) && results[0]?.type === 'tool_result') {
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: /started/i.test(results[0].content) ? 'התחלתי לערוך 🎬 בחרתי **גוון קולנועי**. הסרטון יופיע כאן כשיהיה מוכן.' : 'לא הצלחתי להתחיל את העריכה. אפשר לנסות שוב?' }], usage };
        }
        if (role.startsWith('You are "עורך וידאו"')) {
          const video = [...prompt.matchAll(/\[file (\w+): video/g)].pop();
          if (video) return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'edit_video', input: { op: 'color_grade', files: [video[1]], preset: 'cinematic' } }], usage };
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'בשמחה! צריך **להעלות סרטון** (הכפתור עם האטב), ולכתוב מה לעשות איתו.' }], usage };
        }
        if (role.startsWith('You are "קמפיינים"') && !prompt.includes('↪️')) {
          return { stop_reason: 'tool_use', content: [{ type: 'text', text: 'הנה מבנה ראשוני:\n\n• **קמפיין בדיקה** – ₪30 ליום, שבוע\n• קהל: הורים בישראל, 28-45\n• מדידה: התקנות\n\nעוד פרטים: https://example.com' }, { type: 'tool_use', id: 't2', name: 'handoff', input: { to: 'creative', request: 'צריך 3 כותרות למודעה' } }], usage };
        }
        return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'שלוש אפשרויות:\n\n• **הסדר חוזר הביתה**\n• פחות בלגן, יותר זמן\n• כל המשימות במקום אחד\n\nאני ממליץ על הראשונה.' }], usage };
      },
    },
  },
};

// מאגר AI מדומה
const maagarItems = [
  { id: 'l1', kind: 'link', mode: 'learn', url: 'https://example.com/reels', title: 'עריכת רילס מהירה', summary: 'שיטה לעריכת רילס קצרים', status: 'ready', createdAt: 2, lessons: ['הוק בשתי השניות הראשונות'], steps: [{ title: 'חיתוך', detail: 'כל 2 שניות' }], prompts: [], skills: [] },
  { id: 'a1', kind: 'link', url: 'https://example.com/veo', title: 'פרומפטים לסרטוני Veo', summary: 'איך כותבים פרומפט לסרטון', category: 'וידאו', status: 'ready', createdAt: 1 },
];
const MAAGAR = {
  async fetch(url) {
    return new URL(url).pathname === '/list' ? new Response(JSON.stringify({ items: maagarItems })) : new Response(JSON.stringify({ item: { id: 'l2' } }));
  },
};

const env = {
  MAAGAR,
  ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:4173',
  GITHUB_TOKEN: TOKEN,
  GITHUB_REPO: 'local/dev',
  FILES: memoryBucket(),
  AI_CLIENT: ai,
  // במקום GitHub: מריצים את העריכה כאן
  async FETCH(url, init) {
    if (url.includes('api.github.com')) {
      const { client_payload } = JSON.parse(init.body);
      const script = fileURLToPath(new URL('../render/run.py', import.meta.url));
      spawn('python3', [script, client_payload.id], { stdio: 'inherit', env: { ...process.env, TSEVET_API: `http://localhost:${PORT}`, TSEVET_TOKEN: TOKEN } });
      return new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify({ ok: true, result: true }));
  },
};
env.team = new Team({ storage: memoryStorage() }, env);
env.TEAM = { idFromName: (n) => n, get: () => ({ fetch: (url, init) => env.team.fetch(new Request(url, init)) }) };

http.createServer(async (req, res) => {
  try {
    const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const request = new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers: req.headers, body: hasBody ? Readable.toWeb(req) : undefined, duplex: 'half' });
    const response = await worker.fetch(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    console.error(e);
    res.writeHead(500).end('error');
  }
}).listen(PORT, () => console.log(`tsevet dev server: http://localhost:${PORT}`));
