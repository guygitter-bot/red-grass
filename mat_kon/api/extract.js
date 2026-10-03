// הסוכן: מקבל את החומר שנאסף מהקישור ומחזיר מתכון מסודר בעברית עם קטגוריה.
// כשהחומר חסר (סרטון בלי מתכון בתיאור, אתר שחוסם) הוא קורא את הקישור בעצמו ומחפש ברשת.
import { CATEGORIES, DEFAULT_CATEGORY } from './categories.js';
import { isVideoKind, looksComplete } from './source.js';

export const MODEL = 'claude-opus-5-5';
const MAX_STEPS = 6;

const sectionList = (what) => ({
  type: 'array',
  description: `${what}, grouped into sections. Use a single section with an empty title when the recipe has no sub-parts; use titles like "לבצק", "לציפוי" when it does.`,
  items: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      items: { type: 'array', items: { type: 'string' } },
    },
    required: ['title', 'items'],
    additionalProperties: false,
  },
});

export const RECIPE_TOOL = {
  name: 'submit_recipe',
  description: 'Submit the complete recipe, written in Hebrew.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      found: { type: 'boolean', description: 'false if no recipe could be found for this link at all' },
      title: { type: 'string', description: 'Hebrew recipe name' },
      original_title: { type: 'string', description: 'The title as it appears in the source (any language)' },
      description: { type: 'string', description: 'One or two Hebrew sentences about the dish' },
      category: { type: 'string', enum: CATEGORIES },
      tags: { type: 'array', items: { type: 'string' }, description: 'Up to 5 short Hebrew tags, e.g. "פרווה", "ללא גלוטן", "מהיר", "לשבת"' },
      servings: { type: 'string', description: 'Hebrew yield, e.g. "6 מנות", "תבנית 24 ס\\"מ", or empty' },
      prep_time: { type: 'string', description: 'Hebrew, e.g. "20 דקות", or empty' },
      cook_time: { type: 'string', description: 'Hebrew, e.g. "45 דקות", or empty' },
      total_time: { type: 'string', description: 'Hebrew, or empty' },
      ingredients: sectionList('Ingredients, each with its amount, e.g. "2 כוסות קמח"'),
      steps: sectionList('Preparation steps in order, one action per item, without numbering'),
      tips: { type: 'array', items: { type: 'string' }, description: 'Hebrew tips, storage, substitutions from the source' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      notes: {
        type: 'string',
        description: 'Short Hebrew note to the user: where the recipe came from (e.g. "מהתיאור של הסרטון", "מהכתוביות", "מתכון מקביל באתר X") and what was estimated. Empty if the recipe came straight from the page.',
      },
    },
    required: [
      'found', 'title', 'original_title', 'description', 'category', 'tags', 'servings', 'prep_time',
      'cook_time', 'total_time', 'ingredients', 'steps', 'tips', 'confidence', 'notes',
    ],
    additionalProperties: false,
  },
};

const WEB_TOOLS = [
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 4 },
  { type: 'web_search_20260209', name: 'web_search', max_uses: 6 },
];

export const SYSTEM = `You turn a link that a user saved (a recipe website or a cooking video) into a clean recipe \
for their Hebrew recipe book, and file it under one category.

Rules:
- Write everything in natural Israeli Hebrew. Translate foreign recipes; convert cups/oz/°F to what an Israeli \
cook uses (grams, כוסות, כפות, °C) and keep the original amount in parentheses when converting.
- Be faithful to the source. Every ingredient with its amount, every step in order. Do not invent \
ingredients or amounts that the source does not support. Keep the author's tips.
- A video: the recipe is usually in the description, the captions, or a linked blog post. If what you were \
given is not enough, use web_fetch on the original link and on links from the description, and web_search \
for the creator's written recipe (title + author). Only if the exact recipe cannot be found, reconstruct it \
from what the video shows/says, set confidence to "low" and say so in notes.
- A website: if the page text below is missing or blocked, web_fetch the link.
- A WhatsApp message: use only the message text. If it is chatter and not a recipe, set found=false.
- Choose the single best category. Desserts that are cakes → "עוגות"; cookies, rugelach, pastries → \
"עוגיות ומאפים מתוקים"; bread, pita, savory pies/bourekas → "לחמים ומאפים"; shakshuka/pancakes → "ארוחת בוקר"; \
a vegetarian main dish → "צמחוני וטבעוני" unless it is clearly a salad/soup/pasta.
- If the link has no recipe at all, call submit_recipe with found=false and explain in notes.
- When done, call submit_recipe. Do not write anything else.`;

function material(src) {
  if (src.kind === 'whatsapp') {
    return [
      'Source: a message from a WhatsApp chat (no link). Build the recipe from this text only.',
      src.chat ? `Chat: ${src.chat}` : '',
      src.author ? `Sent by: ${src.author}` : '',
      `Message:\n${src.text}`,
    ].filter(Boolean).join('\n\n');
  }
  const parts = [`Link: ${src.url}`, `Type: ${isVideoKind(src.kind) ? `video (${src.kind})` : 'website'}`];
  if (src.title) parts.push(`Title: ${src.title}`);
  if (src.author) parts.push(`Author/channel: ${src.author}`);
  if (src.siteName) parts.push(`Site: ${src.siteName}`);
  if (src.recipes.length) parts.push(`Structured recipe data from the page (schema.org):\n${JSON.stringify(src.recipes, null, 1)}`);
  if (src.description) parts.push(`${isVideoKind(src.kind) ? 'Video description / caption' : 'Page description'}:\n${src.description}`);
  if (src.transcript) parts.push(`Video captions:\n${src.transcript}`);
  if (src.text) parts.push(`Page text:\n${src.text}`);
  if (src.warnings.length) parts.push(`Could not read everything: ${src.warnings.join('; ')}`);
  return parts.join('\n\n');
}

const clean = (s) => String(s || '').trim();
const cleanList = (a) => (Array.isArray(a) ? a.map(clean).filter(Boolean) : []);
const cleanSections = (a) =>
  (Array.isArray(a) ? a : [])
    .map((s) => ({ title: clean(s?.title), items: cleanList(s?.items).map((i) => i.replace(/^\d+[.)]\s*/, '')) }))
    .filter((s) => s.items.length);

// מאחד את תשובת הסוכן עם מה שנאסף מהדף לרשומת מתכון
export function toRecipe(input, src) {
  return {
    title: clean(input.title) || clean(src.title) || 'מתכון',
    originalTitle: clean(input.original_title) || clean(src.title),
    description: clean(input.description),
    category: CATEGORIES.includes(input.category) ? input.category : DEFAULT_CATEGORY,
    tags: cleanList(input.tags).slice(0, 5),
    servings: clean(input.servings),
    prepTime: clean(input.prep_time),
    cookTime: clean(input.cook_time),
    totalTime: clean(input.total_time),
    ingredients: cleanSections(input.ingredients),
    steps: cleanSections(input.steps),
    tips: cleanList(input.tips),
    confidence: ['high', 'medium', 'low'].includes(input.confidence) ? input.confidence : 'medium',
    notes: clean(input.notes),
    source: src.kind === 'whatsapp' ? {
      url: null,
      key: src.key,
      kind: 'whatsapp',
      chat: clean(src.chat),
      author: clean(src.author),
      date: clean(src.date),
      text: src.text,
    } : {
      url: src.url,
      kind: src.kind,
      title: clean(src.title),
      author: clean(src.author),
      site: clean(src.siteName),
      embed: src.embed || null,
    },
    image: src.image || null,
  };
}

export class NoRecipeError extends Error {}

export async function extractRecipe(client, src) {
  // מתכון מובנה מלא מהדף, או הודעת ווטסאפ: אין צורך ברשת, זה מהיר וזול יותר
  const complete = src.kind === 'whatsapp' || looksComplete(src);
  const messages = [{ role: 'user', content: material(src) }];
  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: complete ? 'low' : 'medium' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: complete ? [RECIPE_TOOL] : [...WEB_TOOLS, RECIPE_TOOL],
      messages,
    });
    if (response.stop_reason === 'refusal') throw new Error('הבקשה נדחתה על ידי המודל.');
    const submit = response.content.find((b) => b.type === 'tool_use' && b.name === RECIPE_TOOL.name);
    if (submit) {
      if (!submit.input.found) throw new NoRecipeError(clean(submit.input.notes) || 'לא נמצא מתכון בקישור הזה.');
      return toRecipe(submit.input, src);
    }
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue; // חיפוש ברשת עדיין רץ - ממשיכים
    messages.push({ role: 'user', content: `Call ${RECIPE_TOOL.name} now with what you have.` });
  }
  throw new Error('הסוכן לא החזיר מתכון. נסו שוב.');
}
