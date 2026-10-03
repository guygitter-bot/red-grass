// "איפה לקנות": סופרים קרובים למיקום של המשתמש (OpenStreetMap), כמה יעלה לקנות בכל רשת את מה שחסר,
// וקישור להזמנה אונליין כשיש לרשת אתר הזמנות.
import { MODEL } from './extract.js';

// רשתות מוכרות: איך לזהות אותן בשם/מותג ב-OpenStreetMap, ואתר ההזמנות שלהן
export const CHAINS = [
  { key: 'shufersal', name: 'שופרסל', match: /שופרסל|shufersal/i, orderUrl: 'https://www.shufersal.co.il/online/he/' },
  { key: 'ramilevy', name: 'רמי לוי', match: /רמי\s*לוי|rami\s*levy/i, orderUrl: 'https://www.rami-levy.co.il/he' },
  { key: 'yochananof', name: 'יוחננוף', match: /יוחננוף|yochananof|yohananof/i, orderUrl: 'https://yochananof.co.il/' },
  { key: 'victory', name: 'ויקטורי', match: /ויקטורי|victory/i, orderUrl: 'https://www.victoryonline.co.il/' },
  { key: 'carrefour', name: 'קרפור', match: /קרפור|carrefour|יינות\s*ביתן|yeinot\s*bitan|^מגה|mega\b/i, orderUrl: 'https://www.carrefour.co.il/' },
  { key: 'hazihinam', name: 'חצי חינם', match: /חצי\s*חינם|hazi\s*hinam|hatzi\s*hinam/i, orderUrl: 'https://shop.hazi-hinam.co.il/' },
  { key: 'tivtaam', name: 'טיב טעם', match: /טיב\s*טעם|tiv\s*taam/i, orderUrl: 'https://www.tivtaam.co.il/' },
  { key: 'osherad', name: 'אושר עד', match: /אושר\s*עד|osher\s*ad/i, orderUrl: null },
  { key: 'mahsanei', name: 'מחסני השוק', match: /מחסני\s*השוק/i, orderUrl: null },
  { key: 'superyuda', name: 'סופר יודה', match: /סופר\s*יודה/i, orderUrl: null },
  { key: 'ampm', name: 'AM:PM', match: /am\s*:?\s*pm/i, orderUrl: null },
  { key: 'freshmarket', name: 'פרשמרקט', match: /פרש\s*מרקט|fresh\s*market/i, orderUrl: null },
  { key: 'keshet', name: 'קשת טעמים', match: /קשת\s*טעמים/i, orderUrl: null },
  { key: 'zolbegadol', name: 'זול ובגדול', match: /זול\s*ובגדול/i, orderUrl: null },
];

export function chainOf(tags = {}) {
  const text = [tags.brand, tags['brand:he'], tags['name:he'], tags.name, tags['name:en'], tags.operator].filter(Boolean).join(' | ');
  return CHAINS.find((c) => c.match.test(text)) || null;
}

export function distanceMeters(lat1, lon1, lat2, lon2) {
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

async function overpass(fetchFn, query) {
  let lastError;
  for (const endpoint of OVERPASS) {
    try {
      const res = await fetchFn(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'mat-kon/1.0 (recipe app; https://mat-kon.pages.dev)' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`overpass ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.elements)) return data.elements;
      throw new Error('overpass: no elements');
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('overpass failed');
}

// סופרים ומכולות במרחק עד radius מטרים, מהקרוב לרחוק
export async function nearbySupermarkets(fetchFn, lat, lon, radius = 3000) {
  const query = `[out:json][timeout:20];nwr["shop"~"^(supermarket|convenience|greengrocer)$"](around:${radius},${lat},${lon});out center tags 80;`;
  const elements = await overpass(fetchFn, query);
  const stores = elements
    .map((e) => {
      const tags = e.tags || {};
      const at = e.type === 'node' ? { lat: e.lat, lon: e.lon } : e.center;
      if (!at) return null;
      const chain = chainOf(tags);
      const name = tags['name:he'] || tags.name || chain?.name || '';
      if (!name) return null;
      const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
      return {
        id: `${e.type}/${e.id}`,
        name,
        chain: chain?.key || null,
        chainName: chain?.name || null,
        kind: tags.shop,
        lat: at.lat,
        lon: at.lon,
        distance: distanceMeters(lat, lon, at.lat, at.lon),
        address: [street, tags['addr:city']].filter(Boolean).join(', '),
        hours: tags.opening_hours || '',
        orderUrl: chain?.orderUrl || null,
      };
    })
    .filter(Boolean)
    // סופרים של רשתות קודם, אחר כך מכולות. כל קבוצה מהקרוב לרחוק
    .sort((a, b) => (a.kind === 'supermarket' ? 0 : 1) - (b.kind === 'supermarket' ? 0 : 1) || a.distance - b.distance);
  return stores.slice(0, 25);
}

// ---------- מחירים: הערכה לפי מחירים ברשת (כשאין מחירון מסודר) ----------

export const PRICES_TOOL = {
  name: 'submit_prices',
  description: 'Submit the estimated basket price in each supermarket chain.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      chains: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            chain: { type: 'string', description: 'Chain name exactly as given in the list' },
            total: { type: 'number', description: 'Estimated total in ILS for all the items' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  item: { type: 'string', description: 'The ingredient as the user wrote it' },
                  product: { type: 'string', description: 'The product to buy, Hebrew, with pack size, e.g. "שמנת מתוקה 38% 250 מ\\"ל"' },
                  price: { type: 'number', description: 'Price in ILS for one pack' },
                },
                required: ['item', 'product', 'price'],
                additionalProperties: false,
              },
            },
          },
          required: ['chain', 'total', 'items'],
          additionalProperties: false,
        },
      },
      note: { type: 'string', description: 'One short Hebrew sentence on how the prices were found and how reliable they are' },
    },
    required: ['chains', 'note'],
    additionalProperties: false,
  },
};

const PRICES_SYSTEM = `You compare Israeli supermarket prices for a home cook. For the products they are missing, pick the \
smallest standard pack that covers each ingredient, and find its current price in each of the given chains. Use web_search \
(the chains' online stores, price comparison sites such as cheapersal.co.il, chp.co.il, pricez.co.il). When a chain's exact \
price cannot be found, estimate from the chain's usual price level (e.g. Rami Levy and Osher Ad are usually cheapest, \
AM:PM and Tiv Taam more expensive). Totals must be the sum of the item prices. Prices in ILS. Call submit_prices.`;

export async function estimatePrices(client, items, chainNames) {
  const messages = [{
    role: 'user',
    content: `Missing products:\n${items.map((i) => `- ${i}`).join('\n')}\n\nChains near the user: ${chainNames.join(', ')}`,
  }];
  for (let step = 0; step < 6; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: PRICES_SYSTEM,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }, PRICES_TOOL],
      messages,
    });
    if (response.stop_reason === 'refusal') throw new Error('הבקשה נדחתה על ידי המודל.');
    const submit = response.content.find((b) => b.type === 'tool_use' && b.name === PRICES_TOOL.name);
    if (submit) return cleanPrices(submit.input, chainNames);
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;
    messages.push({ role: 'user', content: `Call ${PRICES_TOOL.name} now with what you found.` });
  }
  throw new Error('לא הצלחתי להשוות מחירים.');
}

const money = (n) => (Number.isFinite(n) && n >= 0 && n < 100000 ? Math.round(n * 100) / 100 : null);

export function cleanPrices(input, chainNames) {
  const chains = (Array.isArray(input?.chains) ? input.chains : [])
    .map((c) => {
      const chain = CHAINS.find((x) => x.match.test(String(c.chain || ''))) || null;
      const items = (Array.isArray(c.items) ? c.items : [])
        .map((i) => ({ item: String(i.item || '').slice(0, 120), product: String(i.product || '').slice(0, 150), price: money(Number(i.price)) }))
        .filter((i) => i.item && i.price !== null);
      const sum = money(items.reduce((t, i) => t + i.price, 0));
      return { chain: chain?.key || null, chainName: chain?.name || String(c.chain || '').slice(0, 40), total: sum ?? money(Number(c.total)), items };
    })
    .filter((c) => c.total !== null && chainNames.includes(c.chainName))
    .sort((a, b) => a.total - b.total);
  return { chains, note: String(input?.note || '').slice(0, 300) };
}

// ---------- מחירון Cheapersal (https://cheapersal.co.il/developers) ----------
// אין בו חיפוש לפי שם, רק לפי ברקוד: הסוכן מוצא ברקוד של מוצר נפוץ לכל מצרך, ומשם מחירים אמיתיים מכל הרשתות בעיר.

const CHEAPERSAL = 'https://api.cheapersal.co.il/api/v1';

async function cheapersal(fetchFn, key, path) {
  const res = await fetchFn(`${CHEAPERSAL}${path}`, { headers: { 'X-API-Key': key, accept: 'application/json' }, signal: AbortSignal.timeout(40000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw Object.assign(new Error(data.error?.message || `cheapersal ${res.status}`), { status: res.status });
  return data.data;
}

// סניפים קרובים לפי Cheapersal (גם כגיבוי כש-OpenStreetMap לא עונה)
export async function cheapersalBranches(fetchFn, key, lat, lon) {
  const data = await cheapersal(fetchFn, key, `/branches?lat=${lat}&lon=${lon}&limit=50`);
  return (data.branches || [])
    .filter((b) => b.location && Number.isFinite(b.location.lat) && !b.isOnline)
    .map((b) => {
      const chain = CHAINS.find((c) => c.match.test(b.chain?.name || '')) || null;
      return {
        id: `cs/${b.id}`,
        name: b.name,
        chain: chain?.key || null,
        chainName: chain?.name || b.chain?.name || null,
        kind: 'supermarket',
        lat: b.location.lat,
        lon: b.location.lon,
        distance: distanceMeters(lat, lon, b.location.lat, b.location.lon),
        address: [b.address, b.city].filter(Boolean).join(', '),
        city: b.city || '',
        hours: '',
        orderUrl: chain?.orderUrl || null,
      };
    })
    .sort((a, b) => a.distance - b.distance);
}

export const BARCODES_TOOL = {
  name: 'submit_barcodes',
  description: 'Submit one real Israeli product barcode for each ingredient.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      products: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            item: { type: 'string', description: 'The ingredient exactly as given' },
            barcode: { type: 'string', description: 'The 7-13 digit barcode (EAN) of a common product sold in Israeli supermarkets, or empty if not found' },
            product: { type: 'string', description: 'Hebrew product name with brand and size' },
          },
          required: ['item', 'barcode', 'product'],
          additionalProperties: false,
        },
      },
    },
    required: ['products'],
    additionalProperties: false,
  },
};

const BARCODES_SYSTEM = `You find supermarket barcodes for a home cook in Israel. For each ingredient pick the most common \
product an Israeli would buy for it (a popular brand, the standard pack size; e.g. "שמנת מתוקה" → טרה שמנת מתוקה 38% 250 מ"ל) \
and find its real barcode (EAN-13, Israeli products usually start with 729) with web_search. Shufersal product pages include \
the barcode in the URL (shufersal.co.il/online/he/.../p/P_7290004131074), so searching "<product> שופרסל" works well. \
Never invent a barcode: leave it empty if you cannot find it. Skip water. Call submit_barcodes.`;

async function findBarcodes(client, items) {
  const messages = [{ role: 'user', content: `Ingredients:\n${items.map((i) => `- ${i}`).join('\n')}` }];
  for (let step = 0; step < 6; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: BARCODES_SYSTEM,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }, BARCODES_TOOL],
      messages,
    });
    if (response.stop_reason === 'refusal') throw new Error('הבקשה נדחתה על ידי המודל.');
    const submit = response.content.find((b) => b.type === 'tool_use' && b.name === BARCODES_TOOL.name);
    if (submit) {
      return submit.input.products
        .map((p) => ({ item: String(p.item || '').slice(0, 120), barcode: String(p.barcode || '').replace(/\D/g, ''), product: String(p.product || '').slice(0, 150) }))
        .filter((p) => p.item && /^\d{7,13}$/.test(p.barcode));
    }
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;
    messages.push({ role: 'user', content: `Call ${BARCODES_TOOL.name} now with what you found.` });
  }
  return [];
}

// המחיר שמשלמים בפועל על יחידה אחת: מבצע בלי מועדון ובלי כמות מינימום, אחרת המחיר הרגיל
const unitPrice = (p) => {
  const promo = p.promo;
  if (promo && !promo.requiresClub && (promo.minQuantity || 1) <= 1 && Number.isFinite(promo.promoPrice) && promo.promoPrice > 0) {
    return Math.min(p.price, promo.promoPrice);
  }
  return p.price;
};

// מחירים לסל בכל רשת בעיר. רשתות עם יותר מוצרים קודם, ואז לפי המחיר
export function basketByChain(perItem, nearbyChains = []) {
  const chains = new Map();
  for (const { item, product, prices } of perItem) {
    const best = new Map();
    for (const p of prices) {
      if (!Number.isFinite(p.price) || p.price <= 0 || p.branch?.isOnline) continue;
      const known = CHAINS.find((c) => c.match.test(p.chain?.name || ''));
      const name = known?.name || p.chain?.name;
      if (!name) continue;
      const price = unitPrice(p);
      if (!best.has(name) || price < best.get(name).price) best.set(name, { price, chain: known?.key || null, promo: price < p.price });
    }
    for (const [name, b] of best) {
      if (!chains.has(name)) chains.set(name, { chain: b.chain, chainName: name, total: 0, items: [] });
      const c = chains.get(name);
      c.total += b.price;
      c.items.push({ item, product, price: money(b.price), ...(b.promo ? { promo: true } : {}) });
    }
  }
  const wanted = new Set(nearbyChains);
  const list = [...chains.values()].map((c) => ({ ...c, total: money(c.total), missing: perItem.length - c.items.length }));
  const near = list.filter((c) => wanted.has(c.chainName));
  return (near.length >= 2 ? near : list)
    .sort((a, b) => a.missing - b.missing || a.total - b.total)
    .slice(0, 8);
}

export async function cheapersalPrices(fetchFn, key, items, { client, city, nearbyChains }) {
  const barcodes = (await findBarcodes(client, items)).slice(0, 10);
  if (!barcodes.length) return null;
  const q = city ? `?city=${encodeURIComponent(city)}` : '';
  const perItem = (await Promise.all(barcodes.map(async (b) => {
    try {
      const data = await cheapersal(fetchFn, key, `/products/${b.barcode}/prices${q}`);
      return { item: b.item, product: data.product?.name || b.product, prices: data.prices || [] };
    } catch {
      return null;
    }
  }))).filter((x) => x && x.prices.length);
  if (!perItem.length) return null;
  const chains = basketByChain(perItem, nearbyChains);
  if (!chains.length) return null;
  const found = perItem.length;
  return {
    chains,
    source: 'cheapersal',
    note: `נמצאו מחירים ל-${found} מתוך ${items.length} מוצרים${city ? ` ב${city}` : ''}.${found < items.length ? ' לשאר לא נמצא ברקוד במחירון.' : ''}`,
  };
}

// הכל ביחד: חנויות קרובות + השוואת מחירים לרשתות שיש באזור
export async function findStores({ lat, lon, items }, { fetch: fetchFn, client, cheapersalKey }) {
  let stores = [];
  try {
    stores = await nearbySupermarkets(fetchFn, lat, lon, 3000);
    if (stores.filter((s) => s.chain).length < 2) stores = await nearbySupermarkets(fetchFn, lat, lon, 8000);
  } catch (e) {
    console.error('overpass failed', e);
  }
  // סניפים לפי Cheapersal: העיר (למחירים), וגיבוי כש-OpenStreetMap לא ענה
  let city = '';
  if (cheapersalKey && cheapersalKey !== 'none') {
    const branches = await cheapersalBranches(fetchFn, cheapersalKey, lat, lon).catch(() => []);
    city = branches[0]?.distance < 15000 ? branches[0].city : '';
    if (!stores.length) stores = branches.filter((b) => b.distance < 10000).slice(0, 25);
  }
  if (!stores.length && !items.length) throw new Error('לא הצלחתי למצוא סופרים בסביבה. נסו שוב בעוד רגע.');
  const nearbyChains = [...new Set(stores.filter((s) => s.chainName).map((s) => s.chainName))];
  const chainNames = nearbyChains.filter((n) => CHAINS.some((c) => c.name === n)).slice(0, 6);
  let prices = null;
  if (items.length) {
    try {
      prices = (cheapersalKey && cheapersalKey !== 'none' && (await cheapersalPrices(fetchFn, cheapersalKey, items, { client, city, nearbyChains }).catch((e) => {
        console.error('cheapersal failed', e);
        return null;
      })))
        || (chainNames.length ? { ...(await estimatePrices(client, items, chainNames)), source: 'estimate' } : null);
    } catch (e) {
      prices = { chains: [], note: e.message || 'לא הצלחתי להשוות מחירים', source: 'error' };
    }
  }
  return { stores, prices };
}
