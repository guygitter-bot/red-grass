// הסוכן שבתוך האפליקציה: Claude עם חיפוש ברשת, ראייה (צילום) וקריאת מרכיבים.
// המפתח של המשתמש נשמר רק במכשיר שלו, והקריאות יוצאות ישירות מהדפדפן ל-Anthropic.
import Anthropic from '@anthropic-ai/sdk';
import { pointsForGrams, round1 } from './points';
import { findByName } from './foodDb';
import { authHeaders, proxyConnected } from './proxy';

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

// מידות ביתיות של המאכל הספציפי: כמה גרם בכף / כפית / כוס / יחידה / פרוסה
const unitsSchema = {
  type: 'array',
  description:
    'Household measures for THIS food with their weight in grams, e.g. [{"name":"כף","grams":5},{"name":"כפית","grams":2}] for grated cheese. Use Hebrew names (כף, כפית, כוס, יחידה, פרוסה, חופן, שקית...). Only measures that make sense for this food.',
  items: {
    type: 'object',
    properties: { name: { type: 'string' }, grams: { type: 'number' } },
    required: ['name', 'grams'],
    additionalProperties: false,
  },
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
      name: { type: 'string', description: 'Hebrew product name with brand, no serving info' },
      aliases: { type: 'array', items: { type: 'string' } },
      serving_desc: { type: 'string', description: 'Short Hebrew serving, e.g. "שקית 60 ג\'", "יחידה", "פרוסה"' },
      serving_grams: { type: 'number' },
      per100: nutritionSchema,
      units: unitsSchema,
      published_points: {
        type: ['number', 'null'],
        description: 'Points value per serving if an Israeli points-diet source publishes one, else null',
      },
      sources: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      notes_he: { type: 'string' },
    },
    required: [
      'found', 'name', 'aliases', 'serving_desc', 'serving_grams', 'per100', 'units',
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
      product_name: { type: 'string', description: 'Product name in HEBREW with the brand, e.g. "פתיתי פרמזן תנובה"' },
      per100: nutritionSchema,
      serving_grams: { type: ['number', 'null'], description: 'Serving size in grams if printed, else null' },
      units: unitsSchema,
      readable: { type: 'boolean', description: 'false if the image is not a readable nutrition label' },
    },
    required: ['product_name', 'per100', 'serving_grams', 'units', 'readable'],
    additionalProperties: false,
  },
};

const WEB_TOOLS = [
  { type: 'web_search_20260209', name: 'web_search', max_uses: 8 },
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 5 },
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
points from protein, carbs, fat and fiber per 100 g, so those numbers must be copied from a real \
nutrition table, not estimated.

How to research:
1. Packaged products: find the product page and read its nutrition table ("סימון תזונתי" / \
"ערכים תזונתיים ל-100 גרם"). Search in Hebrew with the brand, e.g. "<product> <brand> ערכים \
תזונתיים", "<product> שופרסל". Look at Israeli supermarket product pages (shufersal.co.il, \
rami-levy.co.il, yochananof.co.il, victoryonline.co.il, carrefour.co.il, mega.co.il) and the \
manufacturer's own site (osem.co.il, strauss-group.co.il, tnuva.co.il, elite.co.il...). Open the \
page with web_fetch to read the table itself; a search snippet is not enough.
2. If the first searches do not reach a nutrition table, try other wording: the English name, the \
barcode, foodsdictionary.co.il, open food facts (il.openfoodfacts.org).
3. Generic foods and dishes: the Ministry of Health Tzameret data (through foodsdictionary.co.il), \
then USDA FoodData Central. Restaurant / chain items: the chain's published nutrition values.
4. Israeli points-diet sites and forums only for published_points, never for per100.

News articles, Wikipedia and blogs are not nutrition sources. Put only the pages that contain the \
numbers you used in sources.

confidence: "high" = copied from the product label or an official table for this exact product; \
"medium" = official table for a very similar product or a generic food; "low" = estimated. If you \
could not find any table, set found=false instead of guessing.

Naming:
- name: the product name with the brand, in Hebrew, without serving info or parentheses \
(e.g. "במבה נוגט אסם").
- serving_desc: short Hebrew, at most 3 words, no parentheses. Packaged food: the package as sold \
("שקית 60 ג'", "בקבוק 500 מ\"ל", "חטיף 40 ג'"); otherwise the natural unit ("יחידה", "פרוסה", \
"כוס", "מנה"). serving_grams must match it.

units: household measures for this exact food with their weight in grams (כף, כפית, כוס, יחידה, פרוסה...). \
A tablespoon of grated cheese is ~5 g, of oil ~13 g, of honey ~21 g; a teaspoon is about a third of a tablespoon.

Call submit_food. Do not answer in plain text.`;

// הסוכן זמין אם יש מפתח אישי, או שרת משותף (שמחזיק את המפתח של מנהל האפליקציה) עם קוד גישה.
export const aiReady = (settings) => Boolean(settings.apiKey || proxyConnected(settings));

function client(settings) {
  if (settings.apiKey) return new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
  if (proxyConnected(settings)) {
    return new Anthropic({
      apiKey: 'via-proxy', // השרת מחליף במפתח האמיתי
      baseURL: settings.proxyUrl,
      defaultHeaders: authHeaders(settings),
      dangerouslyAllowBrowser: true,
    });
  }
  throw new Error('הסוכן לא מחובר. פתח/י את קישור ההזמנה שקיבלת.');
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

// בלי סוגריים ורווחים כפולים, כדי שהשם ייראה כמו "במבה נוגט אסם (שקית 60 ג')".
const clean = (text) => String(text || '').replace(/[()]/g, ' ').replace(/\s+/g, ' ').replace(/^[\s\-/]+|[\s\-/]+$/g, '');

// תוצאת חיפוש -> פריט למאגר (null אם הסוכן לא מצא מידע אמין).
export function researchToFood(result) {
  if (!result.found || !(result.serving_grams > 0)) return null;
  return {
    name: `${clean(result.name)} (${clean(result.serving_desc)})`,
    points: result.points,
    grams: result.serving_grams,
    per100: result.per100,
    units: result.units,
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
      'Copy the per-100 values exactly; fiber is "סיבים תזונתיים" (0 if missing). ' +
      'Write product_name in Hebrew (translate if the label is in another language). ' +
      'In units, give realistic household measures for this exact product and how many grams each weighs ' +
      '(a tablespoon of grated cheese is ~5 g, of oil ~13 g, of honey ~21 g; a teaspoon is about a third of a tablespoon; ' +
      'add "יחידה"/"פרוסה" for countable products). Call submit_label.',
    content: [imageBlock(imageDataUrl), { type: 'text', text: 'Read this label.' }],
    tool: LABEL_TOOL,
  });
}

export function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) return 'אין הרשאה: המכשיר נותק, או שקוד הגישה / מפתח ה-API לא תקינים. בקש/י קישור הזמנה חדש.';
  if (err instanceof Anthropic.RateLimitError) return 'יותר מדי בקשות. נסה שוב בעוד דקה.';
  if (err instanceof Anthropic.APIConnectionError) return 'אין חיבור לשרת. בדוק את האינטרנט.';
  if (err instanceof Anthropic.APIError) return `שגיאה מהשרת (${err.status}). נסה שוב.`;
  return err?.message || 'שגיאה לא צפויה';
}

// בדיקת מפתח בלי לצרוך טוקנים.
export async function testApiKey(settings) {
  await client(settings).models.retrieve(settings.model || DEFAULT_MODEL);
}
