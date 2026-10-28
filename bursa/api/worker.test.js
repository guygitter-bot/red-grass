import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Market } from './worker.js';
import { analyze, backtest, forecast, macd, rsi, sma, verdictOf } from './analysis.js';
import { cleanSymbol, marketsOpen, parseChart, parseRss } from './data.js';
import { slimCandles, valuePortfolio, MAX_CHAT_PER_DAY } from './market.js';

// זיכרון מדומה במקום האחסון של Durable Object
function fakeStorage() {
  const map = new Map();
  let alarm = null;
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    map,
    async get(k) { return clone(map.get(k)); },
    async put(k, v) { map.set(k, clone(v)); },
    async delete(k) { map.delete(k); },
    async getAlarm() { return alarm; },
    async setAlarm(t) { alarm = t; },
  };
}

// מחירים מדומים: מגמה + גל, כדי שיהיו אותות
function series(n, { start = 100, drift = 0.0008, wave = 0.04 } = {}) {
  const out = [];
  const t0 = Math.floor(Date.UTC(2021, 0, 4) / 1000);
  for (let i = 0; i < n; i++) {
    const c = start * Math.exp(drift * i) * (1 + wave * Math.sin(i / 9));
    out.push({ t: t0 + i * 86400, o: c, h: c * 1.01, l: c * 0.99, c, v: 1000 + (i % 7) * 100 });
  }
  return out;
}

function yahooChart(symbol, candles, extra = {}) {
  return {
    chart: {
      result: [{
        meta: { symbol, currency: symbol.endsWith('.TA') ? 'ILA' : 'USD', longName: `${symbol} Inc`, regularMarketPrice: candles.at(-1).c, chartPreviousClose: candles.at(-2).c, regularMarketTime: candles.at(-1).t, ...extra },
        timestamp: candles.map((c) => c.t),
        indicators: { quote: [{ open: candles.map((c) => c.o), high: candles.map((c) => c.h), low: candles.map((c) => c.l), close: candles.map((c) => c.c), volume: candles.map((c) => c.v) }] },
      }],
    },
  };
}

// רשת מדומה: Yahoo (גרף, חיפוש), Google News, שירות התראות
function fakeFetch(log = []) {
  return async (url) => {
    log.push(url);
    const u = new URL(url);
    if (u.hostname.endsWith('finance.yahoo.com') && u.pathname.startsWith('/v8/finance/chart/')) {
      const symbol = decodeURIComponent(u.pathname.split('/').pop());
      if (symbol === 'NOPE') return new Response('{"chart":{"result":null}}', { status: 404 });
      const range = u.searchParams.get('range');
      const candles = series(range === '1d' ? 78 : 1200, { start: symbol === 'DOWN' ? 300 : 100, drift: symbol === 'DOWN' ? -0.002 : 0.0008 });
      return Response.json(yahooChart(symbol, candles));
    }
    if (u.pathname.startsWith('/v1/finance/search')) {
      return Response.json({ quotes: [{ symbol: 'TEVA', shortname: 'Teva', quoteType: 'EQUITY', exchDisp: 'NYSE' }], news: [{ title: 'Teva news', publisher: 'Reuters', link: 'https://example.com/a', providerPublishTime: 1 }] });
    }
    if (u.hostname === 'news.google.com') {
      return new Response('<rss><channel><item><title>Fed holds rates - Reuters</title><link>https://example.com/n</link><pubDate>Tue, 27 Oct 2026 10:00:00 GMT</pubDate><source url="x">Reuters</source></item></channel></rss>');
    }
    return new Response('', { status: 201 });
  };
}

// AI מדומה: בצ'אט קורא לכלי get_stock ואז עונה; בתחזית/דעה – מחזיר את הכלי המבוקש
function fakeAI(calls = []) {
  return {
    beta: {
      messages: {
        async create(req) {
          calls.push(req);
          const toolNames = req.tools.map((t) => t.name);
          if (toolNames.includes('market_outlook')) {
            return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'o', name: 'market_outlook', input: { mood: 'bullish', score: 30, headline: 'השוק חיובי', summary: 'סיכום', drivers: ['ריבית'], risks: ['אינפלציה'], watch: ['דוחות'] } }] };
          }
          if (toolNames.includes('stock_opinion')) {
            return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'p', name: 'stock_opinion', input: { verdict: 'buy', confidence: 'medium', summary: 'חברה טובה', bull: ['צמיחה'], bear: ['מחיר גבוה'], plan: 'לקנות בהדרגה' } }] };
          }
          const last = req.messages.at(-1);
          if (Array.isArray(last.content) && last.content[0]?.type === 'tool_result') {
            return { stop_reason: 'end_turn', content: [{ type: 'text', text: `תשובה עם נתונים: ${last.content[0].content.slice(0, 20)}` }] };
          }
          return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'get_stock', input: { symbol: 'AAPL' } }] };
        },
      },
    },
  };
}

function fakeEnv(extra = {}) {
  const env = { ALLOWED_ORIGINS: 'https://bursa-app.pages.dev', AI_CLIENT: fakeAI(extra.calls), FETCH: fakeFetch(extra.log), PUSH_FETCH: async () => new Response('', { status: 201 }), ...extra };
  env.market = new Market({ storage: fakeStorage() }, env);
  env.MARKET = { idFromName: (n) => n, get: () => ({ fetch: (req) => env.market.fetch(req) }) };
  return env;
}

async function call(env, path, body = {}, token) {
  const res = await worker.fetch(new Request(`https://api.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://bursa-app.pages.dev', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }), env);
  return { status: res.status, data: await res.json(), headers: res.headers };
}

async function loggedIn(extra) {
  const env = fakeEnv(extra);
  const { data } = await call(env, '/setup', { password: 'secret123' });
  return { env, token: data.token };
}

// ---------- ניתוח ----------
test('indicators: SMA, RSI and MACD basics', () => {
  assert.deepEqual(sma([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]);
  const up = Array.from({ length: 40 }, (_, i) => 100 + i);
  assert.equal(rsi(up).at(-1), 100);
  const m = macd(up);
  assert.ok(m.line.at(-1) > 0);
  assert.ok(m.signal.at(-1) != null);
});

test('verdict thresholds', () => {
  assert.equal(verdictOf(50), 'strong_buy');
  assert.equal(verdictOf(20), 'buy');
  assert.equal(verdictOf(0), 'hold');
  assert.equal(verdictOf(-20), 'sell');
  assert.equal(verdictOf(-60), 'strong_sell');
});

test('analyze: an uptrend scores positive, a downtrend negative', () => {
  const up = analyze(series(400));
  const down = analyze(series(400, { start: 300, drift: -0.002 }));
  assert.ok(up.score > 0, `up ${up.score}`);
  assert.ok(down.score < 0, `down ${down.score}`);
  assert.ok(up.reasons.length > 0);
  assert.ok(up.sma200 > 0 && up.rsi > 0);
  assert.equal(analyze(series(10)), null);
});

test('forecast: range around the price, wider for longer horizons', () => {
  const candles = series(600);
  const f = forecast(candles, 20);
  const last = candles.at(-1).c;
  const [w1, , , y1] = f.horizons;
  assert.ok(w1.low < last && w1.high > last);
  assert.ok(y1.high - y1.low > w1.high - w1.low);
  assert.ok(f.horizons.every((h) => h.probUp >= 0 && h.probUp <= 100));
  assert.ok(w1.histUp != null);
});

test('backtest compares the strategy to buy & hold', () => {
  const b = backtest(series(1000));
  assert.ok(b.years > 2);
  assert.equal(typeof b.strategy, 'number');
  assert.equal(typeof b.buyHold, 'number');
  assert.ok(b.trades >= 1);
  assert.equal(backtest(series(100)), null);
});

// ---------- נתונים ----------
test('Tel Aviv prices come in agorot and are converted to shekels', () => {
  const r = parseChart(yahooChart('LUMI.TA', series(5, { start: 4000 })).chart.result[0]);
  assert.equal(r.quote.currency, 'ILS');
  assert.ok(Math.abs(r.quote.price - r.candles.at(-1).c) < 1e-9);
  assert.ok(r.quote.price < 100);
});

test('RSS parsing and symbol cleaning', () => {
  const items = parseRss('<item><title><![CDATA[Stocks rally &amp; more - CNBC]]></title><link>https://x.com/a</link><source>CNBC</source></item><item><title>bad</title><link>javascript:1</link></item>');
  assert.deepEqual(items.map((i) => [i.title, i.source]), [['Stocks rally & more', 'CNBC']]);
  assert.equal(cleanSymbol(' lumi.ta '), 'LUMI.TA');
  assert.equal(cleanSymbol('^GSPC'), '^GSPC');
  assert.equal(cleanSymbol('a b'), null);
  assert.equal(cleanSymbol('../x'), null);
});

test('market hours: New York and Tel Aviv', () => {
  assert.deepEqual(marketsOpen(new Date('2026-10-27T15:40:00Z')), { us: true, ta: false });
  assert.deepEqual(marketsOpen(new Date('2026-10-27T09:00:00Z')), { us: false, ta: true });
  assert.deepEqual(marketsOpen(new Date('2026-10-25T15:00:00Z')), { us: false, ta: false });
});

test('portfolio value in shekels with profit and loss', () => {
  const p = valuePortfolio(
    [{ symbol: 'AAPL', qty: 10, price: 100, currency: 'USD' }, { symbol: 'LUMI.TA', qty: 100, price: 40, currency: 'ILS' }],
    { AAPL: { price: 110, change: 10 }, 'LUMI.TA': { price: 38, change: 0 } },
    { USD: 3.5, ILS: 1 },
  );
  assert.equal(p.valueILS, 1100 * 3.5 + 3800);
  assert.equal(p.costILS, 1000 * 3.5 + 4000);
  assert.equal(p.rows[0].gainPct, 10);
  assert.equal(p.rows[1].gain, -200);
});

test('chart for display is trimmed to the range', () => {
  const c = series(1200);
  assert.equal(slimCandles(c, '1m').length, 23);
  assert.ok(slimCandles(c, '5y').length <= 260);
  assert.equal(slimCandles(c, '5y').at(-1).t, c.at(-1).t);
});

// ---------- שרת ----------
test('password: first setup, then login only with the right password', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, '/status')).data.hasPassword, false);
  assert.equal((await call(env, '/home')).status, 401);
  assert.equal((await call(env, '/setup', { password: '123' })).status, 400);
  const { data } = await call(env, '/setup', { password: 'secret123' });
  assert.ok(data.token);
  assert.equal((await call(env, '/setup', { password: 'other123' })).status, 409);
  assert.equal((await call(env, '/login', { password: 'wrong' })).status, 401);
  const ok = await call(env, '/login', { password: 'secret123' });
  assert.equal(ok.status, 200);
  assert.equal((await call(env, '/home', {}, ok.data.token)).status, 200);
  await call(env, '/logout', {}, ok.data.token);
  assert.equal((await call(env, '/home', {}, ok.data.token)).status, 401);
  assert.equal((await call(env, '/home', {}, 'made-up')).status, 401);
});

test('CORS only for the app', async () => {
  const env = fakeEnv();
  const res = await call(env, '/status');
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://bursa-app.pages.dev');
});

test('stock page: analysis, forecast, backtest and news', async () => {
  const { env, token } = await loggedIn();
  const { status, data } = await call(env, '/stock', { symbol: 'aapl', range: '3m' }, token);
  assert.equal(status, 200);
  assert.equal(data.symbol, 'AAPL');
  assert.equal(data.candles.length, 66);
  assert.ok(data.analysis.score > 0);
  assert.ok(data.verdictName);
  assert.equal(data.forecast.horizons.length, 4);
  assert.ok(data.backtest.years > 1);
  assert.equal(data.news[0].title, 'Teva news');
  assert.equal((await call(env, '/stock', { symbol: 'NOPE' }, token)).status, 404);
});

test('watchlist, holdings and price alerts', async () => {
  const { env, token } = await loggedIn();
  await call(env, '/watch', { symbol: 'TEVA' }, token);
  await call(env, '/watch', { symbol: 'AAPL' }, token);
  let d = (await call(env, '/data', {}, token)).data;
  assert.deepEqual(d.watch.map((w) => w.symbol), ['AAPL', 'TEVA']);
  await call(env, '/watch', { symbol: 'TEVA', remove: true }, token);
  assert.equal((await call(env, '/holding', { holding: { symbol: 'AAPL', qty: 0, price: 1 } }, token)).status, 400);
  const h = await call(env, '/holding', { holding: { symbol: 'AAPL', qty: 5, price: 150, stop: 120 } }, token);
  assert.equal(h.data.holdings[0].currency, 'USD');
  const id = h.data.holdings[0].id;
  await call(env, '/holding', { holding: { id, symbol: 'AAPL', qty: 7, price: 150 } }, token);
  d = (await call(env, '/data', {}, token)).data;
  assert.equal(d.holdings.length, 1);
  assert.equal(d.holdings[0].qty, 7);
  assert.equal(d.watch.length, 1);
  await call(env, '/price-alert', { symbol: 'AAPL', op: 'above', price: 1 }, token);
  assert.equal((await call(env, '/data', {}, token)).data.palerts.length, 1);
  await call(env, '/holding/delete', { id }, token);
  assert.equal((await call(env, '/data', {}, token)).data.holdings.length, 0);
});

test('demo portfolio: buy and sell at the live price in shekels', async () => {
  const { env, token } = await loggedIn();
  const buy = await call(env, '/demo/trade', { symbol: 'LUMI.TA', side: 'buy', qty: 10 }, token);
  assert.equal(buy.status, 200);
  assert.equal(buy.data.demo.holdings[0].qty, 10);
  assert.ok(buy.data.demo.cash < 100000);
  assert.equal((await call(env, '/demo/trade', { symbol: 'LUMI.TA', side: 'sell', qty: 11 }, token)).status, 400);
  assert.equal((await call(env, '/demo/trade', { symbol: 'LUMI.TA', side: 'buy', qty: 1e9 }, token)).status, 400);
  const sell = await call(env, '/demo/trade', { symbol: 'LUMI.TA', side: 'sell', qty: 10 }, token);
  assert.equal(sell.data.demo.holdings.length, 0);
  assert.ok(Math.abs(sell.data.demo.cash - 100000) < 0.05);
  const reset = await call(env, '/demo/reset', {}, token);
  assert.equal(reset.data.demo.trades.length, 0);
});

test('chat: the AI uses the tools and the conversation is saved', async () => {
  const calls = [];
  const { env, token } = await loggedIn({ calls });
  const { status, data } = await call(env, '/chat', { text: 'מה דעתך על אפל?' }, token);
  assert.equal(status, 200);
  assert.equal(data.messages.length, 2);
  assert.match(data.messages[1].text, /תשובה עם נתונים/);
  assert.equal(calls[0].model, 'claude-opus-5-5');
  assert.ok(calls[0].tools.some((t) => t.type === 'web_search_20260209'));
  assert.equal((await call(env, '/chat/history', {}, token)).data.messages.length, 2);
  await call(env, '/chat/clear', {}, token);
  assert.equal((await call(env, '/chat/history', {}, token)).data.messages.length, 0);
  assert.equal((await call(env, '/chat', { text: '  ' }, token)).status, 400);
});

test('chat has a daily limit', async () => {
  const { env, token } = await loggedIn();
  await env.market.storage.put('day', { date: new Date().toISOString().slice(0, 10), chat: MAX_CHAT_PER_DAY, opinion: 0 });
  assert.equal((await call(env, '/chat', { text: 'שלום' }, token)).status, 429);
});

test('AI opinion on a stock is saved and reused', async () => {
  const calls = [];
  const { env, token } = await loggedIn({ calls });
  const a = await call(env, '/opinion', { symbol: 'TEVA' }, token);
  assert.equal(a.status, 200);
  assert.equal(a.data.opinion.verdictName, 'קנייה');
  const n = calls.length;
  await call(env, '/opinion', { symbol: 'TEVA' }, token);
  assert.equal(calls.length, n);
  assert.ok((await call(env, '/stock', { symbol: 'TEVA' }, token)).data.opinion);
});

test('background scan: signals, alerts and push', async () => {
  const pushes = [];
  const { env, token } = await loggedIn({ PUSH_FETCH: async (url) => { pushes.push(url); return new Response('', { status: 201 }); } });
  // מכשיר שנרשם להתראות (מפתחות בגודל הנכון)
  const key = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key.publicKey));
  const b64 = (u) => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: b64(raw), auth: b64(new Uint8Array(16).fill(1)) } };
  assert.equal((await call(env, '/push/subscribe', { sub }, token)).status, 200);
  assert.equal((await call(env, '/push/subscribe', { sub: { ...sub, endpoint: 'https://evil.example.com/x' } }, token)).status, 400);

  // מניה בתיק עם סטופ-לוס מעל המחיר, והתראת מחיר
  await call(env, '/holding', { holding: { symbol: 'DOWN', qty: 1, price: 300, stop: 10000 } }, token);
  await call(env, '/price-alert', { symbol: 'DOWN', op: 'below', price: 10000 }, token);
  await env.market.alarm();
  const { data } = await call(env, '/alerts', {}, token);
  const kinds = data.alerts.map((a) => a.kind);
  assert.ok(kinds.some((k) => k.startsWith('stop:')), kinds.join());
  assert.ok(kinds.some((k) => k.startsWith('price:')), kinds.join());
  assert.ok(pushes.length >= 2);
  assert.equal((await call(env, '/data', {}, token)).data.palerts.length, 0);
  // שוב – לא שולח את אותה התראה פעמיים
  const before = data.alerts.length;
  await env.market.alarm();
  assert.equal((await call(env, '/alerts', {}, token)).data.alerts.length, before);
  // הסריקה שמרה אותות, ותחזית השוק נוצרה
  const home = (await call(env, '/home', {}, token)).data;
  assert.ok(home.scanned >= 6);
  assert.equal(home.outlook.mood, 'bullish');
  assert.equal(home.indices.length, 11);
  assert.ok(home.unread > 0);
  await call(env, '/alerts/read', {}, token);
  assert.equal((await call(env, '/home', {}, token)).data.unread, 0);
});

test('search finds Hebrew names locally and symbols from Yahoo', async () => {
  const { env, token } = await loggedIn();
  const { data } = await call(env, '/search', { q: 'לאומי' }, token);
  assert.equal(data.results[0].symbol, 'LUMI.TA');
  const r = await call(env, '/search', { q: 'teva' }, token);
  assert.ok(r.data.results.some((x) => x.symbol === 'TEVA'));
});
