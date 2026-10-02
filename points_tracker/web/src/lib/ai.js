// הסוכן שבתוך האפליקציה: Claude עם חיפוש ברשת, ראייה (צילום) וקריאת מרכיבים.
// המפתח של המשתמש נשמר רק במכשיר שלו, והקריאות יוצאות ישירות מהדפדפן ל-Anthropic.
import Anthropic from '@anthropic-ai/sdk';
import { pointsForGrams, round1 } from './points';
import { findByName } from './foodDb';

export const DEFAULT_MODEL = 'claude-opus-5-5';
export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Opus 5.5 (מדויק, ברירת מחדל)' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5 (זול ומהיר יותר)' },
];
const MAX_STEPS = 8;

const nutritionSchema = {
  type: 'object',
  description: 'Nutrition per 100 grams',
  properties: {
    kcal: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    fat: { type: 'number' },
    fiber: { type: 'number' },
  },
  required: ['kcal', 'protein', 'carbs', 'fat', 'fiber'],
  additionalProperties: false,
};

const ANALYZE_TOOL = {
  name: 'submit_analysis',
  description: 'Submit the breakdown of the food into components with amounts and nutrition.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      dish_name: { type: 'string', description: 'Short Hebrew name of the dish/meal' },
      servings: {
        type: 'number',
        description: 'How many servings the described amounts make (1 for a single plate/portion)',
      },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      notes_he: { type: 'string', description: 'Short Hebrew note: assumptions, what to check' },
      components: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Hebrew name of the component' },
            amount: { type: 'string', description: 'Hebrew amount as a person would say it, e.g. "חצי פיתה", "2 כפות"' },
            grams: { type: 'number', description: 'Estimated weight in grams of this amount' },
            db_name: {
              type: ['string', 'null'],
              description: 'Exact name of the matching item from the user database, or null',
            },
            db_quantity: {
              type: ['number', 'null'],
              description: 'How many units of db_name this amount is (e.g. 0.5 for half a pita), or null',
            },
            per100: nutritionSchema,
          },
          required: ['name', 'amount', 'grams', 'db_name', 'db_quantity', 'per100'],
          additionalProperties: false,
        },
      },
    },
    required: ['dish_name', 'servings', 'confidence', 'notes_he', 'components'],
    additionalProperties: false,
  },
};

export const FOOD_TOOL = {
  name: 'submit_food',
  description: 'Submit the researched nutrition data for the requested food.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      found: { type: 'boolean', description: 'false if no reliable data was found' },
      name: { type: 'string', description: 'Canonical Hebrew name (brand included for packaged products)' },
      aliases: { type: 'array', items: { type: 'string' } },
      serving_desc: { type: 'string', description: 'Hebrew common serving, e.g. "יחידה", "פרוסה", "כוס", "100 ג\'"' },
      serving_grams: { type: 'number' },
      per100: nutritionSchema,
      published_points: {
        type: ['number', 'null'],
        description: 'Points value per serving if an Israeli points-diet source publishes one, else null',
      },
      sources: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      notes_he: { type: 'string' },
    },
    required: [
      'found', 'name', 'aliases', 'serving_desc', 'serving_grams', 'per100',
      'published_points', 'sources', 'confidence', 'notes_he',
    ],
    additionalProperties: false,
  },
};

const LABEL_TOOL = {
  name: 'submit_label',
  description: 'Submit the values read from a nutrition facts label.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      product_name: { type: 'string' },
      per100: nutritionSchema,
      serving_grams: { type: ['number', 'null'], description: 'Serving size in grams if printed, else null' },
      readable: { type: 'boolean', description: 'false if the image is not a readable nutrition label' },
    },
    required: ['product_name', 'per100', 'serving_grams', 'readable'],
    additionalProperties: false,
  },
};

const WEB_TOOLS = [
  { type: 'web_search_20260209', name: 'web_search', max_uses: 6 },
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 3 },
];

const ANALYZE_SYSTEM = `You help an Israeli user count diet points. You break food into components \
and estimate the weight and nutrition of each. Points are computed by the app, not by you.

Rules:
- Partial amounts matter: "חצי פיתה עם שוקולד" is half a pita plus the chocolate spread on it; \
"2 משולשי פיצה" is two slices. Put the eaten amount in grams, amount and db_quantity.
- If a component matches an item in the user's database below, set db_name to its EXACT name and \
db_quantity to how many of that item's units were eaten (the unit is written in the item's name, \
e.g. "(כף)" or "(100 ג')"). Otherwise set both to null.
- Always fill per100 with realistic Israeli nutrition values per 100 g (use typical Israeli products: \
Tnuva, Strauss, Angel, Elite...). Include hidden fats: frying oil, spreads, sauces, tahini.
- For a recipe / ingredient list, list every ingredient with its full amount and set servings to \
the number of portions the recipe makes (from the text, or your best estimate).
- For a photo of a dish, estimate the portion visible in the photo (plate size, utensils, hands help) \
and set servings to 1.
- Write names, amounts and notes in Hebrew. Call submit_analysis. Do not answer in plain text.`;

const RESEARCH_SYSTEM = `You research nutrition data for an Israeli diet-points app. The app computes \
points from protein, carbs, fat and fiber per 100 g, so those numbers must be accurate.

Where to look (search in Hebrew first):
- The manufacturer's site or the product page at Israeli supermarkets (shufersal.co.il, \
rami-levy.co.il, yochananof.co.il, victoryonline.co.il) - the nutrition table is on the package.
- The Ministry of Health Tzameret food composition database and nutrition sites (foodsdictionary.co.il).
- Restaurant / chain menus that publish nutrition values.
- Israeli points-diet sites, forums and Facebook groups, for a published points value per serving.
- International databases (USDA FoodData Central) only for generic foods.

Use the most common serving in Israel (unit, slice, cup, package). If values disagree, prefer the \
manufacturer label. Put the URLs you used in sources. If you find nothing reliable, set found=false. \
Call submit_food. Do not answer in plain text.`;

function client(settings) {
  if (!settings.apiKey) throw new Error('צריך להגדיר מפתח API בהגדרות כדי להשתמש בסוכן.');
  return new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
}

async function callWithSubmit(settings, { system, content, tool, web = false, effort = 'low' }) {
  const api = client(settings);
  const messages = [{ role: 'user', content }];
  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await api.beta.messages.create({
      model: settings.model || DEFAULT_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort },
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools: web ? [...WEB_TOOLS, tool] : [tool],
      messages,
    });
    if (response.stop_reason === 'refusal') throw new Error('הבקשה נדחתה על ידי המודל.');
    const submit = response.content.find((b) => b.type === 'tool_use' && b.name === tool.name);
    if (submit) return submit.input;
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue; // חיפוש ברשת עדיין רץ - ממשיכים
    messages.push({ role: 'user', content: `Call ${tool.name} now with what you have.` });
  }
  throw new Error('הסוכן לא החזיר תשובה. נסה שוב.');
}

function imageBlock(dataUrl) {
  const [, mediaType, data] = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.*)$/) || [];
  if (!data) throw new Error('תמונה לא תקינה');
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data } };
}

function dbContext(db) {
  return `User database (name = points per unit in the name):\n${db
    .map((f) => `${f.name} = ${f.points}`)
    .join('\n')}`;
}

// מחשב נקודות לכל רכיב: לפי פריט במאגר אם הסוכן מצא התאמה, אחרת לפי ערכים תזונתיים.
export function scoreComponents(components, db) {
  return components.map((c) => {
    const dbItem = c.db_name ? findByName(db, c.db_name) : null;
    const points =
      dbItem && c.db_quantity > 0 ? Number(dbItem.points) * c.db_quantity : pointsForGrams(c.per100, c.grams);
    return { ...c, dbItem, points: round1(points) };
  });
}

// ניתוח מאכל מצילום או מטקסט חופשי / רשימת מרכיבים.
export async function analyzeFood(settings, db, { imageDataUrl, text }) {
  const content = [{ type: 'text', text: dbContext(db) }];
  if (imageDataUrl) {
    content.push(imageBlock(imageDataUrl));
    content.push({
      type: 'text',
      text: text
        ? `Photo of what I ate. Extra details from me: ${text}`
        : 'Photo of what I ate. Identify the dish and estimate the portion in the photo.',
    });
  } else {
    content.push({ type: 'text', text: `What I ate / the recipe:\n${text}` });
  }
  const result = await callWithSubmit(settings, { system: ANALYZE_SYSTEM, content, tool: ANALYZE_TOOL });
  return { ...result, servings: result.servings > 0 ? result.servings : 1 };
}

// סוכן חיפוש: מוצא ברשת ערכים תזונתיים למאכל שלא נמצא במאגר.
export async function researchFood(settings, query) {
  const result = await callWithSubmit(settings, {
    system: RESEARCH_SYSTEM,
    content: `Today is ${new Date().toISOString().slice(0, 10)}. Find nutrition data for: ${query}`,
    tool: FOOD_TOOL,
    web: true,
    effort: 'medium',
  });
  return { ...result, points: round1(pointsForGrams(result.per100, result.serving_grams)) };
}

// תוצאת חיפוש -> פריט למאגר (null אם הסוכן לא מצא מידע אמין).
export function researchToFood(result) {
  if (!result.found || !(result.serving_grams > 0)) return null;
  return {
    name: `${result.name} (${result.serving_desc})`,
    points: result.points,
    grams: result.serving_grams,
    per100: result.per100,
    aliases: result.aliases,
    sources: result.sources.slice(0, 5),
    published_points: result.published_points,
    source: 'agent',
  };
}

// קריאת טבלת ערכים תזונתיים מצילום אריזה.
export async function readNutritionLabel(settings, imageDataUrl) {
  return callWithSubmit(settings, {
    system:
      'You read nutrition facts labels (Israeli labels: "סימון תזונתי", values per 100 g / 100 ml). ' +
      'Copy the per-100 values exactly; fiber is "סיבים תזונתיים" (0 if missing). Call submit_label.',
    content: [imageBlock(imageDataUrl), { type: 'text', text: 'Read this label.' }],
    tool: LABEL_TOOL,
  });
}

export function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) return 'מפתח ה-API לא תקין. בדוק בהגדרות.';
  if (err instanceof Anthropic.RateLimitError) return 'יותר מדי בקשות. נסה שוב בעוד דקה.';
  if (err instanceof Anthropic.APIConnectionError) return 'אין חיבור לשרת. בדוק את האינטרנט.';
  if (err instanceof Anthropic.APIError) return `שגיאה מהשרת (${err.status}). נסה שוב.`;
  return err?.message || 'שגיאה לא צפויה';
}

// בדיקת מפתח בלי לצרוך טוקנים.
export async function testApiKey(settings) {
  await client(settings).models.retrieve(settings.model || DEFAULT_MODEL);
}
