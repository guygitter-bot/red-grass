// הצוות: הבוטים, התפקידים והכלים שלהם, והרצה של תור אחד של בוט מול Claude.
import { APPS } from './apps.js';

export const MODEL = 'claude-opus-5-5';
export const ROUTER_MODEL = 'claude-haiku-5-5';
const MAX_STEPS = 8;

export const AGENTS = {
  creative: {
    name: 'קריאייטיב',
    emoji: '🎨',
    short: 'רעיונות, טקסטים, תסריטים לסרטונים ותוכן לדפים העסקיים',
    role: `You are "קריאייטיב" (Creative) – the team's creative director and copywriter.
Your job: ideas and concepts for promoting the apps, hooks, ad copy variants (Facebook/Instagram/Google), \
short-video scripts (15-30s, shot by shot, with the on-screen Hebrew text and the voiceover line for each shot), \
social posts, and everything a new business page needs (page name, short bio, "about" text, first posts, \
briefs for the profile and cover images). When an image is needed, write a clear brief plus a ready prompt in \
English for an AI image tool. Give 2-3 distinct options rather than one, and say which you recommend and why.`,
  },
  campaigns: {
    name: 'קמפיינים',
    emoji: '📊',
    short: 'קמפיינים בפייסבוק ובגוגל: קהלים, תקציב, מילות חיפוש ומדידה',
    role: `You are "קמפיינים" (Campaigns) – the team's paid-media manager for Meta (Facebook/Instagram) and Google Ads.
Your job: campaign plans for the apps – objective, campaign structure, audiences (Israel, Hebrew speakers), \
budget in ILS with a small test budget first, keywords including negative keywords, ad copy within the platform \
limits (Google responsive search ads: headlines up to 30 characters, descriptions up to 90), app campaigns, \
tracking (pixel / conversions / UTM), what to measure and when to stop or scale, and ad-policy pitfalls. \
Budgets are always a proposal for the owner to approve. When you need creative assets or copy ideas, ask \
קריאייטיב with handoff.`,
  },
};
export const AGENT_KEYS = Object.keys(AGENTS);
export const label = (key) => `${AGENTS[key].emoji} ${AGENTS[key].name}`;

const appsList = APPS.map((a) => `- ${a.key}: ${a.name} – ${a.about} (${a.url})`).join('\n');

const COMMON = `You are part of a small AI marketing team in a Telegram group. You work for the owner – an Israeli who \
builds web apps (installable on the phone) and now wants to market each of them, with a dedicated business page \
per app for advertising.

The team:
${AGENT_KEYS.map((k) => `- ${label(k)} (${k}): ${AGENTS[k].short}`).join('\n')}

The apps:
${appsList}

How to work:
- Write in natural, simple Israeli Hebrew. Keep it short and practical – this is a chat on a phone. Short \
paragraphs, lines starting with "•", **bold** only for a few key words. No tables and no "#" headings.
- Before working on an app, read it with app_info so you know what it really does. Never invent features.
- Use web_search / web_fetch for anything current: competitors, trends, benchmarks and costs in Israel, ad policies.
- Use remember for lasting facts and decisions (brand voice, audiences, budgets, page names, what worked) – \
not for chit-chat. Use forget when the owner says something is no longer true.
- When a teammate is better suited for part of the task, write your part and then call handoff with a clear \
request. Don't hand off when the owner only needs your answer, and never hand back and forth for nothing.
- What you can't do yet (it will come in the next stages): generate images or videos, publish posts, open pages \
or ad accounts, create or launch campaigns, or read ad results. You prepare everything so the owner can do it in \
a few minutes, with exact step-by-step instructions. Never claim you did something you can't do.
- Never spend money and never ask for passwords or API keys in the chat.`;

export function systemPrompt(agent, notes = []) {
  const memory = notes.length
    ? `What the team remembers (numbered):\n${notes.map((n, i) => `${i + 1}. ${n}`).join('\n')}`
    : 'The team has no saved notes yet.';
  return `${AGENTS[agent].role}\n\n${COMMON}\n\n${memory}`;
}

export const TOOLS = (agent) => [
  { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 3 },
  {
    name: 'app_info',
    description: "Read the full description of one of the owner's apps (features, audience, how it works).",
    input_schema: {
      type: 'object',
      properties: { app: { type: 'string', enum: APPS.map((a) => a.key) } },
      required: ['app'],
    },
  },
  {
    name: 'remember',
    description: 'Save a short lasting fact or decision for the whole team (in Hebrew, one sentence).',
    input_schema: { type: 'object', properties: { note: { type: 'string' } }, required: ['note'] },
  },
  {
    name: 'forget',
    description: 'Delete a saved team note by its number.',
    input_schema: { type: 'object', properties: { number: { type: 'integer' } }, required: ['number'] },
  },
  {
    name: 'handoff',
    description: 'Pass the next step to a teammate. Write your own message first; call this last.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', enum: AGENT_KEYS.filter((k) => k !== agent) },
        request: { type: 'string', description: 'What exactly you need from them (Hebrew)' },
      },
      required: ['to', 'request'],
    },
  },
];

// השיחה עד עכשיו -> טקסט אחד (כל הבוטים רואים אותה שיחה)
export function transcript(history, owner = 'הבעלים') {
  return history
    .map((h) => {
      const who = h.who === 'owner' ? owner : label(h.who);
      const pic = h.photo ? ' [תמונה]' : '';
      const to = h.handoff ? `\n↪️ ל${label(h.handoff.to)}: ${h.handoff.request}` : '';
      return `${who}:${pic} ${h.text || ''}${to}`;
    })
    .join('\n\n');
}

// תור אחד של בוט. tools = { app_info, remember, forget } (פונקציות שמחזירות טקסט).
// מחזיר { text, handoff, usage[] }
export async function runAgent(client, { agent, notes, history, owner, image }, tools) {
  const intro = `The conversation so far (latest at the bottom):\n\n${transcript(history, owner)}\n\n` +
    `Now it's your turn as ${label(agent)}. Reply to the latest message.`;
  const content = image ? [image, { type: 'text', text: intro }] : intro;
  const messages = [{ role: 'user', content }];
  const usage = [];
  const texts = [];
  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: [{ type: 'text', text: systemPrompt(agent, notes), cache_control: { type: 'ephemeral' } }],
      tools: TOOLS(agent),
      messages,
    });
    usage.push({ model: MODEL, ...(response.usage || {}) });
    if (response.stop_reason === 'refusal') return { text: 'את זה אני לא יכול לעשות.', usage };
    for (const b of response.content) if (b.type === 'text' && b.text.trim()) texts.push(b.text.trim());
    const calls = response.content.filter((b) => b.type === 'tool_use');
    const handoff = calls.find((c) => c.name === 'handoff');
    if (handoff) {
      const to = AGENT_KEYS.includes(handoff.input?.to) && handoff.input.to !== agent ? handoff.input.to : null;
      const request = String(handoff.input?.request || '').trim();
      return { text: texts.join('\n\n'), handoff: to && request ? { to, request } : null, usage };
    }
    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }
    if (!calls.length) return { text: texts.join('\n\n'), usage };
    // כלים שלנו: מריצים ומחזירים תשובה לסוכן
    const results = [];
    for (const c of calls) {
      const fn = tools[c.name];
      let out;
      try {
        out = fn ? await fn(c.input || {}) : 'Unknown tool';
      } catch (e) {
        out = `Error: ${e.message}`;
      }
      results.push({ type: 'tool_result', tool_use_id: c.id, content: String(out) });
    }
    // הטקסט שכבר נכתב לפני הכלים נשאר בתשובה; ממשיכים
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: results });
  }
  return { text: texts.join('\n\n') || 'לא הספקתי לסיים. אפשר לבקש שוב?', usage };
}

// מי עונה ראשון בקבוצה (כשלא פנו לבוט מסוים)
export async function pickAgent(client, history) {
  const last = history.slice(-6);
  const response = await client.beta.messages.create({
    model: ROUTER_MODEL,
    max_tokens: 10,
    system: `Route the owner's latest message to ONE marketing teammate. Answer with one word only.\n` +
      AGENT_KEYS.map((k) => `${k} = ${AGENTS[k].short}`).join('\n'),
    messages: [{ role: 'user', content: `${transcript(last)}\n\nWho should answer the latest message? (${AGENT_KEYS.join(' / ')})` }],
  });
  const text = response.content.map((b) => b.text || '').join(' ').toLowerCase();
  const key = AGENT_KEYS.find((k) => text.includes(k)) || AGENT_KEYS[0];
  return { agent: key, usage: [{ model: ROUTER_MODEL, ...(response.usage || {}) }] };
}

export function appInfo(key) {
  const app = APPS.find((a) => a.key === key);
  return app ? `${app.name} – ${app.url}\n\n${app.readme}` : 'No such app';
}

// מחיר (דולר למיליון טוקנים; חיפוש בדולר לחיפוש)
const PRICES = { [MODEL]: { in: 5, out: 25 }, [ROUTER_MODEL]: { in: 1, out: 5 } };
export function priceOf(u) {
  const p = PRICES[u.model] || PRICES[MODEL];
  const input = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1;
  const searches = u.server_tool_use?.web_search_requests || 0;
  return (input * p.in + (u.output_tokens || 0) * p.out) / 1e6 + searches * 0.01;
}

// ---------- שגיאות מה-API של Anthropic בעברית ----------
export function aiMessage(e) {
  const status = Number(e?.status) || 0;
  const text = `${e?.message || ''} ${JSON.stringify(e?.error || {})}`.toLowerCase();
  if (/credit balance|billing|purchase credits/.test(text)) return 'נגמר הקרדיט בחשבון Anthropic (console.anthropic.com ← Billing).';
  if (status === 401 || status === 403) return 'מפתח ה-API של Anthropic לא תקין. צריך לעדכן אותו בסודות של GitHub.';
  if (status === 429 || status === 529 || status >= 500 || /overloaded|rate.?limit/.test(text)) return 'יש עומס כרגע. נסו שוב בעוד דקה.';
  return 'משהו השתבש. נסו שוב.';
}
export const temporary = (e) => {
  const s = Number(e?.status) || 0;
  return s === 429 || s === 529 || s >= 500;
};
