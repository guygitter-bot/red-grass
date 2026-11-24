// הסוכן: מקבל קישור לסרטון GTA 6 ומחזיר כותרת בעברית שאומרת מה יש בסרטון, תקציר, רשימת קודים (אם יש) וקטגוריה.
// הסוכן לא רואה את התמונה של הסרטון – רק את הכיתוב, התיאור והכתוביות (ביוטיוב). קוד שמופיע רק על המסך –
// המשתמש מוסיף ידנית באפליקציה.
import { enoughText } from './source.js';

export const MODEL = 'claude-opus-5-5';
const MAX_STEPS = 6;

// קטגוריות התחלתיות (רק הצעה לסוכן; קטגוריה מופיעה באפליקציה כשיש בה משהו)
export const STARTER_CATEGORIES = [
  'קודים וצ׳יטים',
  'טיפים וטריקים',
  'כסף ועסקים',
  'רכבים',
  'נשק',
  'משימות ומדריכים',
  'סודות ומפה',
  'באגים וגליצ׳ים',
  'טריילרים וחדשות',
  'אונליין',
  'מצחיק',
];

export const PLATFORMS = ['PlayStation', 'Xbox', 'PC', 'טלפון', 'כל הפלטפורמות', 'לא ידוע'];

export const ITEM_TOOL = {
  name: 'file_video',
  description: 'Save the GTA 6 video with a Hebrew title, a short summary, every cheat code it mentions, and one topic category.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short Hebrew title (up to ~10 words) that says what is in the video, e.g. "קוד לנשק בלתי מוגבל + מיקום רכב נדיר". Keep in-game names in English as they are.' },
      summary: { type: 'string', description: '1-3 Hebrew sentences: what the video shows' },
      codes: {
        type: 'array',
        description: 'Every cheat code / button combination / phone number / password that the video itself gives. Empty when there are none. Never invent codes.',
        items: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'The code exactly as given (buttons like "R1, R2, L1, ←, →", a phone number, or a typed word)' },
            effect: { type: 'string', description: 'What the code does, in short Hebrew' },
            platform: { type: 'string', enum: PLATFORMS },
          },
          required: ['code', 'effect', 'platform'],
          additionalProperties: false,
        },
      },
      category: { type: 'string', description: 'The topic category. Exactly one of the existing categories when one fits; otherwise a new short Hebrew name (1-3 words)' },
      emoji: { type: 'string', description: 'One emoji that represents the category' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Up to 5 short tags (places, cars, weapons, characters, missions)' },
    },
    required: ['title', 'summary', 'codes', 'category', 'emoji', 'tags'],
    additionalProperties: false,
  },
};

const WEB_TOOLS = [{ type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 3 }];

export const SYSTEM = `You organize a personal Hebrew collection of short videos about the game GTA 6 (Grand Theft Auto VI) – \
reels, YouTube videos, TikToks and posts. For each saved video, understand what is in it and file it.

Rules:
- The title must tell the user at a glance what the video shows (a code, a tip, a secret place, a car, a glitch...). \
Natural Israeli Hebrew; keep in-game names (places, cars, weapons, characters) in their original spelling.
- codes: list every cheat code, button sequence, phone number or password that the material itself gives, exactly as \
written, with what it does. If the caption only says "codes in the video" without writing them, leave the list empty \
and say in the summary that the codes appear only in the video itself. NEVER invent or "complete" codes from memory.
- Categories are by topic. Reuse an existing category whenever it reasonably fits, and write its name exactly as \
given. Open a new category only when the topic clearly does not fit any existing one.
- Be faithful to the material. You cannot watch the video – you only get its caption, description and (for YouTube) \
its spoken transcript. If you could not read anything, title it by what the link tells you and say so briefly.
- Always finish by calling file_video.`;

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const cleanList = (a, max) => (Array.isArray(a) ? a.map(clean).filter(Boolean).slice(0, max) : []);

function categoriesText(categories) {
  const existing = categories.length
    ? `Existing categories (prefer these): ${categories.join(' | ')}`
    : 'There are no categories yet.';
  const starters = STARTER_CATEGORIES.filter((c) => !categories.includes(c));
  return `${existing}\nGood names for new categories, if needed: ${starters.join(' | ')}`;
}

// החומר לסוכן: { content, web } (web = מותר לסוכן לקרוא את הקישור בעצמו)
// src: מהדף (gatherLink) או מיוטיוב ({ video: { title, author, description, transcript } })
export function material(item, src, categories) {
  const head = categoriesText(categories);
  const note = item.note ? `\nThe user's note: ${item.note}` : '';
  const v = src?.video;
  const lines = v
    ? [
        `Saved YouTube video: ${item.url}`,
        v.title ? `Video title: ${v.title}` : '',
        v.author ? `Channel: ${v.author}` : '',
        v.description ? `Description:\n${v.description}` : '',
        v.transcript ? `Transcript (what is said in the video):\n${v.transcript}` : 'No transcript is available.',
      ]
    : [
        `Saved video link: ${item.url}`,
        src?.finalUrl && src.finalUrl !== item.url ? `Final URL: ${src.finalUrl}` : '',
        src?.site ? `Site: ${src.site}` : '',
        src?.title ? `Page title: ${src.title}` : '',
        src?.description ? `Caption / description: ${src.description}` : '',
        src?.text ? `Page text:\n${src.text}` : 'The page text could not be downloaded.',
      ];
  const web = v ? !v.title && !v.transcript : !src || !enoughText(src);
  return {
    web,
    content: `${lines.filter(Boolean).join('\n')}${note}\n\n${head}\n\n${web ? 'If needed, read the link with web_fetch. ' : ''}Call file_video.`,
  };
}

export async function classify(client, item, src, categories) {
  const { content, web } = material(item, src, categories);
  const messages = [{ role: 'user', content }];
  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: web ? [...WEB_TOOLS, ITEM_TOOL] : [ITEM_TOOL],
      messages,
    });
    if (response.stop_reason === 'refusal') throw new Error('המודל סירב לטפל בסרטון הזה.');
    const submit = response.content.find((b) => b.type === 'tool_use' && b.name === ITEM_TOOL.name);
    if (submit) return cleanResult(submit.input, categories);
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;
    messages.push({ role: 'user', content: 'Call file_video now with what you have.' });
  }
  throw new Error('לא הצלחתי לקרוא את הסרטון. נסו שוב.');
}

// רשימת קודים (מהסוכן או מעריכה ידנית) -> [{ code, effect, platform }]
export function cleanCodes(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const c of list) {
    const code = clean(c?.code).slice(0, 200);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({
      code,
      effect: clean(c?.effect).slice(0, 200),
      platform: PLATFORMS.includes(c?.platform) ? c.platform : 'לא ידוע',
    });
  }
  return out.slice(0, 60);
}

export function cleanResult(r, categories = []) {
  let category = clean(r.category).slice(0, 40) || 'כללי';
  // אותה קטגוריה בכתיב קצת אחר (רווחים / אותיות) – לקטגוריה הקיימת
  const same = categories.find((c) => c.replace(/\s+/g, '') === category.replace(/\s+/g, ''));
  if (same) category = same;
  return {
    title: clean(r.title).slice(0, 200),
    summary: clean(r.summary).slice(0, 1200),
    codes: cleanCodes(r.codes),
    category,
    emoji: [...clean(r.emoji)].slice(0, 2).join('') || '🎮',
    tags: cleanList(r.tags, 5).map((t) => t.replace(/^#/, '').slice(0, 40)),
  };
}

// ---------- שגיאות מה-API של Anthropic בעברית ----------
export function aiMessage(e) {
  const status = Number(e?.status) || 0;
  // שגיאה שלנו (כבר בעברית) – כמו שהיא; הודעה טכנית באנגלית לא מגיעה למשתמש
  if (!status) return /[֐-׿]/.test(e?.message || '') ? e.message : 'תקלה זמנית. נסו שוב ("לקרוא שוב").';
  const text = `${e?.message || ''} ${JSON.stringify(e?.error || {})}`.toLowerCase();
  if (/credit balance|billing|purchase credits/.test(text)) return 'נגמר הקרדיט בחשבון Anthropic (console.anthropic.com ← Billing).';
  if (status === 401 || status === 403) return 'מפתח ה-API של Anthropic לא תקין. צריך לעדכן אותו בסודות של GitHub.';
  if (status === 429 || status === 529 || status >= 500 || /overloaded|rate.?limit/.test(text)) return 'יש עומס כרגע. נסו שוב בעוד דקה.';
  return 'לא הצלחתי לקרוא את הסרטון.';
}

// כדאי לנסות שוב אוטומטית? (עומס / תקלה זמנית)
export const temporary = (e) => {
  const s = Number(e?.status) || 0;
  return s === 429 || s === 529 || s >= 500;
};
