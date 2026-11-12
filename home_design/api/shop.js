// רשימת קניות להדמיה: Claude משווה את הצילום המקורי להדמיה ומפרט מה צריך לקנות, איפה בישראל, וכמה זה עולה בערך.
// המחירים הם הערכה של המעצב (לא מחירון חי) – האפליקציה מוסיפה לכל פריט קישורי חיפוש למחירים אמיתיים.
import { callTool, imageBlock } from './designer.js';

export const SHOP_TOOL = {
  name: 'shopping_list',
  description: 'The shopping list and cost estimate for carrying out the design shown in the "after" image.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Hebrew, 1-2 sentences: what the job includes overall' },
      items: {
        type: 'array',
        description: 'Everything that has to be bought, most important first (up to 10)',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Hebrew, short: what to buy' },
            details: { type: 'string', description: 'Hebrew: material, color, size or style to look for so it matches the image' },
            quantity: { type: 'string', description: 'Hebrew: how much is needed for this room, e.g. "כ-12 מ״ר", "3 יחידות", "5 ליטר"' },
            price_min: { type: 'integer', description: 'Low estimate in ILS for the whole quantity' },
            price_max: { type: 'integer', description: 'High estimate in ILS for the whole quantity' },
            stores: { type: 'array', items: { type: 'string' }, description: '1-3 places in Israel that sell this: chain names or type of shop, in Hebrew' },
            search: { type: 'string', description: 'Hebrew search phrase (3-6 words) that finds this product in an Israeli price-comparison site' },
          },
          required: ['name', 'details', 'quantity', 'price_min', 'price_max', 'stores', 'search'],
          additionalProperties: false,
        },
      },
      labor: {
        type: 'object',
        description: 'Professional work, if the job needs one',
        properties: {
          needed: { type: 'boolean', description: 'false when a handy home owner can do it all alone' },
          description: { type: 'string', description: 'Hebrew: which professional and for what; empty when not needed' },
          price_min: { type: 'integer', description: 'ILS, 0 when not needed' },
          price_max: { type: 'integer', description: 'ILS, 0 when not needed' },
        },
        required: ['needed', 'description', 'price_min', 'price_max'],
        additionalProperties: false,
      },
      tips: { type: 'string', description: 'Hebrew, 1-2 sentences: one practical tip for buying or doing this (where to save, what not to save on)' },
    },
    required: ['summary', 'items', 'labor', 'tips'],
    additionalProperties: false,
  },
};

export const SYSTEM = `You are an experienced interior designer in Israel helping a home owner carry out a design. You get \
two images: the first is the real photo of their room today, the second is a simulation of the same room after the \
change they chose. You also get the change they asked for.

Work out what actually differs between the two images and list what the owner has to buy to get from the first to the \
second: materials (paint, wallpaper, wood slats, plaster), furniture, lighting, decor. Do not list things that are \
already in the first photo. Estimate quantities from what you can see of the room size, and say so in the quantity.

Prices: realistic current retail ranges in Israel in ILS including VAT, for the whole quantity. These are estimates, \
so give an honest range rather than one number. For stores, name places where people in Israel really buy this kind \
of product (for example home-improvement and furniture chains, paint shops, carpenters, online marketplaces). Add \
professional work only if the job really needs one.

Write everything in natural, simple Israeli Hebrew. Always finish by calling shopping_list.`;

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const money = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Math.round(Number(n)) : 0);
// טווח תקין: מינימום לא גדול מהמקסימום
const range = (a, b) => { const lo = money(a), hi = money(b); return { min: Math.min(lo, hi || lo), max: Math.max(lo, hi) }; };

// הקלט של הכלי -> רשימה נקייה, או null אם אין בה פריטים
export function readShop(input) {
  if (!input || !Array.isArray(input.items)) return null;
  const items = input.items
    .map((i) => ({
      name: clean(i?.name),
      details: clean(i?.details),
      quantity: clean(i?.quantity),
      ...range(i?.price_min, i?.price_max),
      stores: (Array.isArray(i?.stores) ? i.stores : []).map(clean).filter(Boolean).slice(0, 3),
      search: clean(i?.search) || clean(i?.name),
    }))
    .filter((i) => i.name)
    .slice(0, 12);
  if (!items.length) return null;
  const labor = input.labor?.needed ? { description: clean(input.labor.description), ...range(input.labor.price_min, input.labor.price_max) } : null;
  return { summary: clean(input.summary), items, labor, tips: clean(input.tips) };
}

// before / after: { media_type, data }. request: השינוי שהמשתמש ביקש
// מחזיר { summary, items, labor, tips } או זורק Error עם הודעה בעברית
export async function shoppingList(env, before, after, request) {
  const content = [
    { type: 'text', text: 'Image 1 - the room today:' },
    imageBlock(before),
    { type: 'text', text: 'Image 2 - the simulation after the change:' },
    imageBlock(after),
    { type: 'text', text: request ? `The change the owner asked for: ${request}` : 'The owner did not describe the change - work it out from the images.' },
  ];
  const out = readShop(await callTool(env, { system: SYSTEM, tool: SHOP_TOOL, content }));
  if (!out) throw new Error('המעצב לא הצליח להכין רשימת קניות. נסו שוב.');
  return out;
}
