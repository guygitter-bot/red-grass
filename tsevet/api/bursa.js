// החיבור לאפליקציית "בורסאי" (bursa/): הבוט 📈 בורסאי קורא משם נתונים חיים ומבצע פעולות שהבעלים ביקש.
// הפנייה דרך service binding (BURSA ב-wrangler.toml). הזיהוי: כותרת x-team-link עם מפתח שנגזר מהמפתח של Claude –
// אותה פונקציה כמו teamKey ב-bursa/api/worker.js, ושם נבדק שהפעולה ברשימה המותרת (TEAM_ROUTES).
// אין שם מסחר אמיתי: "תיק" = רישום של מה שהבעלים קנה בעצמו, "תיק דמה" = כסף וירטואלי.
const MAX_OUT = 7000;

export async function teamKey(secret) {
  if (!secret) return '';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('tsevet->bursa link v1'));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const bursaReady = (env) => Boolean(env.BURSA && env.ANTHROPIC_API_KEY);

async function call(env, path, body = {}) {
  const res = await env.BURSA.fetch(`https://bursa${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-team-link': await teamKey(env.ANTHROPIC_API_KEY) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || `שגיאה ${res.status}` };
  return data;
}

const out = (v) => {
  const s = JSON.stringify(v);
  return s.length > MAX_OUT ? `${s.slice(0, MAX_OUT)}…[cut]` : s;
};

// מניה: בלי נרות הגרף (ארוך מדי), עד 5 כותרות חדשות
function slimStock(d) {
  if (d.error) return d;
  const { candles, news, ...rest } = d;
  return { ...rest, news: (news || []).slice(0, 5).map((n) => ({ title: n.title, source: n.source || n.publisher, time: n.time || n.date })) };
}

// התיק: בלי היסטוריה ארוכה
function slimData(d) {
  if (d.error) return d;
  const demo = d.demo ? { ...d.demo, trades: (d.demo.trades || []).slice(0, 10) } : d.demo;
  return { ...d, demo, signals: Array.isArray(d.signals) ? d.signals.slice(0, 15) : d.signals };
}

// הכלים של הבוט (team.js מחבר אותם). כל אחד מחזיר טקסט (JSON) לבוט
export const bursaTools = (env) => ({
  bursa_market: async () => out(await call(env, '/home')),
  bursa_stock: async ({ symbol }) => out(slimStock(await call(env, '/stock', { symbol, range: '1y' }))),
  bursa_search: async ({ q }) => out(await call(env, '/search', { q })),
  bursa_opinion: async ({ symbol }) => out(await call(env, '/opinion', { symbol })),
  bursa_portfolio: async () => out(slimData(await call(env, '/data'))),
  bursa_alerts: async () => {
    const r = await call(env, '/alerts');
    return out(r.error ? r : { alerts: (r.alerts || []).slice(0, 20) });
  },
  // פעולות – רק כשהבעלים ביקש במפורש (ההנחיות של הבוט)
  bursa_action: async (input) => {
    const a = input.action;
    const s = input.symbol;
    const routes = {
      watch_add: ['/watch', { symbol: s, plan: input.buy_list ? 'buy' : undefined, reason: input.note, target: input.price }],
      watch_remove: ['/watch', { symbol: s, remove: true }],
      demo_buy: ['/demo/trade', { symbol: s, side: 'buy', qty: input.qty }],
      demo_sell: ['/demo/trade', { symbol: s, side: 'sell', qty: input.qty }],
      holding_add: ['/holding', { holding: { symbol: s, qty: input.qty, price: input.price, date: input.date, stop: input.stop, target: input.target, note: input.note } }],
      holding_update: ['/holding', { holding: { id: input.id, symbol: s, qty: input.qty, price: input.price, date: input.date, stop: input.stop, target: input.target, note: input.note } }],
      holding_delete: ['/holding/delete', { id: input.id }],
      alert_add: ['/price-alert', { symbol: s, op: input.op, price: input.price }],
      alert_delete: ['/price-alert/delete', { id: input.id }],
    };
    const r = routes[a];
    if (!r) return `Unknown action. Use one of: ${Object.keys(routes).join(', ')}`;
    const res = await call(env, r[0], r[1]);
    if (res.error) return `Failed: ${res.error}`;
    return `Done (${a}). Current state: ${out(a.startsWith('demo') || a.startsWith('holding') ? slimData(res) : res)}`;
  },
});

export const BURSA_TOOLS = [
  { name: 'bursa_market', description: 'Live market overview from the בורסאי app: indices, market outlook, buy opportunities and stocks to be careful with.', input_schema: { type: 'object', properties: {} } },
  { name: 'bursa_stock', description: 'Full analysis of one stock from the בורסאי app: live quote, score -100..100 with reasons, indicators, forecast ranges, backtest, news.', input_schema: { type: 'object', properties: { symbol: { type: 'string', description: 'e.g. AAPL, TEVA, or TEVA.TA for Tel Aviv' } }, required: ['symbol'] } },
  { name: 'bursa_search', description: 'Find a stock symbol by name (Hebrew or English).', input_schema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] } },
  { name: 'bursa_opinion', description: "The app's AI opinion on a stock (uses the app's daily AI quota).", input_schema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } },
  { name: 'bursa_portfolio', description: "The owner's data in the app: watch list, real portfolio (records of what they bought), demo portfolio, price alerts, recent signals.", input_schema: { type: 'object', properties: {} } },
  { name: 'bursa_alerts', description: 'Recent alerts the app sent.', input_schema: { type: 'object', properties: {} } },
  {
    name: 'bursa_action',
    description: 'Change something in the בורסאי app – only what the owner explicitly asked for. No real money moves: "holding" records a purchase the owner made themselves; "demo" uses virtual money.',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['watch_add', 'watch_remove', 'demo_buy', 'demo_sell', 'holding_add', 'holding_update', 'holding_delete', 'alert_add', 'alert_delete'] },
        symbol: { type: 'string' },
        qty: { type: 'number' },
        price: { type: 'number', description: 'Purchase price (holding), alert price (alert_add), or target (watch_add)' },
        op: { type: 'string', enum: ['above', 'below'], description: 'alert_add: alert when the price goes above / below' },
        id: { type: 'string', description: 'Id of the holding / alert (from bursa_portfolio) for update or delete' },
        date: { type: 'string', description: 'YYYY-MM-DD purchase date (holding)' },
        stop: { type: 'number', description: 'Stop-loss price (holding)' },
        target: { type: 'number', description: 'Target price (holding)' },
        buy_list: { type: 'boolean', description: 'watch_add: put it on the "to buy" list' },
        note: { type: 'string' },
      },
      required: ['action'],
    },
  },
];
