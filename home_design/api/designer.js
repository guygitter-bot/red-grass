// המעצב: Claude מסתכל על צילום החדר ומציע כמה כיווני עיצוב.
// לכל רעיון: כותרת והסבר בעברית למשתמש + הוראה מדויקת באנגלית למחולל התמונות.
export const MODEL = 'claude-opus-5-5';
export const IDEAS = 4;

export const IDEAS_TOOL = {
  name: 'propose_designs',
  description: 'Give the home owner your read of the room and a few distinct design proposals for it.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      room: { type: 'string', description: 'Hebrew, 1-2 sentences: what room this is, its current style, light and what holds it back' },
      ideas: {
        type: 'array',
        description: `Exactly ${IDEAS} proposals, clearly different from each other`,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Hebrew, 2-5 words' },
            why: { type: 'string', description: 'Hebrew, 1-2 sentences: what changes and why it suits this room' },
            prompt: {
              type: 'string',
              description: 'English instruction for an image-editing model: exactly what to change in this photo (materials, colors with names, placement), and what must stay as it is',
            },
          },
          required: ['title', 'why', 'prompt'],
          additionalProperties: false,
        },
      },
    },
    required: ['room', 'ideas'],
    additionalProperties: false,
  },
};

export const SYSTEM = `You are an experienced interior designer advising a home owner in Israel. They send a photo of a \
wall or a room in their own home and want to see what it could look like after a change.

Look closely at the photo: the room type, proportions, natural and artificial light, existing floor, furniture and colors. \
Then propose ${IDEAS} design directions that are clearly different from each other (for example: a paint or color change, \
a wall treatment such as wood slats, wallpaper or plaster texture, built-in shelving or storage, art and lighting). Each \
one must be something a person could really carry out in this room, and must work with what is already there unless \
the owner asked for a bigger change.

Write "room", "title" and "why" in natural, simple Israeli Hebrew, speaking to the owner. Write "prompt" in English for \
an image-editing model that will receive the same photo: describe the change concretely (materials, named colors, where \
exactly), and state that the camera angle, room geometry, windows, doors, floor and everything not being changed must \
stay exactly as in the photo, photorealistic with natural light and shadows.

If the owner added a note, follow it: it says what matters to them. Always finish by calling propose_designs.`;

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// שגיאות מ-Anthropic בעברית
export function aiMessage(status, text) {
  const t = String(text || '').toLowerCase();
  if (/credit balance|billing|purchase credits/.test(t)) return 'נגמר הקרדיט בחשבון Anthropic (console.anthropic.com ← Billing).';
  if (status === 401 || status === 403) return 'מפתח ה-API של Anthropic לא תקין. צריך לעדכן אותו בסודות של GitHub.';
  if (status === 429 || status === 529 || status >= 500 || /overloaded|rate.?limit/.test(t)) return 'יש עומס כרגע. נסו שוב בעוד דקה.';
  return 'המעצב לא הצליח לענות. נסו שוב.';
}

// הקלט של הכלי -> { room, ideas } נקי, או null אם אין בו הצעות
export function readIdeas(input) {
  if (!input || !Array.isArray(input.ideas)) return null;
  const ideas = input.ideas
    .map((i) => ({ title: clean(i?.title), why: clean(i?.why), prompt: clean(i?.prompt) }))
    .filter((i) => i.title && i.prompt)
    .slice(0, 6);
  return ideas.length ? { room: clean(input.room), ideas } : null;
}

export const imageBlock = (image) => ({ type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } });

async function ask(env, body) {
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        // אם המודל מסרב – השרת של Anthropic מנסה לבד מודל אחר
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: JSON.stringify({ model: MODEL, fallbacks: 'default', ...body }),
    });
  } catch {
    throw new Error('אין חיבור למעצב כרגע. נסו שוב.');
  }
  const raw = await res.text();
  if (!res.ok) {
    // detail = ההודעה של Anthropic עצמה, לאבחון
    const e = new Error(aiMessage(res.status, raw));
    let msg = '';
    try { msg = JSON.parse(raw)?.error?.message || ''; } catch { msg = ''; }
    e.detail = `${res.status} ${MODEL}: ${String(msg || raw).replace(/\s+/g, ' ').slice(0, 300)}`;
    throw e;
  }
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('המעצב לא הצליח לענות. נסו שוב.'); }
  if (data.stop_reason === 'refusal') throw new Error('המעצב לא יכול לעבוד עם התמונה הזאת. נסו תמונה אחרת.');
  return data;
}

// שיחה עם Claude שמסתיימת בכלי אחד (strict). serverTools = כלים שרצים אצל Anthropic (חיפוש ברשת).
// מחזיר { input, blocks }: הקלט של הכלי (או null אם Claude לא קרא לו) וכל הבלוקים שחזרו בדרך (כולל תוצאות החיפוש).
// זורק Error עם הודעה בעברית כשהקריאה עצמה נכשלה.
export async function callTool(env, { system, tool, content, serverTools = [], maxTokens = 8000 }) {
  const messages = [{ role: 'user', content }];
  const blocks = [];
  let nudged = false;
  for (let step = 0; step < 6; step++) {
    const data = await ask(env, { max_tokens: maxTokens, system, tools: [...serverTools, tool], messages });
    const got = data.content || [];
    blocks.push(...got);
    const use = got.find((b) => b.type === 'tool_use' && b.name === tool.name);
    if (use) return { input: use.input || null, blocks };
    // חיפוש ארוך נעצר באמצע: שולחים את התשובה חזרה כמו שהיא, והשרת ממשיך מאותה נקודה
    if (data.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: got });
      continue;
    }
    // Claude ענה בטקסט בלי לקרוא לכלי – מבקשים פעם אחת
    if (data.stop_reason === 'end_turn' && !nudged && got.length) {
      nudged = true;
      messages.push({ role: 'assistant', content: got }, { role: 'user', content: `Now call ${tool.name} with your final answer.` });
      continue;
    }
    break;
  }
  return { input: null, blocks };
}

// image: { media_type, data } (base64). note: מה חשוב למשתמש (לא חובה)
// מחזיר { room, ideas } או זורק Error עם הודעה בעברית
export async function suggestIdeas(env, image, note) {
  const text = note
    ? `Here is the photo. The owner's note: ${note}`
    : 'Here is the photo. The owner left no note - propose what you think would improve this room most.';
  const { input } = await callTool(env, { system: SYSTEM, tool: IDEAS_TOOL, content: [imageBlock(image), { type: 'text', text }] });
  const out = readIdeas(input);
  if (!out) throw new Error('המעצב לא החזיר הצעות. נסו שוב.');
  return out;
}
