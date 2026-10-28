// ה-AI של האפליקציה (Claude): צ'אט יועץ, תחזית שוק יומית מהחדשות, ודעה על מניה.
// הכלים של הצ'אט מחזירים נתונים אמיתיים מהשרת (מחיר, ניתוח, תחזית, התיק) – ה-AI לא ממציא מספרים.

export const MODEL = 'claude-opus-5-5';
const MAX_STEPS = 8;
const BETA = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
const WEB_SEARCH = (n) => ({ type: 'web_search_20260209', name: 'web_search', max_uses: n });

const DISCLAIMER_RULE = `You are not a licensed investment advisor and must never promise returns. Be honest that nobody \
can predict markets reliably: present forecasts as probabilities and ranges, mention the main risk, and remind about \
diversification when relevant. Do not refuse to give an opinion – give a clear, reasoned view, labelled as an opinion.`;

export const CHAT_SYSTEM = `You are "בורסאי", a friendly investing companion inside a Hebrew stock-market app, chatting \
WhatsApp-style with a beginner investor in Israel.

- Answer in natural, simple Israeli Hebrew (address the user in plural / gender-neutral forms), short like a chat message (usually 2-6 short lines; use a short list only \
when it helps). Explain jargon in a few words the first time you use it.
- Use the tools for any number (prices, changes, indicators, forecasts, the user's portfolio). Never invent prices. \
Use web_search for news and events from the last days/weeks, and say briefly where it came from.
- The app's analysis: score -100..100 from trend (SMA 50/200), momentum, RSI, MACD, Bollinger, volume; forecast = 80% \
range from past volatility; backtest = how these rules did on this stock historically.
- Ticker symbols are Yahoo Finance style (Tel Aviv stocks end with .TA, e.g. LUMI.TA). Find unknown ones with search_symbol.
- Practical context: the user is in Israel (capital gains tax 25%, prices of US stocks in USD).
- ${DISCLAIMER_RULE}`;

export const CHAT_TOOLS = [
  {
    name: 'get_stock',
    description: 'Live price and the app\'s full analysis of one stock/ETF/index: changes, indicators, score and reasons, forecast ranges, backtest.',
    input_schema: { type: 'object', properties: { symbol: { type: 'string', description: 'Yahoo symbol, e.g. AAPL, TEVA, LUMI.TA, ^GSPC' } }, required: ['symbol'], additionalProperties: false },
  },
  {
    name: 'search_symbol',
    description: 'Find ticker symbols by company name (English or Hebrew transliteration).',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false },
  },
  {
    name: 'get_portfolio',
    description: 'The user\'s real portfolio, demo (practice) portfolio, watchlist and price alerts, with live prices and profit/loss.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_market',
    description: 'Market overview: main indices (S&P 500, Nasdaq, TA-35, VIX, USD/ILS, oil, gold, bitcoin), the latest market outlook, and the app\'s current top buy/sell signals.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

const textOf = (content) => content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();

// שיחה: history = [{ role: 'user'|'assistant', text }]. runTool(name, input) -> אובייקט JSON
export async function chat(client, history, runTool) {
  const messages = history.map((m) => ({ role: m.role, content: m.text }));
  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      ...BETA,
      output_config: { effort: 'medium' },
      system: [{ type: 'text', text: CHAT_SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: [...CHAT_TOOLS, WEB_SEARCH(3)],
      messages,
    });
    if (response.stop_reason === 'refusal') return 'אני לא יכול לענות על זה. נסו לשאול אחרת 🙏';
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;
    const uses = response.content.filter((b) => b.type === 'tool_use');
    if (!uses.length) return textOf(response.content) || 'לא הצלחתי לענות. נסו שוב.';
    const results = await Promise.all(uses.map(async (u) => {
      try {
        return { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(await runTool(u.name, u.input || {})).slice(0, 30000) };
      } catch (e) {
        return { type: 'tool_result', tool_use_id: u.id, is_error: true, content: String(e?.message || e) };
      }
    }));
    messages.push({ role: 'user', content: results });
  }
  return 'זה לקח יותר מדי צעדים. נסו לשאול בצורה קצרה יותר.';
}

// ---------- תחזית השוק (פעם בכמה שעות) ----------
export const OUTLOOK_TOOL = {
  name: 'market_outlook',
  description: 'Publish the market outlook for the app\'s home screen.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      mood: { type: 'string', enum: ['bullish', 'neutral', 'bearish'] },
      score: { type: 'integer', description: '-100 (very negative) .. 100 (very positive) for the next weeks' },
      headline: { type: 'string', description: 'One short Hebrew headline' },
      summary: { type: 'string', description: '3-4 simple Hebrew sentences: what is happening now and what it may mean for the coming weeks' },
      drivers: { type: 'array', items: { type: 'string' }, description: 'Up to 5 short Hebrew bullets: the main things moving markets now (world events, rates, earnings...)' },
      risks: { type: 'array', items: { type: 'string' }, description: 'Up to 3 short Hebrew bullets: what could go wrong' },
      watch: { type: 'array', items: { type: 'string' }, description: 'Up to 3 short Hebrew bullets: upcoming events to watch (dates if known)' },
    },
    required: ['mood', 'score', 'headline', 'summary', 'drivers', 'risks', 'watch'],
    additionalProperties: false,
  },
};

const OUTLOOK_SYSTEM = `You are the market analyst of a Hebrew investing app. From the live market numbers and news \
headlines given (and web_search if something important needs checking), write a balanced outlook for a beginner \
investor in Israel: the US market and the Tel Aviv market. Plain Israeli Hebrew, no hype. ${DISCLAIMER_RULE} \
Finish by calling market_outlook.`;

const clean = (s, max = 600) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const list = (a, n) => (Array.isArray(a) ? a.map((x) => clean(x, 300)).filter(Boolean).slice(0, n) : []);

async function runStructured(client, { system, content, tool, search, effort }) {
  const messages = [{ role: 'user', content }];
  for (let step = 0; step < 5; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 6000,
      ...BETA,
      output_config: { effort },
      system,
      tools: search ? [WEB_SEARCH(search), tool] : [tool],
      messages,
    });
    if (response.stop_reason === 'refusal') throw new Error('המודל סירב');
    const submit = response.content.find((b) => b.type === 'tool_use' && b.name === tool.name);
    if (submit) return submit.input;
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;
    messages.push({ role: 'user', content: `Call ${tool.name} now.` });
  }
  throw new Error('לא התקבלה תשובה');
}

export async function marketOutlook(client, indices, news) {
  const lines = indices.map((q) => `${q.name} (${q.symbol}): ${q.price ?? '?'} (${q.change != null ? `${q.change.toFixed(2)}%` : '?'} today)`);
  const content = `Date: ${new Date().toISOString().slice(0, 10)}\n\nMarket now:\n${lines.join('\n')}\n\nLatest headlines:\n${news.slice(0, 30).map((n) => `- ${n.title} (${n.source})`).join('\n')}\n\nCall market_outlook.`;
  const r = await runStructured(client, { system: OUTLOOK_SYSTEM, content, tool: OUTLOOK_TOOL, search: 2, effort: 'low' });
  return {
    mood: ['bullish', 'neutral', 'bearish'].includes(r.mood) ? r.mood : 'neutral',
    score: Math.max(-100, Math.min(100, Math.round(Number(r.score) || 0))),
    headline: clean(r.headline, 160),
    summary: clean(r.summary, 1200),
    drivers: list(r.drivers, 5),
    risks: list(r.risks, 3),
    watch: list(r.watch, 3),
  };
}

// ---------- דעה על מניה (לפי בקשה, נשמרת לכמה שעות) ----------
export const OPINION_TOOL = {
  name: 'stock_opinion',
  description: 'Publish the opinion about the stock.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      verdict: { type: 'string', enum: ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'] },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      summary: { type: 'string', description: '3-4 simple Hebrew sentences: what the company does, what is happening now, and the bottom line' },
      bull: { type: 'array', items: { type: 'string' }, description: 'Up to 4 Hebrew bullets: reasons for' },
      bear: { type: 'array', items: { type: 'string' }, description: 'Up to 4 Hebrew bullets: reasons against / risks' },
      plan: { type: 'string', description: 'One or two Hebrew sentences of a practical plan for a beginner (e.g. buy gradually, wait for a pullback near X, stop-loss near Y)' },
    },
    required: ['verdict', 'confidence', 'summary', 'bull', 'bear', 'plan'],
    additionalProperties: false,
  },
};

const OPINION_SYSTEM = `You are the stock analyst of a Hebrew investing app. You get the app's technical analysis, \
statistical forecast, backtest and recent headlines for one stock. Check the latest news, earnings and valuation with \
web_search, then give a clear opinion for a beginner investor in Israel for the next 1-6 months. Plain Israeli \
Hebrew; keep company and product names in English. ${DISCLAIMER_RULE} Finish by calling stock_opinion.`;

export async function stockOpinion(client, symbol, quote, analysis, fc, bt, news) {
  const content = `Stock: ${symbol} – ${quote?.name || ''} (${quote?.exchange || ''}, ${quote?.currency || ''})
Date: ${new Date().toISOString().slice(0, 10)}
Analysis: ${JSON.stringify({ ...analysis, reasons: analysis?.reasons?.map((r) => r.text) })}
Forecast: ${JSON.stringify(fc)}
Backtest: ${JSON.stringify(bt ? { ...bt, lastTrades: undefined } : null)}
Headlines:\n${(news || []).slice(0, 10).map((n) => `- ${n.title} (${n.source})`).join('\n')}

Call stock_opinion.`;
  const r = await runStructured(client, { system: OPINION_SYSTEM, content, tool: OPINION_TOOL, search: 3, effort: 'medium' });
  return {
    verdict: ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'].includes(r.verdict) ? r.verdict : 'hold',
    confidence: ['low', 'medium', 'high'].includes(r.confidence) ? r.confidence : 'low',
    summary: clean(r.summary, 1200),
    bull: list(r.bull, 4),
    bear: list(r.bear, 4),
    plan: clean(r.plan, 400),
  };
}

// ---------- שגיאות מה-API של Anthropic בעברית ----------
export function aiMessage(e) {
  const status = Number(e?.status) || 0;
  if (!status) return e?.message || 'תקלה. נסו שוב.';
  const text = `${e?.message || ''} ${JSON.stringify(e?.error || {})}`.toLowerCase();
  if (/credit balance|billing|purchase credits/.test(text)) return 'נגמר הקרדיט בחשבון Anthropic.';
  if (status === 401 || status === 403) return 'מפתח ה-AI לא תקין.';
  if (status === 429 || status === 529 || status >= 500 || /overloaded|rate.?limit/.test(text)) return 'יש עומס כרגע. נסו שוב בעוד דקה.';
  return 'ה-AI לא הצליח לענות. נסו שוב.';
}
