// הסוכן: מקבל את החומר שנאסף מהקישור ומחזיר מתכון מסודר בעברית עם קטגוריה.
// כשהחומר חסר (סרטון בלי מתכון בתיאור, אתר שחוסם) הוא קורא את הקישור בעצמו ומחפש ברשת.
import { AI_DIETS, cleanDiet } from './diet.js';
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

// הערכה תזונתית למנה (הערכה בלבד – לפי המצרכים והכמויות)
export const NUTRIENTS = ['calories', 'protein', 'carbs', 'sugar', 'fat', 'saturated_fat', 'fiber', 'sodium'];
// סימון לסינון (כשר, ללא גלוטן, צליאק…) – לפי המצרכים כפי שנכתבו במתכון
const DIET_HINTS = {
  kosher: 'kosher by ingredients: no pork, shellfish or other forbidden foods, no meat with dairy, no meat with fish',
  parve: 'neither meat nor dairy (fish and eggs are parve)',
  dairy: 'contains dairy and no meat',
  meat: 'contains meat or poultry and no dairy',
  pesach: 'kosher for Passover: no chametz (wheat, barley, oats, rye, spelt, regular flour, bread, pasta, yeast dough, beer; matzah and matzah meal are fine)',
  kitniyot: 'kosher for Passover AND no kitniyot (rice, corn, legumes, soy, peanuts, sesame, mustard, buckwheat)',
  gf: 'no gluten-containing ingredients',
  celiac: 'safe for celiac: no gluten, no regular oats, and no ingredients that usually hide gluten (soup powder, stock cubes, soy sauce, malt, many sauces) unless marked gluten free',
  lactose: 'no lactose (no dairy unless marked lactose free)',
  eggs: 'contains no eggs',
  nuts: 'contains no tree nuts or peanuts',
  nosugar: 'no added sugar, honey, syrup or sweetened products',
  lowsodium: 'low salt: no salty products (soy sauce, stock cubes, pickles, olives, cured meat, salty cheese) and at most a little salt',
  baby: 'suitable for babies/toddlers: no honey, alcohol, hot spices, caffeine, cured meat, added sugar, much salt or whole nuts',
  vegan: 'no animal products at all',
  vegetarian: 'no meat, poultry or fish',
};
const DIET_SCHEMA = {
  type: 'object',
  description: 'True/false for each diet, judged from the ingredients you wrote (the user filters the recipe book by these)',
  properties: Object.fromEntries(AI_DIETS.map((k) => [k, { type: 'boolean', description: DIET_HINTS[k] }])),
  required: AI_DIETS,
  additionalProperties: false,
};

const NUTRITION_SCHEMA = {
  type: 'object',
  description: 'Estimated nutrition for ONE serving, calculated from the ingredients and their amounts (standard food composition values). Grams, except calories (kcal) and sodium (mg).',
  properties: {
    per: { type: 'string', description: 'Hebrew: what one serving is, e.g. "למנה (מתוך 6)", "לעוגייה (מתוך 20)", "לפרוסה (מתוך 12)". When the yield is not written, assume a reasonable one and say so, e.g. "למנה (בהנחה של 4 מנות)"' },
    calories: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    sugar: { type: 'number' },
    fat: { type: 'number' },
    saturated_fat: { type: 'number' },
    fiber: { type: 'number' },
    sodium: { type: 'number' },
  },
  required: ['per', ...NUTRIENTS],
  additionalProperties: false,
};

// ערכים תזונתיים שנשמרים במתכון: מספרים סבירים בלבד (או null אם אין)
export function cleanNutrition(n) {
  if (!n || typeof n !== 'object') return null;
  const out = { per: String(n.per || '').trim().slice(0, 80) };
  for (const k of NUTRIENTS) {
    const v = Number(n[k]);
    if (!Number.isFinite(v) || v < 0 || v > 100000) return null;
    out[k] = Math.round(v * 10) / 10;
  }
  return out.calories > 0 ? out : null;
}

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
      category: { type: 'string', enum: CATEGORIES, description: 'The single best category' },
      more_categories: {
        type: 'array', items: { type: 'string', enum: CATEGORIES },
        description: 'Other categories that also clearly fit (0-2), e.g. a chicken main dish: category "עוף" plus a user category like "מנה עיקרית". Empty if none.',
      },
      tags: { type: 'array', items: { type: 'string' }, description: 'Up to 5 short Hebrew tags, e.g. "פרווה", "ללא גלוטן", "מהיר", "לשבת"' },
      servings: { type: 'string', description: 'Hebrew yield, e.g. "6 מנות", "תבנית 24 ס\\"מ", or empty' },
      prep_time: { type: 'string', description: 'Hebrew, e.g. "20 דקות", or empty' },
      cook_time: { type: 'string', description: 'Hebrew, e.g. "45 דקות", or empty' },
      total_time: { type: 'string', description: 'Hebrew, or empty' },
      ingredients: sectionList('Ingredients, each with its amount, e.g. "2 כוסות קמח"'),
      steps: sectionList('Preparation steps in order, one action per item, without numbering'),
      tips: { type: 'array', items: { type: 'string' }, description: 'Hebrew tips, storage, substitutions from the source' },
      nutrition: NUTRITION_SCHEMA,
      diet: DIET_SCHEMA,
      basis: {
        type: 'string', enum: ['source', 'completed', 'guessed'],
        description: '"source": the recipe is written in the source (or the creator\'s own recipe was found). "completed": mostly from the source, with gaps filled in. "guessed": the source only shows the dish (e.g. a video or photo with no written recipe and the original could not be found) and the recipe was reconstructed.',
      },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      notes: {
        type: 'string',
        description: 'Short Hebrew note to the user: where the recipe came from (e.g. "מהתיאור של הסרטון", "מהכתוביות", "מתכון מקביל באתר X") and what was estimated. Empty if the recipe came straight from the page.',
      },
    },
    required: [
      'found', 'title', 'original_title', 'description', 'category', 'more_categories', 'tags', 'servings', 'prep_time',
      'cook_time', 'total_time', 'ingredients', 'steps', 'tips', 'nutrition', 'diet', 'basis', 'confidence', 'notes',
    ],
    additionalProperties: false,
  },
};

const WEB_TOOLS = [
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 6 },
  { type: 'web_search_20260209', name: 'web_search', max_uses: 8 },
];

export const SYSTEM = `You turn a link that a user saved (a recipe website or a cooking video) into a clean recipe \
for their Hebrew recipe book, and file it under the categories that fit.

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
- A Pinterest pin: the recipe is usually on the site the pin links to ("Linked page" below) – build it from there. \
If that page could not be read, web_fetch it. If the pin has no link (often a re-posted video), the pin's image is \
attached: read any creator handle or watermark on it (e.g. "@doctorbowl") and any text, then web_search for that \
creator's original recipe (Instagram / TikTok / YouTube / blog) and use it. Only if the original cannot be found, \
reconstruct the dish from what is visible and set basis to "guessed".
- A website: if the page text below is missing or blocked, web_fetch the link.
- A WhatsApp message or text the user pasted: build the recipe from that text. If it is chatter and not a recipe, set found=false.
- Photos and messages: if one source has several different dishes, give each its own recipe (more_recipes) – never \
merge two dishes into one recipe or one title.
- Photos and screenshots: copy EVERY ingredient and step line that is visible in ANY of the images, in every section (e.g. "לבסיס", "למרק", "לרוטב"), with its own section title and its exact amount – go over each image line by line, including lines partly hidden behind a floating button or banner, and never move a line to a different section. A screenshot of a recipe site or app is a full written recipe: do NOT add a "השלמה" section to it.
- Photos and messages: a handwritten note or short message often leaves out what is needed to actually cook the dish \
(e.g. kreplach with the dough written but not the meat filling, or no cooking time). Keep everything that is written \
exactly as written, and complete only what is missing from the standard version of that dish: put the completed \
ingredients and steps in their own section titled "השלמה (לא מהמקור)", set confidence to "medium", and say in notes \
what was completed. Do not change amounts that are written.
- Choose the single best category, and in more_categories every other category that also clearly fits \
(a recipe can be in several, e.g. chicken that is a main dish: "עוף" and the user's "מנה עיקרית"). Don't add \
categories that only loosely fit. Desserts that are cakes → "עוגות"; cookies, rugelach, pastries → \
"עוגיות ומאפים מתוקים"; bread, pita, savory pies/bourekas → "לחמים ומאפים"; shakshuka/pancakes → "ארוחת בוקר"; \
a vegetarian main dish → "צמחוני וטבעוני" unless it is clearly a salad/soup/pasta.
- Set found=false ONLY when the link is clearly not about food or cooking, or nothing at all identifies a \
dish (not even the title or caption). Explain why in notes.
- nutrition: estimate it for one serving from the final ingredient list and amounts (standard food composition \
values), counting only what is eaten (e.g. not all the frying oil). If the yield is not written, assume a reasonable one.
- When done, call submit_recipe. Do not write anything else.`;

function material(src) {
  if (src.images) {
    return [
      'Source: photos of a recipe (a cookbook page, a handwritten note, a screenshot or a printed page). Read all of them \
- they may be several pages of the same recipe - and build the recipe from what is written. Keep the original \
amounts. If a word is hard to read, use the most likely reading and mention it in notes. A page can hold several \
different recipes (each usually with its own heading) – return each one separately.',
      src.hint ? `The user wrote: ${src.hint}` : '',
    ].filter(Boolean).join('\n\n');
  }
  if (src.fromText) {
    return [
      src.url
        ? `Source: text the user copied from the post at ${src.url} (the link itself could not be read). Build the recipe from this text only.`
        : src.kind === 'file'
          ? 'Source: text read from a document the user uploaded (Word / PDF / text file; layout may be messy, and Hebrew from a PDF may have odd line order). It may hold one recipe or a section of a cookbook with several – give each recipe its own entry (more_recipes), and ignore tables of contents, page numbers and headers. Build the recipes from this text only.'
          : 'Source: a message from a WhatsApp chat (no link). Build the recipe from this text only.',
      src.chat ? `${src.kind === 'file' ? 'File' : 'Chat'}: ${src.chat}` : '',
      src.author ? `Sent by: ${src.author}` : '',
      `${src.url ? 'Copied text' : src.kind === 'file' ? 'Document text' : 'Message'}:\n${src.text}`,
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
    .map((s) => ({ title: clean(s?.title), items: cleanList(s?.items).map((i) => i.replace(/^\d+[.)](?=\s)\s*/, '')) }))
    .filter((s) => s.items.length);

// מאחד את תשובת הסוכן עם מה שנאסף מהדף לרשומת מתכון
export function toRecipe(input, src, categories = CATEGORIES) {
  const ingredients = cleanSections(input.ingredients);
  const diet = cleanDiet(input.diet, ingredients.flatMap((g) => g.items));
  return {
    title: clean(input.title) || clean(src.title) || 'מתכון',
    originalTitle: clean(input.original_title) || clean(src.title),
    description: clean(input.description),
    ...categoryFields([input.category, ...(Array.isArray(input.more_categories) ? input.more_categories : [])], categories),
    tags: cleanList(input.tags).slice(0, 5),
    servings: clean(input.servings),
    prepTime: clean(input.prep_time),
    cookTime: clean(input.cook_time),
    totalTime: clean(input.total_time),
    ingredients,
    steps: cleanSections(input.steps),
    tips: cleanList(input.tips),
    nutrition: cleanNutrition(input.nutrition),
    ...(diet ? { diet } : {}),
    basis: ['source', 'completed', 'guessed'].includes(input.basis) ? input.basis : 'source',
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

// סידור מחדש של מתכון קיים בכל הקטגוריות שמתאימות לו (בלי רשת – רק השם, התיאור והמצרכים)
export async function suggestCategories(client, recipe, categories = CATEGORIES) {
  const names = [...new Set([...CATEGORIES, ...categories])];
  const tool = {
    name: 'submit_categories',
    description: 'Submit the categories for the recipe, best first.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { categories: { type: 'array', items: { type: 'string', enum: names }, description: 'The best category first, then every other category that clearly fits (1-3 in total)' } },
      required: ['categories'],
      additionalProperties: false,
    },
  };
  const items = (recipe.ingredients || []).flatMap((g) => g.items || []).slice(0, 40);
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 1000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: `You file recipes in a Hebrew recipe book. A recipe can be in several categories: the best one first, then every other category that clearly fits (e.g. chicken that is a main dish: "עוף" and "מנה עיקרית" if that category exists). Don't add categories that only loosely fit. Categories: ${names.join(', ')}. Call submit_categories.`,
    tools: [tool],
    messages: [{
      role: 'user',
      content: `Recipe: ${recipe.title || ''}\n${recipe.description || ''}\nCurrent category: ${recipe.category || ''}\nIngredients:\n${items.map((i) => `- ${i}`).join('\n')}`,
    }],
  });
  const submit = response.content.find((b) => b.type === 'tool_use' && b.name === tool.name);
  if (!submit) throw new Error('לא הצלחתי לסדר את הקטגוריות. נסו שוב.');
  return categoryFields(submit.input.categories, names);
}

// הערכה תזונתית למתכון קיים (מתכונים ישנים, או אחרי עריכת המצרכים): AI קצר, בלי רשת
export async function estimateNutrition(client, recipe) {
  const tool = {
    name: 'submit_nutrition',
    description: 'Submit the estimated nutrition for one serving.',
    strict: true,
    input_schema: { type: 'object', properties: { nutrition: NUTRITION_SCHEMA }, required: ['nutrition'], additionalProperties: false },
  };
  const list = (sections) => (sections || []).flatMap((g) => [g.title ? `[${g.title}]` : null, ...(g.items || [])]).filter(Boolean).slice(0, 80);
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: 'You estimate nutrition for home recipes. Use the ingredients and their amounts with standard food composition values, account for what is actually eaten (e.g. frying oil that stays in the pan, optional garnish), and divide by the yield. Call submit_nutrition.',
    tools: [tool],
    messages: [{
      role: 'user',
      content: `Recipe: ${recipe.title || ''}\nYield: ${recipe.servings || 'not written'}\nIngredients:\n${list(recipe.ingredients).map((i) => `- ${i}`).join('\n')}\nSteps:\n${list(recipe.steps).slice(0, 30).join('\n')}`,
    }],
  });
  const submit = response.content.find((b) => b.type === 'tool_use' && b.name === tool.name);
  const nutrition = submit && cleanNutrition(submit.input.nutrition);
  if (!nutrition) throw new Error('לא הצלחתי להעריך את הערכים התזונתיים. נסו שוב.');
  return nutrition;
}

// בדיקה לפני פרסום מתכון אישי לקהילה: שזה מתכון, בלי תוכן פוגעני, בלי פרטים אישיים, ושהתמונה מתאימה.
// decision: publish (בסדר) / review (לא בטוח – מתפרסם ובעל האפליקציה מקבל התראה) / reject (לא מתפרסם, עם סיבה בעברית)
export async function moderateRecipe(client, recipe, imageUrl = null) {
  const tool = {
    name: 'submit_review',
    description: 'Submit the review of a recipe a user wants to publish to a public recipe community.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        decision: { type: 'string', enum: ['publish', 'review', 'reject'] },
        image_ok: { type: 'boolean', description: 'false if the image is not a food/cooking photo, or shows people, documents, personal details or anything inappropriate' },
        reason: { type: 'string', description: 'Short Hebrew reason for the user when the decision is reject or review (or why the image was removed); empty otherwise' },
      },
      required: ['decision', 'image_ok', 'reason'],
      additionalProperties: false,
    },
  };
  const list = (sections) => (sections || []).flatMap((g) => g.items || []).slice(0, 80).join('\n');
  const text = `Title: ${recipe.title}\nDescription: ${recipe.description || ''}\nIngredients:\n${list(recipe.ingredients)}\nSteps:\n${list(recipe.steps)}\nTips: ${(recipe.tips || []).join(' | ')}\nNotes: ${recipe.notes || ''}`;
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 1000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: `You review recipes that users of a Hebrew family recipe app want to publish to the app's public community.
publish: a real recipe (food or drink) with nothing problematic.
reject: not a recipe at all (spam, ads, random text), hateful/sexual/violent or otherwise offensive content, or personal details of real people (phone numbers, addresses, emails, ID numbers, full names of private people beyond a first name like "סבתא רחל").
review: you are not sure (e.g. a borderline joke, possibly copied commercial text, a dangerous food practice).
Also judge the attached image (if any): image_ok=false if it is not food/cooking or shows faces, documents or personal details.
The reason is in simple Hebrew, addressed to the user. Call submit_review.`,
    tools: [tool],
    messages: [{ role: 'user', content: imageUrl ? [{ type: 'image', source: { type: 'url', url: imageUrl } }, { type: 'text', text }] : text }],
  });
  const submit = response.content.find((b) => b.type === 'tool_use' && b.name === tool.name);
  if (!submit) throw new Error('הבדיקה לפני הפרסום לא הצליחה. נסו שוב.');
  const { decision, image_ok: imageOk, reason } = submit.input;
  return { decision: ['publish', 'review', 'reject'].includes(decision) ? decision : 'review', imageOk: imageOk !== false, reason: clean(reason) };
}

// תחליף למצרך שחסר: מה אפשר לשים במקומו במתכון הזה, בכמה, ומה זה משנה בתוצאה
export async function suggestSubstitutes(client, recipe, item, { diets = [] } = {}) {
  const tool = {
    name: 'submit_substitutes',
    description: 'Submit substitutes for one missing ingredient in this recipe.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        options: {
          type: 'array',
          description: '1-3 substitutes, best first. Common Israeli home-kitchen products.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Hebrew: what to use, e.g. "רסק תפוחים"' },
              amount: { type: 'string', description: 'Hebrew: how much instead of the original amount in this recipe, e.g. "1/4 כוס לכל ביצה"' },
              how: { type: 'string', description: 'Hebrew: one short sentence on how to use it (or empty)' },
              effect: { type: 'string', description: 'Hebrew: one short sentence on how the result changes (taste / texture), or empty' },
            },
            required: ['name', 'amount', 'how', 'effect'],
            additionalProperties: false,
          },
        },
        note: { type: 'string', description: 'Hebrew: short note, e.g. that the ingredient can simply be left out, or that there is no good substitute. Empty otherwise.' },
      },
      required: ['options', 'note'],
      additionalProperties: false,
    },
  };
  const list = (sections) => (sections || []).flatMap((g) => g.items || []).slice(0, 60);
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 1500,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: `You help a home cook in Israel who is missing an ingredient. Suggest substitutes that work in THIS recipe (its role: binding, rising, fat, acid, sweetness, flavor...), with the amount adjusted to the recipe. Prefer things most homes have. If the ingredient can be left out, say so in note. Keep the kosher type of the dish (don't add meat to dairy or dairy to meat).${diets.length ? ` The cook keeps: ${diets.join(', ')} – every substitute must fit.` : ''} Everything in simple Hebrew. Call submit_substitutes.`,
    tools: [tool],
    messages: [{
      role: 'user',
      content: `Recipe: ${recipe.title || ''}\nServings: ${recipe.servings || ''}\nIngredients:\n${list(recipe.ingredients).map((i) => `- ${i}`).join('\n')}\nSteps:\n${list(recipe.steps).slice(0, 20).join('\n')}\n\nMissing ingredient: ${item}`,
    }],
  });
  const submit = response.content.find((b) => b.type === 'tool_use' && b.name === tool.name);
  if (!submit) throw new Error('לא הצלחתי למצוא תחליף. נסו שוב.');
  const options = (Array.isArray(submit.input.options) ? submit.input.options : []).slice(0, 3)
    .map((o) => ({ name: clean(o?.name), amount: clean(o?.amount), how: clean(o?.how), effect: clean(o?.effect) }))
    .filter((o) => o.name);
  return { options, note: clean(submit.input.note) };
}

// בדיקה לפני שתגובה / "הכנתי!" מופיעה בקהילה: טקסט קצר ותמונה אופציונלית (base64 JPEG)
export async function moderateTalk(client, { text = '', image = null, recipeTitle = '' }) {
  const tool = {
    name: 'submit_review',
    description: 'Submit the review of a comment or photo a user wants to post under a recipe in a public recipe community.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        decision: { type: 'string', enum: ['publish', 'review', 'reject'] },
        image_ok: { type: 'boolean', description: 'false if the image is not a photo of food / cooking, or shows faces, documents, screens with personal details or anything inappropriate' },
        reason: { type: 'string', description: 'Short Hebrew reason for the user when the decision is reject or review (or why the image was removed); empty otherwise' },
      },
      required: ['decision', 'image_ok', 'reason'],
      additionalProperties: false,
    },
  };
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 600,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: `You review comments and photos that users of a Hebrew family recipe app post under a recipe in the app's public community (tips, questions, answers, "I made it!").
publish: a friendly comment, tip, question or answer about cooking (it may be short, critical or negative about the recipe – that is fine).
reject: spam, ads or links to sell something, hateful/sexual/violent or insulting content toward people, or personal details (phone numbers, addresses, emails, ID numbers, full names of private people).
review: you are not sure.
image_ok=false if the image is not food/cooking or shows faces, documents or personal details.
The reason is in simple Hebrew, addressed to the user. Call submit_review.`,
    tools: [tool],
    messages: [{
      role: 'user',
      content: [
        ...(image ? [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } }] : []),
        { type: 'text', text: `Recipe: ${recipeTitle}\nComment: ${text || '(no text)'}` },
      ],
    }],
  });
  const submit = response.content.find((b) => b.type === 'tool_use' && b.name === tool.name);
  if (!submit) throw new Error('הבדיקה לפני הפרסום לא הצליחה. נסו שוב.');
  const { decision, image_ok: imageOk, reason } = submit.input;
  return { decision: ['publish', 'review', 'reject'].includes(decision) ? decision : 'review', imageOk: imageOk !== false, reason: clean(reason) };
}

// קטגוריות של מתכון: category = הראשית (גם בשביל מתכונים ונתונים ישנים), categories = כולן, הראשית ראשונה
export const MAX_RECIPE_CATEGORIES = 4;
export function categoryFields(list, categories = CATEGORIES) {
  const valid = [...new Set((Array.isArray(list) ? list : [list]).filter((c) => typeof c === 'string' && categories.includes(c)))];
  const chosen = valid.filter((c) => c !== DEFAULT_CATEGORY).slice(0, MAX_RECIPE_CATEGORIES);
  const final = chosen.length ? chosen : [DEFAULT_CATEGORY];
  return { category: final[0], categories: final };
}

export class NoRecipeError extends Error {}

// הכלי עם רשימת הקטגוריות של הספר (הקבועות + אלה שהמשתמש הוסיף).
// multi: צילום / הודעה בלי קישור יכולים להכיל כמה מתכונים שונים (למשל פתק עם קניידלך וכיסוני בשר) – כל אחד נשמר בנפרד
export function recipeTool(categories = CATEGORIES, { multi = false, withDiet = true } = {}) {
  const tool = structuredClone(RECIPE_TOOL);
  tool.input_schema.properties.category.enum = [...new Set([...CATEGORIES, ...categories])];
  tool.input_schema.properties.more_categories.items.enum = tool.input_schema.properties.category.enum;
  // כמה מתכונים: בלי סימון ה-AI לסינון – אחרת הסכמה (כפולה, לכל מתכון) גדולה מדי ל-API ("too large").
  // המתכונים האלה מסוננים לפי המצרכים
  if (multi || !withDiet) {
    delete tool.input_schema.properties.diet;
    tool.input_schema.required = tool.input_schema.required.filter((k) => k !== 'diet');
  }
  if (multi) {
    const { found, ...one } = tool.input_schema.properties;
    void found;
    tool.input_schema.properties.more_recipes = {
      type: 'array',
      description: 'ONLY when the source has two or more DIFFERENT dishes (e.g. a note with kneidlach and kreplach): the first dish goes in the main fields, and every other dish here, each as a full separate recipe with its own title, ingredients and steps. Parts of ONE dish (a cake and its frosting, a dough and its filling) stay ONE recipe. Empty for a single dish.',
      items: {
        type: 'object', properties: one, required: Object.keys(one), additionalProperties: false,
      },
    };
    tool.input_schema.required = [...tool.input_schema.required, 'more_recipes'];
  }
  return tool;
}

export async function extractRecipe(client, src, { categories = CATEGORIES } = {}) {
  // מתכון מובנה מלא מהדף, או הודעת ווטסאפ: אין צורך ברשת, זה מהיר וזול יותר
  const complete = src.fromText || src.images || looksComplete(src);
  const custom = categories.filter((c) => !CATEGORIES.includes(c));
  const text = material(src) + (custom.length
    ? `\n\nThe user added their own categories: ${custom.join(', ')}. Prefer one of them when it fits the dish better than the general ones.`
    : '');
  // כמה מתכונים ממקור אחד: רק בצילום / הודעה בלי קישור (מתכון מקישור מזוהה לפי הקישור, ואי אפשר לשמור שניים לאותו קישור)
  const multi = Boolean(src.images || (src.fromText && !src.url));
  let RECIPE_TOOL = recipeTool(categories, { multi });
  // פין בלי קישור לאתר: גם התמונה שלו נשלחת, כדי שהסוכן יקרא סימן מים / שם יוצר ויחפש את המתכון המקורי
  const pinImage = src.kind === 'pinterest' && !src.linked?.length && /^https:\/\//.test(src.image || '') ? src.image : null;
  const content = src.images
    ? [...src.images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.type, data: i.data } })), { type: 'text', text }]
    : pinImage ? [{ type: 'image', source: { type: 'url', url: pinImage } }, { type: 'text', text }] : text;
  const messages = [{ role: 'user', content }];
  for (let step = 0; step < MAX_STEPS; step++) {
    const request = () => client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // צילום: קריאה מדויקת של כל השורות (בחשיבה נמוכה דילג על חלק שלם מצילום מסך)
      output_config: { effort: complete && !src.images ? 'low' : 'medium' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: complete ? [RECIPE_TOOL] : [...WEB_TOOLS, RECIPE_TOOL],
      messages,
    });
    let response;
    // הסכמה גדולה/מורכבת מדי ל-API: מנסים שוב עם כלי פשוט יותר, צעד אחרי צעד, עד שמצליח –
    // בלי סימון ה-AI לסינון (הסינון לפי המצרכים), אחר כך מתכון אחד בלבד, ובסוף בלי בדיקת סכמה מחמירה
    const simpler = [
      () => RECIPE_TOOL.input_schema.properties.diet && recipeTool(categories, { multi, withDiet: false }),
      () => RECIPE_TOOL.input_schema.properties.more_recipes && recipeTool(categories, { withDiet: false }),
      () => RECIPE_TOOL.strict && { ...RECIPE_TOOL, strict: false },
    ];
    for (;;) {
      try {
        response = await request();
        break;
      } catch (e) {
        const message = `${e?.message || ''} ${JSON.stringify(e?.error || {})}`;
        const schemaTooBig = (e?.status === 400 || e?.status === 413) && /too large|too complex|too many|grammar|schema/i.test(message);
        const next = schemaTooBig && simpler.map((f) => f()).find(Boolean);
        if (next) {
          RECIPE_TOOL = next;
          continue;
        }
        if (pinImage && step === 0 && e?.status === 400 && messages[0].content !== text) {
          // תמונת הפין לא נטענה אצל המודל – ממשיכים בלעדיה
          messages[0] = { role: 'user', content: text };
          continue;
        }
        throw e;
      }
    }
    if (response.stop_reason === 'refusal') throw new Error('הבקשה נדחתה על ידי המודל.');
    const submit = response.content.find((b) => b.type === 'tool_use' && b.name === RECIPE_TOOL.name);
    if (submit) {
      if (!submit.input.found) throw new NoRecipeError(clean(submit.input.notes) || 'לא נמצא מתכון בקישור הזה.');
      const known = RECIPE_TOOL.input_schema.properties.category.enum;
      const recipe = toRecipe(submit.input, src, known);
      // שאר המתכונים מאותו מקור: מפתח מקור משלהם (אחרת היו נשמרים זה על זה)
      const more = RECIPE_TOOL.input_schema.properties.more_recipes ? (Array.isArray(submit.input.more_recipes) ? submit.input.more_recipes : []).slice(0, 5) : [];
      recipe.more = more
        .map((input) => toRecipe(input, src, known))
        .filter((r) => r.ingredients.length || r.steps.length)
        .map((r, i) => ({ ...r, source: { ...r.source, key: `${r.source.key}:${i + 2}` } }));
      return recipe;
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
Always search before submitting, and try another phrasing (Hebrew "מתכון ..." and English "... recipe") if the first \
search finds little. Common dishes always have recipes online - never submit an empty list. Call submit_results.`;

export async function searchRecipes(client, query) {
  const messages = [{ role: 'user', content: `Find recipes for: ${query}` }];
  // חיפוש ברשת שנכשל לא זורק שגיאה: מגיע כבלוק תוצאה שהתוכן שלו אובייקט שגיאה (ולא רשימה)
  const searchErrors = [];
  let searchOk = false;
  let searches = 0;
  let retried = false;
  let forceSearch = false;
  for (let step = 0; step < 6; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: SEARCH_SYSTEM,
      // אחרי שהמודל ויתר בלי לחפש בכלל – מציעים לו רק חיפוש ברשת עד שיחפש
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 }, ...(forceSearch && !searches ? [] : [SEARCH_TOOL])],
      messages,
    });
    if (response.stop_reason === 'refusal') throw new Error('הבקשה נדחתה על ידי המודל.');
    for (const b of response.content) {
      if (b.type === 'server_tool_use' && b.name === 'web_search') searches += 1;
      if (b.type !== 'web_search_tool_result') continue;
      if (Array.isArray(b.content)) searchOk = true;
      else searchErrors.push(b.content?.error_code || 'unknown');
    }
    const submit = response.content.find((b) => b.type === 'tool_use' && b.name === SEARCH_TOOL.name);
    if (submit) {
      const results = submit.input.results
        .filter((r) => /^https?:\/\//.test(r.url))
        .slice(0, 8)
        .map((r) => ({ title: clean(r.title), url: r.url.trim(), site: clean(r.site), description: clean(r.description) }));
      // אין תוצאות כי החיפוש ברשת עצמו נכשל (למשל חיפוש ברשת כבוי בחשבון Anthropic) – שגיאה, לא "לא נמצא"
      if (!results.length && searchErrors.length && !searchOk) {
        throw new Error(`החיפוש ברשת לא זמין כרגע (${[...new Set(searchErrors)].join(', ')}). נסו שוב מאוחר יותר.`);
      }
      // רשימה ריקה: פעם אחת מבקשים לחפש שוב בניסוח אחר (המודל לפעמים מוותר מהר מדי)
      if (!results.length && !retried) {
        retried = true;
        if (!searches) {
          // רשימה ריקה בלי אף חיפוש: מתחילים מחדש, והפעם בלי כלי ההגשה – רק חיפוש ברשת
          forceSearch = true;
          messages.splice(0, messages.length, { role: 'user', content: `Find recipes for: ${query}\n\nSearch the web now (Hebrew "מתכון ..." and English "... recipe").` });
          continue;
        }
        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'user', content: [{
          type: 'tool_result', tool_use_id: submit.id, is_error: true,
          content: 'No results were submitted. Search the web again with other phrasings (Hebrew and English) and submit at least 3 direct recipe pages.',
        }] });
        continue;
      }
      if (!results.length) throw new Error(`לא מצאתי מתכונים ברשת לחיפוש הזה (${searches} חיפושים). נסו לנסח אחרת.`);
      return results;
    }
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;
    messages.push({ role: 'user', content: searches ? `Call ${SEARCH_TOOL.name} now with what you found.` : 'Search the web for this dish now.' });
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

// ---------- שגיאות מה-API של Anthropic בעברית ----------
// השגיאה הגולמית (באנגלית, עם JSON) לא מגיעה למשתמש. בעל האפליקציה מקבל גם מה לעשות.
export function aiMessage(e, { owner = false } = {}) {
  const status = Number(e?.status) || 0;
  if (!status) return null; // שגיאה שלנו (כבר בעברית) או תקלת רשת
  const text = `${e?.message || ''} ${JSON.stringify(e?.error || {})}`.toLowerCase();
  if (/credit balance|billing|purchase credits/.test(text)) {
    return owner
      ? 'נגמר הקרדיט בחשבון Anthropic. אפשר לטעון ב-console.anthropic.com ← Settings ← Billing, ואז הכל חוזר לעבוד.'
      : 'השירות לא זמין כרגע. נסו שוב מאוחר יותר.';
  }
  if (status === 401 || status === 403) {
    return owner ? 'מפתח ה-API של Anthropic לא תקין או בוטל. צריך לעדכן אותו בסודות של GitHub.' : 'השירות לא זמין כרגע. נסו שוב מאוחר יותר.';
  }
  if (status === 429 || status === 529 || status >= 500 || /overloaded|rate.?limit/.test(text)) return 'יש עומס כרגע. נסו שוב בעוד דקה.';
  if (status === 413 || /too large|too long/.test(text)) return 'לא הצלחנו לקרוא את זה הפעם. נסו שוב, ואם זה חוזר – צלמו קרוב יותר או חלקו לכמה תמונות.';
  return null;
}
