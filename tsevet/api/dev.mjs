// שרת מקומי לבדיקת המסכים (tsevet/web) בלי Cloudflare, בלי Claude ובלי GitHub: הכול בזיכרון.
//   node dev.mjs            -> http://localhost:8787   (לבנות את האפליקציה עם VITE_API_URL=http://localhost:8787)
// הבוטים עונים תשובות קבועות; עורך הווידאו באמת עורך (מריץ את tsevet/render/run.py על המחשב הזה).
import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import worker, { Team } from './worker.js';

const PORT = Number(process.env.PORT) || 8787;
const TOKEN = 'dev-token';

function memoryStorage() {
  const map = new Map();
  let timer = null;
  let alarmAt = null;
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    async get(k) { return clone(map.get(k)); },
    async put(k, v) { map.set(k, clone(v)); },
    async delete(k) { map.delete(k); },
    async list({ prefix = '' } = {}) { return new Map([...map].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, clone(v)])); },
    async getAlarm() { return alarmAt; },
    async setAlarm(t) {
      alarmAt = t;
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
      return { size: bytes.length, body: part, range: m ? { offset, length: part.length } : undefined, arrayBuffer: async () => bytes.buffer, text: async () => new TextDecoder().decode(bytes) };
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
          const pick = /טיול/.test(last) ? 'travel' : /משימה|תכין לי/.test(last) ? 'manager' : /מאגר|תלמד|ללמוד/.test(last) ? 'librarian' : /סרטון|וידאו|לערוך|תערוך/.test(last) ? 'editor' : /קמפיין|תקציב|מודעות/.test(last) ? 'campaigns' : 'creative';
          return { content: [{ type: 'text', text: pick }], usage: { input_tokens: 200, output_tokens: 2 } };
        }
        await wait(1500);
        const role = req.system[0].text;
        const results = req.messages.at(-1).content;
        // קריאייטיב: תמונה (באישור) ודף נחיתה כקובץ
        if (role.startsWith('You are "קריאייטיב"') && /דף נחיתה|תמונה/.test(JSON.stringify(req.messages))) {
          const done = JSON.stringify(req.messages);
          if (!/דף נחיתה/.test(done) && !done.includes('"id":"i1"')) return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'i1', name: 'make_image', input: { prompt: 'A warm kitchen table with a phone showing a to-do app, soft morning light, photorealistic', summary: 'שולחן מטבח עם הטלפון והאפליקציה, אור בוקר', aspect: '4:5' } }], usage };
          if (/דף נחיתה/.test(done) && !done.includes('"id":"f1"')) {
            const img = (done.match(/\[file ([a-z0-9]+): image/) || [])[1];
            return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'f1', name: 'make_file', input: { kind: 'html', name: 'דף נחיתה – סדר', content: `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui;margin:0;background:#f5f3ff;color:#1e1b4b}header{padding:48px 20px;text-align:center}h1{font-size:2.2rem;margin:0 0 8px}a{display:inline-block;margin-top:16px;background:#4f46e5;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none}img{max-width:100%;border-radius:16px}</style></head><body><header><h1>הסדר חוזר הביתה</h1><p>כל המשימות של המשפחה במקום אחד.</p>${img ? `<img src="{{file:${img}}}" alt="">` : ''}<br><a href="#">להתחיל בחינם</a></header></body></html>` } }], usage };
          }
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: done.includes('"id":"f1"') ? 'הנה **דף הנחיתה** – אפשר לפתוח, להוריד ולראות תצוגה מקדימה 👇' : 'הכנתי הצעה לתמונה – מחכה לאישור שלך 👇' }], usage };
        }
        // המתכנת: קורא תיקייה, מציע שינוי, ומסכם
        if (role.startsWith('You are "המתכנת"')) {
          const done = JSON.stringify(req.messages);
          if (!done.includes('"id":"c1"')) return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'c1', name: 'code_tree', input: { path: 'mat_kon/web/src' } }], usage };
          if (!done.includes('"id":"c2"')) return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'c2', name: 'code_change', input: { app: 'mat_kon', title: 'כפתור הדפסה למתכון', summary: 'כפתור 🖨️ בדף המתכון שמדפיס רק את המתכון (בלי תפריטים).', request: 'Add a print button to the recipe page with print-only CSS.' } }], usage };
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'בדקתי את דף המתכון ב-**mat_kon**. הכנתי בקשה להוספת כפתור הדפסה – מחכה לאישור שלך 👇' }], usage };
        }
        // המנהל: מתכנן ומחלק, ובתור האחרון מסכם
        if (role.startsWith('You are "מנהל"')) {
          if (/All the steps of your plan are done/.test(prompt)) {
            return { stop_reason: 'end_turn', content: [{ type: 'text', text: '**מה מוכן:**\n\n• תסריט לריל (שלב 1)\n• תוכנית קמפיין עם תקציב בדיקה (שלב 2)\n\n**הצעד הבא:** לאשר את התסריט, ואז אבקש מעורך הווידאו להכין את הסרטון.' }], usage };
          }
          return { stop_reason: 'tool_use', content: [{ type: 'text', text: 'הבנתי – ריל וקמפיין לאפליקציית סדר. קודם תסריט, ואז קמפיין קטן לבדיקה.' }, { type: 'tool_use', id: 'p1', name: 'assign', input: { steps: [
            { to: 'creative', request: 'תסריט לריל של 20 שניות לאפליקציית סדר: הוק, 3 סצנות וקריאה לפעולה' },
            { to: 'campaigns', request: 'תוכנית קמפיין בדיקה בפייסבוק לריל, תקציב קטן' },
          ] } }], usage };
        }
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
        // טיולים: מוצא סקיל ב-GitHub, קורא ושומר (מחכה לאישור)
        if (role.startsWith('You are "טיולים"')) {
          const done = JSON.stringify(req.messages);
          if (done.includes('just approved your skill')) return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'תודה! עובד לפי **תכנון טיול יום-יום**:\n\n• יום 1 – הגעה ושכונה אחת\n• יום 2 – העיר העתיקה\n• יום 3 – יום רגוע' }], usage };
          if (/רומא|טיול ל/.test(done) && !done.includes('"id":"h1"') && done.includes('Waiting for')) return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'מחכה לאישור הסקיל – הכפתור מעל שורת הכתיבה.' }], usage };
          if (!done.includes('"id":"h1"')) return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'h1', name: 'github_skills_search', input: { query: 'travel itinerary' } }], usage };
          if (!done.includes('"id":"h2"')) return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'h2', name: 'github_skill_read', input: { ref: 'good/travel-skills:skills/trip-planner/SKILL.md' } }], usage };
          if (!done.includes('"id":"h3"')) return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'h3', name: 'teach', input: { name: 'trip-planner', title: 'תכנון טיול יום-יום', when: 'כשמתכננים טיול', agents: ['travel'], body: '**השיטה:**\n\n• מסלול יום-יום עם זמני נסיעה אמיתיים\n• מלון אחד במיקום מרכזי\n• יום מנוחה כל 4 ימים' } }], usage };
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'מצאתי ב-GitHub שיטה טובה לתכנון טיול (850 כוכבים, מתוחזק). שמרתי אותה – **מחכה לאישור שלך** 👇' }], usage };
        }
        if (Array.isArray(results) && results[0]?.type === 'tool_result' && /proposal/i.test(results[0].content)) return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'אחרי שתאשר, הסרטון יופיע כאן תוך דקה-שתיים.' }], usage };
        if (Array.isArray(results) && results[0]?.type === 'tool_result') {
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: /started/i.test(results[0].content) ? 'התחלתי לערוך 🎬 בחרתי **גוון קולנועי**. הסרטון יופיע כאן כשיהיה מוכן.' : 'לא הצלחתי להתחיל את העריכה. אפשר לנסות שוב?' }], usage };
        }
        if (role.startsWith('You are "עורך וידאו"')) {
          const video = [...prompt.matchAll(/\[file (\w+): video/g)].pop();
          if (video) return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'edit_video', input: { op: 'color_grade', files: [video[1]], preset: 'cinematic' } }], usage };
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'בשמחה! צריך **להעלות סרטון** (הכפתור עם האטב), ולכתוב מה לעשות איתו.' }], usage };
        }
        // הקריאייטיב: כשמבקשים "תייצר סרטון" – מציע סרטון מהמחולל
        if (role.startsWith('You are "קריאייטיב"') && /תייצר|לייצר/.test(prompt)) {
          return { stop_reason: 'tool_use', content: [{ type: 'text', text: 'הכנתי הצעה לסרטון פתיחה. מחכה לאישור שלך 👇' }, { type: 'tool_use', id: 'g1', name: 'make_video', input: { prompt: 'A slow dolly-in on a tidy kitchen table with a phone showing a to-do list, warm morning light, soft ambience', summary: 'שולחן מטבח מסודר, טלפון עם רשימת משימות, אור בוקר חם', aspect: '9:16' } }], usage };
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
  GEMINI_API_KEY: 'dev',
  ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:4173',
  GITHUB_TOKEN: TOKEN,
  GITHUB_REPO: 'local/dev',
  FILES: memoryBucket(),
  AI_CLIENT: ai,
  // במקום GitHub: מריצים את העריכה כאן
  async FETCH(url, init) {
    if (url.includes('api.github.com') && url.endsWith('/dispatches')) {
      const { client_payload, event_type } = JSON.parse(init.body);
      // המתכנת: עבודה מדומה – אחרי כמה שניות "PR מוכן"
      if (event_type === 'tsevet-dev') {
        setTimeout(() => {
          fetch(`http://localhost:${PORT}/dev/done?id=${client_payload.id}`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify({ pr: 99, summary: 'נוסף כפתור 🖨️ בדף המתכון, שמדפיס רק את המתכון.\nאחרי העלייה: לסגור ולפתוח את האפליקציה.' }) }).catch(() => {});
        }, 4000);
        return new Response(null, { status: 204 });
      }
      const script = fileURLToPath(new URL('../render/run.py', import.meta.url));
      spawn('python3', [script, client_payload.id], { stdio: 'inherit', env: { ...process.env, TSEVET_API: `http://localhost:${PORT}`, TSEVET_TOKEN: TOKEN } });
      return new Response(null, { status: 204 });
    }
    // מחולל וידאו מדומה: מחכה כמה שניות ומחזיר את סרטון הבדיקה (DEV_CLIP), אם יש
    // GitHub מדומה
    if (url === 'https://api.github.com/repos/local/dev/contents/CLAUDE.md') return new Response('### mat-kon – מתכונים (`mat_kon/`)\nספר מתכונים למשפחה.\n### תקציב הבית (`budget/`)\n- תיאור: `budget/README.md`. הוצאות והכנסות.\n');
    if (url.startsWith('https://api.github.com/repos/local/dev/contents/')) return new Response(JSON.stringify([{ type: 'dir', path: 'mat_kon/web/src/components', size: 0 }, { type: 'file', path: 'mat_kon/web/src/App.jsx', size: 4000 }]));
    if (url.startsWith('https://api.github.com/search/code')) return new Response(JSON.stringify({ items: [{ path: 'skills/trip-planner/SKILL.md', repository: { full_name: 'good/travel-skills' } }] }));
    if (url === 'https://api.github.com/repos/good/travel-skills') return new Response(JSON.stringify({ full_name: 'good/travel-skills', owner: { login: 'good' }, stargazers_count: 850, pushed_at: new Date().toISOString(), license: { spdx_id: 'MIT' }, html_url: 'https://github.com/good/travel-skills' }));
    if (url.startsWith('https://api.github.com/repos/good/travel-skills/contents/')) return new Response('# Trip planner\nPlan day by day.');
    // מחולל תמונות מדומה: ריבוע סגול קטן
    if (url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent')) {
      const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      await wait(1500);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png } }] } }] }));
    }
    if (url.endsWith('/interactions')) {
      await wait(4000);
      return new Response(JSON.stringify({ steps: [{ type: 'video', uri: 'https://generativelanguage.googleapis.com/v1beta/files/dev' }] }));
    }
    if (url.startsWith('https://generativelanguage.googleapis.com/v1beta/files/dev')) {
      const bytes = process.env.DEV_CLIP ? readFileSync(process.env.DEV_CLIP) : new Uint8Array(1000);
      return new Response(bytes, { headers: { 'content-type': 'video/mp4' } });
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
