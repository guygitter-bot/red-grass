// הסוכן: מקבל קישור / קובץ / טקסט ומחזיר תקציר בעברית וקטגוריה לפי הנושא.
// הקטגוריות נבנות תוך כדי: קודם מנסים קטגוריה קיימת, ורק כשאין מתאימה – פותחים חדשה.
import { enoughText } from './source.js';

export const MODEL = 'claude-opus-5-5';
const MAX_STEPS = 6;

// קטגוריות התחלתיות (רק הצעה לסוכן; קטגוריה מופיעה באפליקציה כשיש בה משהו)
export const STARTER_CATEGORIES = [
  'כלים ואפליקציות',
  'מודלים וחדשות',
  'פרומפטים וטיפים',
  'תמונות, וידאו וקול',
  'סוכנים ואוטומציה',
  'קוד ופיתוח',
  'מחקר ומאמרים',
  'לימוד ומדריכים',
  'עסקים ושימושים',
  'אתיקה ובטיחות',
];

export const TYPES = ['כתבה', 'סרטון', 'כלי', 'מדריך', 'קורס', 'מחקר', 'פוסט', 'קוד', 'חדשות', 'מסמך', 'אחר'];

export const ITEM_TOOL = {
  name: 'file_item',
  description: 'File the saved material under one topic category, with a Hebrew summary.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short Hebrew title. Keep product/model names as they are (e.g. "Claude Code", "Midjourney").' },
      summary: { type: 'string', description: '2-3 Hebrew sentences: what this is and why it is useful' },
      points: { type: 'array', items: { type: 'string' }, description: 'Up to 5 short Hebrew key points / takeaways' },
      category: { type: 'string', description: 'The topic category. Exactly one of the existing categories when one fits; otherwise a new short Hebrew name (1-3 words)' },
      emoji: { type: 'string', description: 'One emoji that represents the category' },
      type: { type: 'string', enum: TYPES },
      tags: { type: 'array', items: { type: 'string' }, description: 'Up to 5 short tags (tool names, companies, topics)' },
    },
    required: ['title', 'summary', 'points', 'category', 'emoji', 'type', 'tags'],
    additionalProperties: false,
  },
};

const WEB_TOOLS = [{ type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 3 }];

export const SYSTEM = `You organize a personal Hebrew library of AI-related material (links, articles, videos, \
posts, papers, tools, files). For each saved item, understand what it is about and file it under ONE topic category.

Rules:
- Write the title, summary and points in natural Israeli Hebrew. Keep names of products, models and companies in \
their original spelling.
- Categories are by topic (what the material is about), not by format. Keep the number of categories small and \
stable: reuse an existing category whenever it reasonably fits, and write its name exactly as given. Open a new \
category only when the topic clearly does not fit any existing one.
- Be faithful to the material. If you could not read it, file it by what the link/file name tells you and say so \
briefly in the summary.
- Always finish by calling file_item.`;

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
export function material(item, src, categories) {
  const head = categoriesText(categories);
  const note = item.note ? `\nThe user's note: ${item.note}` : '';
  if (item.kind === 'link') {
    const lines = [
      `Saved link: ${item.url}`,
      src?.finalUrl && src.finalUrl !== item.url ? `Final URL: ${src.finalUrl}` : '',
      src?.site ? `Site: ${src.site}` : '',
      src?.title ? `Page title: ${src.title}` : '',
      src?.description ? `Description: ${src.description}` : '',
      src?.text ? `Page text:\n${src.text}` : 'The page text could not be downloaded.',
    ].filter(Boolean);
    const web = !src || !enoughText(src);
    return {
      web,
      content: `${lines.join('\n')}${note}\n\n${head}\n\n${web ? 'If needed, read the link with web_fetch. ' : ''}Call file_item.`,
    };
  }
  if (item.kind === 'text') {
    return { web: false, content: `Saved text:\n${item.text}${note}\n\n${head}\n\nCall file_item.` };
  }
  // קובץ
  const intro = `Uploaded file: ${item.file.name} (${item.file.type})${note}\n\n${head}\n\nCall file_item.`;
  if (!src) return { web: false, content: `${intro}\n(Only the file name is available.)` };
  if (src.text != null) return { web: false, content: `File content:\n${src.text}\n\n${intro}` };
  return { web: false, content: [src.block, { type: 'text', text: intro }] };
}

// קובץ -> חלק בהודעה לסוכן (PDF, תמונה, טקסט). null = רק השם
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_B64 = Math.floor((5 * 1024 * 1024 * 4) / 3) - 16;
export function fileSource(file) {
  if (file.type === 'application/pdf') return { block: { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.data } } };
  if (IMAGE_TYPES.includes(file.type) && file.data.length <= MAX_IMAGE_B64) {
    return { block: { type: 'image', source: { type: 'base64', media_type: file.type, data: file.data } } };
  }
  if (/^text\/|json|xml|markdown|csv/.test(file.type) || /\.(md|txt|csv|json)$/i.test(file.name)) {
    const bytes = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
    return { text: new TextDecoder().decode(bytes).slice(0, 30000) };
  }
  return null;
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
    if (response.stop_reason === 'refusal') throw new Error('המודל סירב לטפל בחומר הזה.');
    const submit = response.content.find((b) => b.type === 'tool_use' && b.name === ITEM_TOOL.name);
    if (submit) return cleanResult(submit.input, categories);
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;
    messages.push({ role: 'user', content: 'Call file_item now with what you have.' });
  }
  throw new Error('לא הצלחתי למפות את החומר. נסו שוב.');
}

export function cleanResult(r, categories = []) {
  let category = clean(r.category).slice(0, 40) || 'כללי';
  // אותה קטגוריה בכתיב קצת אחר (רווחים / אותיות) – לקטגוריה הקיימת
  const same = categories.find((c) => c.replace(/\s+/g, '') === category.replace(/\s+/g, ''));
  if (same) category = same;
  return {
    title: clean(r.title).slice(0, 200),
    summary: clean(r.summary).slice(0, 1200),
    points: cleanList(r.points, 5).map((p) => p.slice(0, 300)),
    category,
    emoji: [...clean(r.emoji)].slice(0, 2).join('') || '📁',
    type: TYPES.includes(r.type) ? r.type : 'אחר',
    tags: cleanList(r.tags, 5).map((t) => t.replace(/^#/, '').slice(0, 40)),
  };
}

// ---------- שגיאות מה-API של Anthropic בעברית ----------
export function aiMessage(e) {
  const status = Number(e?.status) || 0;
  if (!status) return e?.message || 'תקלה. נסו שוב.';
  const text = `${e?.message || ''} ${JSON.stringify(e?.error || {})}`.toLowerCase();
  if (/credit balance|billing|purchase credits/.test(text)) return 'נגמר הקרדיט בחשבון Anthropic (console.anthropic.com ← Billing).';
  if (status === 401 || status === 403) return 'מפתח ה-API של Anthropic לא תקין. צריך לעדכן אותו בסודות של GitHub.';
  if (status === 429 || status === 529 || status >= 500 || /overloaded|rate.?limit/.test(text)) return 'יש עומס כרגע. נסו שוב בעוד דקה.';
  if (status === 413 || /too large|too long|too many pages/.test(text)) return 'הקובץ גדול מדי לקריאה.';
  return 'לא הצלחתי לקרוא את החומר.';
}

// כדאי לנסות שוב אוטומטית? (עומס / תקלה זמנית)
export const temporary = (e) => {
  const s = Number(e?.status) || 0;
  return s === 429 || s === 529 || s >= 500;
};
