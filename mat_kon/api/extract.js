// הסוכן: מקבל את החומר שנאסף מהקישור ומחזיר מתכון מסודר בעברית עם קטגוריה.
// כשהחומר חסר (סרטון בלי מתכון בתיאור, אתר שחוסם) הוא קורא את הקישור בעצמו ומחפש ברשת.
import { CATEGORIES, DEFAULT_CATEGORY } from './categories.js';
import { isVideoKind, looksComplete } from './source.js';

export const MODEL = 'claude-opus-5-5';
const MAX_STEPS = 10;

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
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 6 },
  { type: 'web_search_20260209', name: 'web_search', max_uses: 8 },
];

export const SYSTEM = `You turn a link that a user saved (a recipe website or a cooking video) into a clean recipe \
for their Hebrew recipe book, and file it under one category.

Rules:
- Write everything in natural Israeli Hebrew. Translate foreign recipes; convert cups/oz/°F to what an Israeli \
cook uses (grams, כוסות, כפות, °C) and keep the original amount in parentheses when converting.
- Be faithful to the source. Every ingredient with its amount, every step in order. Do not invent \
ingredients or amounts that the source does not support. Keep the author's tips.
- A video or social post (Instagram, TikTok, YouTube, Facebook): creators often put the recipe in the \
caption, in their own comment (often pinned, "the recipe in the comments"), in a reply, or on their blog. Read \
ALL of it: the title, the caption, every comment below (the creator's comments are marked and listed first), \
the captions/transcript and any linked page. Combine the pieces (e.g. ingredients in one comment and steps in \
another). If it is still not enough, use web_fetch on the original link and on links from the caption/comments, \
and web_search for the creator's written recipe (dish + creator name, in Hebrew and in English).
- If the dish is clear but the creator's exact amounts or steps cannot be found anywhere, do NOT give up: write \
the most faithful recipe you can from what the caption, comments, hint and video title say, filling the gaps \
from a reliable recipe for the same dish that you found with web_search. Set confidence to "low" and explain in \
notes exactly what came from the creator and what was completed from elsewhere.
- A website: if the page text below is missing or blocked, web_fetch the link.
- A WhatsApp message or text the user pasted: use only that text. If it is chatter and not a recipe, set found=false.
- Choose the single best category. Desserts that are cakes → "עוגות"; cookies, rugelach, pastries → \
"עוגיות ומאפים מתוקים"; bread, pita, savory pies/bourekas → "לחמים ומאפים"; shakshuka/pancakes → "ארוחת בוקר"; \
a vegetarian main dish → "צמחוני וטבעוני" unless it is clearly a salad/soup/pasta.
- Set found=false ONLY when the link is clearly not about food or cooking, or nothing at all identifies a \
dish (not even the title or caption). Explain why in notes.
- When done, call submit_recipe. Do not write anything else.`;

function material(src) {
  if (src.images) {
    return [
      'Source: photos of a recipe (a cookbook page, a handwritten note, a screenshot or a printed page). Read all of them \
- they may be several pages of the same recipe - and build the recipe from what is written. Keep the original \
amounts. If a word is hard to read, use the most likely reading and mention it in notes.',
      src.hint ? `The user wrote: ${src.hint}` : '',
    ].filter(Boolean).join('\n\n');
  }
  if (src.fromText) {
    return [
      src.url
        ? `Source: text the user copied from the post at ${src.url} (the link itself could not be read). Build the recipe from this text only.`
        : 'Source: a message from a WhatsApp chat (no link). Build the recipe from this text only.',
      src.chat ? `Chat: ${src.chat}` : '',
      src.author ? `Sent by: ${src.author}` : '',
      `${src.url ? 'Copied text' : 'Message'}:\n${src.text}`,
    ].filter(Boolean).join('\n\n');
  }
  const video = isVideoKind(src.kind);
  const parts = [`Link: ${src.url}`, `Type: ${video ? `video / social post (${src.kind})` : 'website'}`];
  if (src.hint) parts.push(`The person who shared this link wrote: ${src.hint}`);
  if (src.title) parts.push(`Title: ${src.title}`);
  if (src.author) parts.push(`Author/channel: ${src.author}`);
  if (src.siteName) parts.push(`Site: ${src.siteName}`);
  if (src.recipes.length) parts.push(`Structured recipe data from the page (schema.org):\n${JSON.stringify(src.recipes, null, 1)}`);
  if (src.description) parts.push(`${video ? 'Post caption / video description' : 'Page description'}:\n${src.description}`);
  if (src.comments?.length) {
    const lines = src.comments.map((c) => `- ${c.byCreator ? '[CREATOR] ' : ''}@${c.author || '?'}: ${c.text}`);
    parts.push(`Comments (${src.comments.length}, the creator's first):\n${lines.join('\n').slice(0, 20000)}`);
  } else if (video) {
    parts.push('Comments: could not be read.');
  }
  if (src.transcript) parts.push(`Video captions:\n${src.transcript}`);
  for (const l of src.linked || []) {
    if (l.recipes.length) parts.push(`Linked page ${l.url} - structured recipe data:\n${JSON.stringify(l.recipes, null, 1)}`);
    else if (l.text) parts.push(`Linked page ${l.url} - text:\n${l.text}`);
  }
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
export function toRecipe(input, src, categories = CATEGORIES) {
  return {
    title: clean(input.title) || clean(src.title) || 'מתכון',
    originalTitle: clean(input.original_title) || clean(src.title),
    description: clean(input.description),
    category: categories.includes(input.category) ? input.category : DEFAULT_CATEGORY,
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
    source: src.images ? { url: null, key: src.key, kind: 'photo' } : src.fromText ? {
      url: src.url || null,
      ...(src.url ? {} : { key: src.key }),
      kind: src.kind,
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
      ...(src.hint ? { hint: src.hint } : {}),
      embed: src.embed || null,
    },
    image: src.image || null,
  };
}

// ---------- רשימת קניות: איחוד כפילויות וסידור לפי מחלקות בסופר ----------

export const SHOPPING_TOOL = {
  name: 'submit_list',
  description: 'Submit the organized shopping list.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      groups: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Hebrew supermarket department, e.g. "ירקות ופירות", "מוצרי חלב", "בשר ועוף", "מזווה", "תבלינים", "קפואים", "אחר"' },
            items: { type: 'array', items: { type: 'string' } },
          },
          required: ['title', 'items'],
          additionalProperties: false,
        },
      },
    },
    required: ['groups'],
    additionalProperties: false,
  },
};

const SHOPPING_SYSTEM = `You organize a Hebrew shopping list. Merge items that are the same product into one line and add \
up their amounts when the units allow it (2 כוסות קמח + 1 כוס קמח = 3 כוסות קמח; 3 ביצים + 2 ביצים = 5 ביצים); if the \
units differ, write both (קמח: 2 כוסות + 100 גרם). Drop pure instructions that are not things to buy (e.g. "מים \
רותחים"), but keep water only if it is something to buy. Group by supermarket department in the order of a typical \
Israeli supermarket walk. Keep the user's wording, in Hebrew. Call submit_list.`;

export async function organizeShopping(client, items) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: SHOPPING_SYSTEM,
    tools: [SHOPPING_TOOL],
    messages: [{ role: 'user', content: `Shopping list:\n${items.map((i) => `- ${i}`).join('\n')}\n\nCall submit_list.` }],
  });
  const submit = response.content.find((b) => b.type === 'tool_use' && b.name === SHOPPING_TOOL.name);
  if (!submit) throw new Error('לא הצלחתי לסדר את הרשימה. נסו שוב.');
  return submit.input.groups
    .map((g) => ({ title: clean(g.title), items: cleanList(g.items) }))
    .filter((g) => g.items.length);
}

export class NoRecipeError extends Error {}

// הכלי עם רשימת הקטגוריות של הספר (הקבועות + אלה שהמשתמש הוסיף)
export function recipeTool(categories = CATEGORIES) {
  const tool = structuredClone(RECIPE_TOOL);
  tool.input_schema.properties.category.enum = [...new Set([...CATEGORIES, ...categories])];
  return tool;
}

export async function extractRecipe(client, src, { categories = CATEGORIES } = {}) {
  // מתכון מובנה מלא מהדף, או הודעת ווטסאפ: אין צורך ברשת, זה מהיר וזול יותר
  const complete = src.fromText || src.images || looksComplete(src);
  const custom = categories.filter((c) => !CATEGORIES.includes(c));
  const text = material(src) + (custom.length
    ? `\n\nThe user added their own categories: ${custom.join(', ')}. Prefer one of them when it fits the dish better than the general ones.`
    : '');
  const RECIPE_TOOL = recipeTool(categories);
  const content = src.images
    ? [...src.images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.type, data: i.data } })), { type: 'text', text }]
    : text;
  const messages = [{ role: 'user', content }];
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
      return toRecipe(submit.input, src, recipeTool(categories).input_schema.properties.category.enum);
    }
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue; // חיפוש ברשת עדיין רץ - ממשיכים
    messages.push({ role: 'user', content: `Call ${RECIPE_TOOL.name} now with what you have.` });
  }
  throw new Error('הסוכן לא החזיר מתכון. נסו שוב.');
}

// ---------- חיפוש מתכון ברשת לפי שם ----------

export const SEARCH_TOOL = {
  name: 'submit_results',
  description: 'Submit the recipe pages that were found.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Recipe name as on the page' },
            url: { type: 'string', description: 'Direct link to the recipe page (not a search or list page)' },
            site: { type: 'string', description: 'Site or creator name' },
            description: { type: 'string', description: 'One short Hebrew sentence: what is special about this version' },
          },
          required: ['title', 'url', 'site', 'description'],
          additionalProperties: false,
        },
      },
    },
    required: ['results'],
    additionalProperties: false,
  },
};

const SEARCH_SYSTEM = `You find recipes on the web for an Israeli home cook. Search for the dish the user asks for and \
return up to 6 different, well-reviewed recipe pages - direct links to a single recipe each, not list or search pages. \
Prefer Hebrew and Israeli sites and creators (10dakot, foodis, mako food, ynet food, chef blogs), and add a couple of \
good English recipes when they are clearly better or the dish is foreign. Write the descriptions in Hebrew. \
Call submit_results.`;

export async function searchRecipes(client, query) {
  const messages = [{ role: 'user', content: `Find recipes for: ${query}` }];
  for (let step = 0; step < 6; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: SEARCH_SYSTEM,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 }, SEARCH_TOOL],
      messages,
    });
    if (response.stop_reason === 'refusal') throw new Error('הבקשה נדחתה על ידי המודל.');
    const submit = response.content.find((b) => b.type === 'tool_use' && b.name === SEARCH_TOOL.name);
    if (submit) {
      return submit.input.results
        .filter((r) => /^https?:\/\//.test(r.url))
        .slice(0, 8)
        .map((r) => ({ title: clean(r.title), url: r.url.trim(), site: clean(r.site), description: clean(r.description) }));
    }
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;
    messages.push({ role: 'user', content: `Call ${SEARCH_TOOL.name} now with what you found.` });
  }
  throw new Error('החיפוש לא החזיר תוצאות. נסו שוב.');
}

// ---------- המלאי בבית: זיהוי מוצרים מתמונה ----------

export const PANTRY_TOOL = {
  name: 'submit_items',
  description: 'Submit the food products seen in the photos.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Short generic Hebrew name a cook would use in a recipe, e.g. "חלב", "גבינה צהובה", "עגבניות", "רסק עגבניות", "אורז בסמטי". Add the brand only if it matters.' },
            qty: { type: 'string', description: 'Rough Hebrew amount if visible, e.g. "6 יחידות", "חצי בקבוק", "2 קופסאות", or empty' },
            place: { type: 'string', enum: ['fridge', 'pantry'], description: 'fridge = refrigerated or frozen; pantry = dry goods, cans, spices, oils, bread, produce kept outside' },
          },
          required: ['name', 'qty', 'place'],
          additionalProperties: false,
        },
      },
    },
    required: ['items'],
    additionalProperties: false,
  },
};

const PANTRY_SYSTEM = `You keep a home cook's kitchen inventory in Hebrew. Look at the photos and list the food products you can \
identify. Rules:
- One line per product, merged when the same product appears several times (add up the amount).
- Use the short generic Hebrew name that would appear in a recipe ingredient list, not marketing text.
- Skip things that are not food or that you cannot identify with reasonable confidence; never guess hidden items.
- Read Hebrew labels carefully (e.g. "שמנת מתוקה" vs "שמנת חמוצה", "קמח לבן" vs "קמח מלא").
Call submit_items.`;

export async function scanPantry(client, images, { mode = 'many', place = 'fridge' } = {}) {
  const ask = mode === 'single'
    ? 'This is a photo of ONE product (sometimes two or three of the same kind). Return just that product.'
    : `This is a photo of a whole ${place === 'pantry' ? 'pantry shelf / cupboard' : 'fridge (or freezer)'}. Return every food product you can identify.`;
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: PANTRY_SYSTEM,
    tools: [PANTRY_TOOL],
    messages: [{
      role: 'user',
      content: [
        ...images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.type, data: i.data } })),
        { type: 'text', text: `${ask} The user is adding to their ${place === 'pantry' ? 'pantry (מזווה)' : 'fridge (מקרר)'}. Call submit_items.` },
      ],
    }],
  });
  if (response.stop_reason === 'refusal') throw new Error('הבקשה נדחתה על ידי המודל.');
  const submit = response.content.find((b) => b.type === 'tool_use' && b.name === PANTRY_TOOL.name);
  if (!submit) throw new Error('לא הצלחתי לזהות מוצרים בתמונה. נסו שוב.');
  return submit.input.items
    .map((i) => ({ name: clean(i.name).slice(0, 80), qty: clean(i.qty).slice(0, 40), place: i.place === 'pantry' ? 'pantry' : 'fridge' }))
    .filter((i) => i.name)
    .slice(0, 80);
}

// ---------- מתכונים ברשת לפי מה שיש בבית ----------

const IDEAS_SYSTEM = `You suggest recipes for an Israeli home cook based on what they have at home. Search the web and return \
up to 6 different recipe pages (direct links to a single recipe each, not list or search pages) that use mainly the \
products they have, so they need to buy as little as possible. Assume they have basics (salt, pepper, oil, sugar, \
flour, onion, garlic, common spices). Prefer Hebrew and Israeli sites and creators. In each description write in Hebrew \
which of their products the recipe uses and what, if anything, is missing. Call submit_results.`;

export async function ideasFromPantry(client, items, { wish = '' } = {}) {
  const messages = [{
    role: 'user',
    content: `What I have at home:\n${items.map((i) => `- ${i}`).join('\n')}${wish ? `\n\nI feel like: ${wish}` : ''}`,
  }];
  for (let step = 0; step < 6; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: IDEAS_SYSTEM,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 }, SEARCH_TOOL],
      messages,
    });
    if (response.stop_reason === 'refusal') throw new Error('הבקשה נדחתה על ידי המודל.');
    const submit = response.content.find((b) => b.type === 'tool_use' && b.name === SEARCH_TOOL.name);
    if (submit) {
      return submit.input.results
        .filter((r) => /^https?:\/\//.test(r.url))
        .slice(0, 8)
        .map((r) => ({ title: clean(r.title), url: r.url.trim(), site: clean(r.site), description: clean(r.description) }));
    }
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;
    messages.push({ role: 'user', content: `Call ${SEARCH_TOOL.name} now with what you found.` });
  }
  throw new Error('החיפוש לא החזיר תוצאות. נסו שוב.');
}
