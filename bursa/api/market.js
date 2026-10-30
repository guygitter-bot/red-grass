// "השוק" – Durable Object אחד ("main") שבו כל הנתונים של בעלת האפליקציה, והמנוע שרץ ברקע כל הזמן.
//
// אחסון (key-value של Durable Object):
//   auth        -> { salt, iter, hash }  הסיסמה (PBKDF2; הסיסמה עצמה לא נשמרת)
//   sessions    -> { <token>: תוקף }      מכשירים מחוברים
//   watch       -> [{ symbol, name, added, plan?, reason?, target? }]  רשימת מעקב; plan: 'buy' = ברשימת הקניות
//   holdings    -> [{ id, symbol, name, qty, price, currency, date, stop?, target?, note? }]  התיק האמיתי
//   demo        -> { cash, start, holdings: [...], trades: [...] }   תיק דמה (כסף וירטואלי בשקלים)
//   palerts     -> [{ id, symbol, op: 'above'|'below', price, created }]  התראות מחיר
//   alerts      -> [{ id, t, symbol, kind, title, body, read }]      יומן ההתראות (200 אחרונות)
//   sent        -> { <symbol:kind>: זמן }   מתי נשלחה התראה מכל סוג (כדי לא להציף)
//   signals     -> { <symbol>: { name, price, currency, change, score, verdict, reasons, t } }  תוצאות הסריקה
//   outlook     -> { mood, score, headline, summary, drivers, risks, watch, t }  תחזית השוק מה-AI
//   opinion:<s> -> { ..., t }   דעת ה-AI על מניה (6 שעות)
//   chat        -> [{ role, text, t, proposals? }]   הצ'אט (200 הודעות אחרונות). proposals = מניות שהבוט הציע לרשימת הקניות:
//                  [{ id, symbol, name, reason, target, status: 'pending'|'added'|'declined' }]
//   subs        -> [{ id, sub }]          מכשירים שנרשמו להתראות
//   vapid       -> מפתחות ההתראות של השרת
//   settings    -> { buy, sell, moves, market, movePct }
//   ch:<symbol> -> { t, quote, candles }   גרף יומי שמור (כדי לא להוריד שוב כל פעם)
//   day         -> { date, chat, opinion }  שימוש ב-AI היום (מגבלה)
//
// המנוע (alarm): כל 2 דקות כשבורסה פתוחה (אחרת כל 20 דקות) סורק עוד כמה מניות – קודם שלך (תיק, מעקב, התראות),
// ואז רשימת הסריקה (universe.js) – ושולח התראות לטלפון. כל כמה שעות מעדכן את תחזית השוק מהחדשות.
import Anthropic from '@anthropic-ai/sdk';
import { analyze, backtest, forecast, VERDICTS } from './analysis.js';
import { aiMessage, chat, marketOutlook, stockOpinion } from './ai.js';
import { cleanSymbol, fetchChart, fetchQuote, marketsOpen, search, worldNews } from './data.js';
import { createVapidKeys, sendPush, validSubscription } from './push.js';
import { INDICES, NAMES, UNIVERSE } from './universe.js';

const PBKDF2_ITER = 100000;
const SESSION_MS = 365 * 24 * 3600 * 1000;
const QUOTE_TTL = 60 * 1000;
const CHART_TTL = 10 * 60 * 1000;
const PER_ALARM = 6;
const OUTLOOK_MS = 3 * 3600 * 1000;
const OPINION_MS = 6 * 3600 * 1000;
const THROTTLE_MS = 12 * 3600 * 1000;
export const MAX_CHAT_PER_DAY = 150;
export const MAX_OPINION_PER_DAY = 30;
const DEMO_START = 100000;
const RANGES = {
  '1m': { days: 23 },
  '3m': { days: 66 },
  '6m': { days: 130 },
  '1y': { days: 255 },
  '5y': { days: 1300 },
};
export const DEFAULT_SETTINGS = { buy: true, sell: true, moves: true, market: true, movePct: 5 };

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);
const text = (s, max) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const num = (x) => (Number.isFinite(Number(x)) && x !== '' && x !== null ? Number(x) : null);
const today = () => new Date().toISOString().slice(0, 10);
const r2 = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);

async function pbkdf2(password, salt, iter = PBKDF2_ITER) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: iter }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// הגרף לתצוגה: רק הטווח שנבחר, ולכל היותר ~260 נקודות (5 שנים – נר שבועי בערך)
export function slimCandles(candles, range) {
  const days = RANGES[range]?.days || 255;
  const part = candles.slice(-days);
  const step = Math.max(1, Math.ceil(part.length / 260));
  const out = [];
  for (let i = part.length - 1; i >= 0; i -= step) out.push(part[i]);
  return out.reverse().map((c) => ({ t: c.t, c: r2(c.c, 4), v: c.v }));
}

// שווי תיק: holdings + מחירים + שערי מטבע -> שורות ושווי כולל בשקלים
export function valuePortfolio(holdings, quotes, fx) {
  let value = 0;
  let cost = 0;
  let day = 0;
  const rows = holdings.map((h) => {
    const q = quotes[h.symbol];
    const rate = fx[h.currency || q?.currency || 'USD'] ?? null;
    const price = q?.price ?? null;
    const v = price != null ? price * h.qty : null;
    const c = h.price * h.qty;
    if (v != null && rate != null) {
      value += v * rate;
      cost += c * rate;
      if (q?.change != null) day += (v - v / (1 + q.change / 100)) * rate;
    }
    return {
      ...h,
      now: price,
      change: q?.change ?? null,
      value: r2(v),
      gain: v != null ? r2(v - c) : null,
      gainPct: v != null && c ? r2((v / c - 1) * 100) : null,
      valueILS: v != null && rate != null ? r2(v * rate) : null,
    };
  });
  return { rows, valueILS: r2(value), costILS: r2(cost), gainILS: r2(value - cost), gainPct: cost ? r2((value / cost - 1) * 100) : null, dayILS: r2(day) };
}

export class Market {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
    this.fetchFn = env.FETCH || ((...a) => fetch(...a));
    this.pushFetch = env.PUSH_FETCH || ((...a) => fetch(...a));
    this.mem = new Map();
  }

  client() {
    return this.env.AI_CLIENT || new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY });
  }

  async fetch(request) {
    const { pathname } = new URL(request.url);
    let body;
    try {
      body = JSON.parse((await request.text()) || '{}');
    } catch {
      return json(400, { error: 'בקשה לא תקינה' });
    }
    try {
      await this.ensureAlarm();
      // בלי סיסמה: רק בדיקה / קביעה ראשונה / כניסה
      if (pathname === '/status') return json(200, { hasPassword: !!(await this.storage.get('auth')) });
      if (pathname === '/setup') return await this.setup(body);
      if (pathname === '/login') return await this.login(body);
      const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
      if (!(await this.validToken(token))) return json(401, { error: 'צריך להתחבר מחדש' });
      return await this.route(pathname, body, token);
    } catch (e) {
      if (!e?.notFound) console.log('error', pathname, e?.stack || e);
      return json(e?.notFound ? 404 : 500, { error: e?.notFound ? 'המניה לא נמצאה' : e?.message || 'תקלה בשרת' });
    }
  }

  async route(path, b, token) {
    switch (path) {
      case '/logout': {
        const sessions = (await this.storage.get('sessions')) || {};
        delete sessions[token];
        await this.storage.put('sessions', sessions);
        return json(200, { ok: true });
      }
      case '/home': return json(200, await this.home());
      case '/quotes': return json(200, { quotes: await this.quotes((b.symbols || []).slice(0, 40)) });
      case '/stock': return json(200, await this.stock(b.symbol, b.range));
      case '/opinion': return await this.opinion(b.symbol, !!b.refresh);
      case '/search': return json(200, await this.search(b.q));
      case '/data': return json(200, await this.data());
      case '/watch': return json(200, await this.watch(b.symbol, !!b.remove, b.plan));
      case '/chat/approve': return await this.approve(b.id, b.approve !== false);
      case '/holding': return await this.saveHolding(b.holding || {});
      case '/holding/delete': return json(200, await this.deleteHolding(b.id));
      case '/demo/trade': return await this.demoTrade(b);
      case '/demo/reset': {
        await this.storage.put('demo', { cash: DEMO_START, start: Date.now(), holdings: [], trades: [] });
        return json(200, await this.data());
      }
      case '/price-alert': return await this.addPriceAlert(b);
      case '/price-alert/delete': {
        const list = ((await this.storage.get('palerts')) || []).filter((a) => a.id !== b.id);
        await this.storage.put('palerts', list);
        return json(200, { palerts: list });
      }
      case '/alerts': return json(200, { alerts: (await this.storage.get('alerts')) || [] });
      case '/alerts/read': {
        const alerts = ((await this.storage.get('alerts')) || []).map((a) => ({ ...a, read: true }));
        await this.storage.put('alerts', alerts);
        return json(200, { alerts });
      }
      case '/settings': {
        const settings = { ...DEFAULT_SETTINGS, ...((await this.storage.get('settings')) || {}) };
        for (const k of ['buy', 'sell', 'moves', 'market']) if (typeof b[k] === 'boolean') settings[k] = b[k];
        if (num(b.movePct) != null) settings.movePct = Math.min(20, Math.max(2, num(b.movePct)));
        await this.storage.put('settings', settings);
        return json(200, { settings });
      }
      case '/chat': return await this.chat(b.text);
      case '/chat/history': return json(200, { messages: (await this.storage.get('chat')) || [] });
      case '/chat/clear': {
        await this.storage.put('chat', []);
        return json(200, { messages: [] });
      }
      case '/push/key': return json(200, { publicKey: (await this.vapid()).publicKey });
      case '/push/subscribe': {
        if (!validSubscription(b.sub)) return json(400, { error: 'ההרשמה להתראות לא תקינה' });
        const subs = ((await this.storage.get('subs')) || []).filter((s) => s.sub.endpoint !== b.sub.endpoint);
        subs.push({ id: newId(), sub: { endpoint: b.sub.endpoint, keys: { p256dh: b.sub.keys.p256dh, auth: b.sub.keys.auth } } });
        await this.storage.put('subs', subs.slice(-10));
        return json(200, { ok: true });
      }
      case '/push/unsubscribe': {
        const subs = ((await this.storage.get('subs')) || []).filter((s) => s.sub.endpoint !== b.endpoint);
        await this.storage.put('subs', subs);
        return json(200, { ok: true });
      }
      case '/push/test': {
        const sent = await this.push({ title: '🔔 ההתראות עובדות!', body: 'מעכשיו תקבלו כאן אותות קנייה ומכירה.', url: '#/alerts' });
        return json(200, { sent });
      }
      default: return json(404, { error: 'לא נמצא' });
    }
  }

  // ---------- כניסה ----------
  async setup({ password }) {
    if (await this.storage.get('auth')) return json(409, { error: 'כבר נקבעה סיסמה' });
    const pw = String(password || '');
    if (pw.length < 6 || pw.length > 200) return json(400, { error: 'סיסמה של 6 תווים לפחות' });
    const salt = newId();
    await this.storage.put('auth', { salt, iter: PBKDF2_ITER, hash: await pbkdf2(pw, salt) });
    return json(200, { token: await this.newSession() });
  }

  async login({ password }) {
    const auth = await this.storage.get('auth');
    if (!auth) return json(409, { error: 'עוד לא נקבעה סיסמה' });
    // האטה קטנה נגד ניחוש סיסמאות
    const fails = this.mem.get('fails') || { n: 0, t: 0 };
    if (fails.n >= 5 && Date.now() - fails.t < 60000) return json(429, { error: 'יותר מדי ניסיונות. נסו שוב בעוד דקה.' });
    if (!safeEqual(await pbkdf2(String(password || ''), auth.salt, auth.iter), auth.hash)) {
      this.mem.set('fails', { n: fails.n + 1, t: Date.now() });
      return json(401, { error: 'סיסמה שגויה' });
    }
    this.mem.delete('fails');
    return json(200, { token: await this.newSession() });
  }

  async newSession() {
    const token = `${newId()}${newId()}`;
    const sessions = (await this.storage.get('sessions')) || {};
    const now = Date.now();
    for (const [k, exp] of Object.entries(sessions)) if (exp < now) delete sessions[k];
    sessions[token] = now + SESSION_MS;
    await this.storage.put('sessions', sessions);
    return token;
  }

  async validToken(token) {
    if (!token) return false;
    const sessions = (await this.storage.get('sessions')) || {};
    return Object.hasOwn(sessions, token) && sessions[token] > Date.now();
  }

  // ---------- נתוני שוק (עם זיכרון קצר) ----------
  async cached(key, ttl, load) {
    const hit = this.mem.get(key);
    if (hit && Date.now() - hit.t < ttl) return hit.v;
    const v = await load();
    this.mem.set(key, { t: Date.now(), v });
    if (this.mem.size > 400) this.mem.delete(this.mem.keys().next().value);
    return v;
  }

  quote(symbol) {
    return this.cached(`q:${symbol}`, QUOTE_TTL, () => fetchQuote(this.fetchFn, symbol));
  }

  async quotes(symbols) {
    const list = [...new Set(symbols.map(cleanSymbol).filter(Boolean))];
    const out = {};
    await Promise.all(list.map(async (s) => {
      try {
        const q = await this.quote(s);
        out[s] = { symbol: s, name: NAMES[s] || q.name, price: r2(q.price, 4), change: r2(q.change), currency: q.currency, spark: q.spark, time: q.time };
      } catch {
        out[s] = null;
      }
    }));
    return out;
  }

  // גרף יומי ל-5 שנים (נשמר באחסון 10 דקות; הנר של היום מתעדכן מהמחיר החי)
  async daily(symbol) {
    const key = `ch:${symbol}`;
    let ch = this.mem.get(key)?.v || (await this.storage.get(key));
    if (!ch || Date.now() - ch.t > CHART_TTL) {
      const { quote, candles } = await fetchChart(this.fetchFn, symbol, '5y', '1d');
      ch = { t: Date.now(), quote, candles: candles.map((c) => ({ t: c.t, o: r2(c.o, 4), h: r2(c.h, 4), l: r2(c.l, 4), c: r2(c.c, 4), v: c.v })) };
      await this.storage.put(key, ch);
    }
    this.mem.set(key, { t: ch.t, v: ch });
    return ch;
  }

  async fxRates(currencies) {
    const fx = { ILS: 1 };
    await Promise.all([...new Set(currencies)].filter((c) => c && c !== 'ILS').map(async (c) => {
      try {
        fx[c] = (await this.quote(c === 'USD' ? 'ILS=X' : `${c}ILS=X`)).price;
      } catch {
        fx[c] = null;
      }
    }));
    return fx;
  }

  // ---------- מסכים ----------
  async home() {
    const quotes = await this.quotes(INDICES.map((i) => i.symbol));
    const indices = INDICES.map((i) => ({ ...i, ...(quotes[i.symbol] || {}), name: i.name }));
    const signals = (await this.storage.get('signals')) || {};
    const list = Object.entries(signals).map(([symbol, s]) => ({ symbol, ...s, reasons: s.reasons?.slice(0, 2) }));
    const alerts = (await this.storage.get('alerts')) || [];
    return {
      indices,
      open: marketsOpen(),
      outlook: (await this.storage.get('outlook')) || null,
      buys: list.filter((s) => s.score >= 15).sort((a, b) => b.score - a.score).slice(0, 8),
      sells: list.filter((s) => s.score <= -15).sort((a, b) => a.score - b.score).slice(0, 5),
      scanned: list.length,
      unread: alerts.filter((a) => !a.read).length,
    };
  }

  async stock(symbolIn, range = '1y', { withNews = true } = {}) {
    const symbol = cleanSymbol(symbolIn);
    if (!symbol) return { error: 'סמל לא תקין' };
    const [ch, live, news] = await Promise.all([
      this.daily(symbol),
      this.quote(symbol).catch(() => null),
      !withNews ? [] : this.cached(`n:${symbol}`, 15 * 60 * 1000, () => search(this.fetchFn, symbol, { quotes: 0, news: 8 }).then((r) => r.news).catch(() => [])),
    ]);
    const candles = [...ch.candles];
    // הנר האחרון לפי המחיר החי (כדי שהניתוח יהיה "מעכשיו")
    if (live?.price != null && candles.length) {
      const last = candles[candles.length - 1];
      const sameDay = live.time && new Date(live.time * 1000).toISOString().slice(0, 10) === new Date(last.t * 1000).toISOString().slice(0, 10);
      if (sameDay) candles[candles.length - 1] = { ...last, c: live.price };
      else if (live.time && live.time > last.t) candles.push({ t: live.time, o: live.price, h: live.price, l: live.price, c: live.price, v: live.volume || 0 });
    }
    const analysis = analyze(candles);
    const quote = { ...ch.quote, ...(live || {}), name: NAMES[symbol] || live?.name || ch.quote.name, spark: undefined };
    if (analysis && (await this.isPersonal(symbol))) await this.saveSignal(symbol, quote, analysis);
    const stored = await this.storage.get(`opinion:${symbol}`);
    return {
      symbol,
      quote,
      range: RANGES[range] ? range : '1y',
      candles: slimCandles(candles, RANGES[range] ? range : '1y'),
      analysis,
      verdictName: analysis ? VERDICTS[analysis.verdict] : null,
      forecast: forecast(candles, analysis?.score || 0),
      backtest: backtest(candles),
      news,
      opinion: stored && Date.now() - stored.t < OPINION_MS * 4 ? stored : null,
    };
  }

  async opinion(symbolIn, refresh) {
    const symbol = cleanSymbol(symbolIn);
    if (!symbol) return json(400, { error: 'סמל לא תקין' });
    const stored = await this.storage.get(`opinion:${symbol}`);
    if (stored && !refresh && Date.now() - stored.t < OPINION_MS) return json(200, { opinion: stored });
    if (!(await this.useQuota('opinion', MAX_OPINION_PER_DAY))) return json(429, { error: 'הגעתם למכסת הניתוחים להיום' });
    const s = await this.stock(symbol);
    try {
      const op = await stockOpinion(this.client(), symbol, s.quote, s.analysis, s.forecast, s.backtest, s.news);
      const saved = { ...op, verdictName: VERDICTS[op.verdict], t: Date.now() };
      await this.storage.put(`opinion:${symbol}`, saved);
      return json(200, { opinion: saved });
    } catch (e) {
      return json(502, { error: aiMessage(e) });
    }
  }

  async search(q) {
    const query = text(q, 60);
    if (!query) return { results: [] };
    const direct = cleanSymbol(query);
    const local = [...UNIVERSE, ...INDICES].filter((x) => x.name.includes(query) || x.symbol === direct).map((x) => ({ symbol: x.symbol, name: x.name, exchange: '', type: '' }));
    let remote = [];
    try {
      remote = (await this.cached(`s:${query.toLowerCase()}`, 3600 * 1000, () => search(this.fetchFn, query))).results;
    } catch {
      // בלי חיבור – רק מהרשימה המקומית
    }
    const seen = new Set();
    return { results: [...local, ...remote].filter((r) => !seen.has(r.symbol) && seen.add(r.symbol)).slice(0, 12) };
  }

  async data() {
    const [watch, holdings, demo, palerts, settings] = await Promise.all(['watch', 'holdings', 'demo', 'palerts', 'settings'].map((k) => this.storage.get(k)));
    return {
      watch: watch || [],
      holdings: holdings || [],
      demo: demo || { cash: DEMO_START, start: null, holdings: [], trades: [] },
      palerts: palerts || [],
      settings: { ...DEFAULT_SETTINGS, ...(settings || {}) },
      signals: await this.personalSignals(),
    };
  }

  async personalSignals() {
    const signals = (await this.storage.get('signals')) || {};
    const mine = await this.personalSymbols();
    return Object.fromEntries(mine.filter((s) => signals[s]).map((s) => [s, { score: signals[s].score, verdict: signals[s].verdict }]));
  }

  async nameOf(symbol) {
    if (NAMES[symbol]) return NAMES[symbol];
    try {
      return (await this.quote(symbol)).name || symbol;
    } catch (e) {
      if (e.notFound) throw e;
      return symbol;
    }
  }

  // plan: 'buy' = להעביר לרשימת הקניות, null = רק מעקב, undefined = בלי שינוי. extra = { reason, target } מהבוט
  async watch(symbolIn, remove, plan, extra = {}) {
    const symbol = cleanSymbol(symbolIn);
    let list = (await this.storage.get('watch')) || [];
    if (!symbol) return { watch: list };
    const old = list.find((w) => w.symbol === symbol);
    list = list.filter((w) => w.symbol !== symbol);
    if (!remove) {
      const row = { ...(old || {}), symbol, name: old?.name || (await this.nameOf(symbol)), added: old?.added || Date.now() };
      if (plan === 'buy') Object.assign(row, { plan: 'buy' }, extra.reason ? { reason: text(extra.reason, 300) } : {}, num(extra.target) > 0 ? { target: num(extra.target) } : {});
      else if (plan === null) for (const k of ['plan', 'reason', 'target']) delete row[k];
      list.unshift(row);
    }
    await this.storage.put('watch', list.slice(0, 100));
    return { watch: list };
  }

  // אישור (או דחייה) של מניה שהבוט הציע לרשימת הקניות – רק בלחיצה של המשתמשת
  async approve(id, yes) {
    const history = (await this.storage.get('chat')) || [];
    const msg = history.find((m) => m.proposals?.some((p) => p.id === id));
    const p = msg?.proposals.find((x) => x.id === id);
    if (!p) return json(404, { error: 'ההצעה לא נמצאה' });
    if (p.status === 'pending') {
      if (yes) await this.watch(p.symbol, false, 'buy', p);
      p.status = yes ? 'added' : 'declined';
      await this.storage.put('chat', history);
    }
    return json(200, { messages: history, watch: (await this.storage.get('watch')) || [] });
  }

  async saveHolding(h) {
    const symbol = cleanSymbol(h.symbol);
    const qty = num(h.qty);
    const price = num(h.price);
    if (!symbol || !(qty > 0) || !(price > 0)) return json(400, { error: 'צריך סמל, כמות ומחיר קנייה' });
    let currency = h.currency;
    if (!['USD', 'ILS', 'EUR', 'GBP'].includes(currency)) {
      try {
        currency = (await this.quote(symbol)).currency;
      } catch {
        currency = symbol.endsWith('.TA') ? 'ILS' : 'USD';
      }
    }
    const list = (await this.storage.get('holdings')) || [];
    const row = {
      id: list.some((x) => x.id === h.id) ? h.id : newId(),
      symbol,
      name: text(h.name, 80) || (await this.nameOf(symbol)),
      qty,
      price,
      currency,
      date: /^\d{4}-\d{2}-\d{2}$/.test(h.date || '') ? h.date : today(),
      stop: num(h.stop) > 0 ? num(h.stop) : null,
      target: num(h.target) > 0 ? num(h.target) : null,
      note: text(h.note, 300),
    };
    const next = list.some((x) => x.id === row.id) ? list.map((x) => (x.id === row.id ? row : x)) : [...list, row];
    await this.storage.put('holdings', next.slice(0, 200));
    return json(200, { holdings: next });
  }

  async deleteHolding(id) {
    const list = ((await this.storage.get('holdings')) || []).filter((x) => x.id !== id);
    await this.storage.put('holdings', list);
    return { holdings: list };
  }

  // תיק דמה: קנייה/מכירה במחיר החי, הכסף בשקלים (מניה בדולרים מומרת לפי השער)
  async demoTrade({ symbol: symbolIn, side, qty: qtyIn }) {
    const symbol = cleanSymbol(symbolIn);
    const qty = num(qtyIn);
    if (!symbol || !(qty > 0) || !['buy', 'sell'].includes(side)) return json(400, { error: 'פרטי עסקה לא תקינים' });
    const q = await this.quote(symbol);
    const fx = (await this.fxRates([q.currency]))[q.currency];
    if (!q.price || !fx) return json(502, { error: 'אין מחיר כרגע. נסו שוב.' });
    const demo = (await this.storage.get('demo')) || { cash: DEMO_START, start: Date.now(), holdings: [], trades: [] };
    if (!demo.start) demo.start = Date.now();
    const total = q.price * qty * fx;
    const h = demo.holdings.find((x) => x.symbol === symbol);
    if (side === 'buy') {
      if (total > demo.cash + 0.01) return json(400, { error: 'אין מספיק כסף בתיק הדמה' });
      demo.cash -= total;
      if (h) {
        h.price = (h.price * h.qty + q.price * qty) / (h.qty + qty);
        h.qty += qty;
      } else {
        demo.holdings.push({ id: newId(), symbol, name: NAMES[symbol] || q.name, qty, price: q.price, currency: q.currency, date: today() });
      }
    } else {
      if (!h || h.qty < qty - 1e-9) return json(400, { error: 'אין מספיק מניות למכירה' });
      demo.cash += total;
      h.qty -= qty;
      if (h.qty < 1e-9) demo.holdings = demo.holdings.filter((x) => x !== h);
    }
    demo.trades = [{ t: Date.now(), symbol, side, qty, price: q.price, currency: q.currency, ils: r2(total) }, ...(demo.trades || [])].slice(0, 200);
    demo.cash = r2(demo.cash);
    await this.storage.put('demo', demo);
    return json(200, await this.data());
  }

  async addPriceAlert({ symbol: symbolIn, op, price }) {
    const symbol = cleanSymbol(symbolIn);
    if (!symbol || !['above', 'below'].includes(op) || !(num(price) > 0)) return json(400, { error: 'פרטי התראה לא תקינים' });
    const list = (await this.storage.get('palerts')) || [];
    list.push({ id: newId(), symbol, name: await this.nameOf(symbol), op, price: num(price), created: Date.now() });
    await this.storage.put('palerts', list.slice(-100));
    return json(200, { palerts: list });
  }

  async useQuota(kind, max) {
    const day = (await this.storage.get('day')) || {};
    if (day.date !== today()) Object.assign(day, { date: today(), chat: 0, opinion: 0 });
    if ((day[kind] || 0) >= max) return false;
    day[kind] = (day[kind] || 0) + 1;
    await this.storage.put('day', day);
    return true;
  }

  // ---------- צ'אט ----------
  async chat(input) {
    const msg = text(input, 2000);
    if (!msg) return json(400, { error: 'הודעה ריקה' });
    if (!(await this.useQuota('chat', MAX_CHAT_PER_DAY))) return json(429, { error: 'הגעתם למכסת ההודעות להיום' });
    const history = (await this.storage.get('chat')) || [];
    history.push({ role: 'user', text: msg, t: Date.now() });
    let reply;
    const proposals = [];
    try {
      // 30 ההודעות האחרונות כהקשר (מתחיל תמיד בהודעה של המשתמשת)
      let context = history.slice(-30);
      while (context.length && context[0].role !== 'user') context = context.slice(1);
      reply = await chat(this.client(), context, (name, inp) => this.tool(name, inp, proposals));
    } catch (e) {
      return json(502, { error: aiMessage(e) });
    }
    history.push({ role: 'assistant', text: reply, t: Date.now(), ...(proposals.length ? { proposals } : {}) });
    const kept = history.slice(-200);
    await this.storage.put('chat', kept);
    return json(200, { messages: kept });
  }

  // proposals: לשם נאספות ההצעות לרשימת הקניות (מוצגות עם כפתור אישור מתחת לתשובה)
  async tool(name, input, proposals = []) {
    if (name === 'propose_buy_list') {
      const out = [];
      for (const st of (input.stocks || []).slice(0, 8)) {
        const symbol = cleanSymbol(st.symbol);
        if (!symbol || proposals.some((p) => p.symbol === symbol)) continue;
        let name;
        try {
          name = await this.nameOf(symbol);
        } catch {
          out.push({ symbol, error: 'not found' });
          continue;
        }
        proposals.push({ id: newId(), symbol, name, reason: text(st.reason, 300), target: num(st.target) > 0 ? num(st.target) : null, status: 'pending' });
        out.push({ symbol, status: 'awaiting_user_approval' });
      }
      return { proposed: out, note: 'Not added yet. The user sees an approve button under your reply.' };
    }
    if (name === 'get_stock') {
      const s = await this.stock(input.symbol, '1m');
      if (s.error) return s;
      return { quote: s.quote, analysis: s.analysis && { ...s.analysis, reasons: s.analysis.reasons.map((r) => r.text) }, verdict: s.verdictName, forecast: s.forecast, backtest: s.backtest && { ...s.backtest, lastTrades: undefined }, news: s.news.slice(0, 6).map((n) => n.title) };
    }
    if (name === 'search_symbol') return this.search(input.query);
    if (name === 'get_market') {
      const h = await this.home();
      return { indices: h.indices.map(({ symbol, name, price, change }) => ({ symbol, name, price, change })), open: h.open, outlook: h.outlook, topBuys: h.buys.map(({ symbol, name, score, verdict }) => ({ symbol, name, score, verdict })), topSells: h.sells.map(({ symbol, name, score, verdict }) => ({ symbol, name, score, verdict })) };
    }
    if (name === 'get_portfolio') {
      const d = await this.data();
      const symbols = [...d.holdings, ...d.demo.holdings].map((h) => h.symbol);
      const quotes = await this.quotes(symbols);
      const fx = await this.fxRates([...d.holdings, ...d.demo.holdings].map((h) => h.currency));
      const demo = valuePortfolio(d.demo.holdings, quotes, fx);
      return {
        real: valuePortfolio(d.holdings, quotes, fx),
        demo: { ...demo, cash: d.demo.cash, totalILS: r2(d.demo.cash + demo.valueILS), startILS: DEMO_START },
        watch: d.watch.filter((w) => w.plan !== 'buy').map((w) => w.symbol),
        buyList: d.watch.filter((w) => w.plan === 'buy').map(({ symbol, reason, target }) => ({ symbol, reason, target })),
        priceAlerts: d.palerts,
        usdIls: fx.USD ?? null,
      };
    }
    throw new Error(`כלי לא מוכר: ${name}`);
  }

  // ---------- התראות לטלפון ----------
  async vapid() {
    let vapid = await this.storage.get('vapid');
    if (!vapid) {
      vapid = await createVapidKeys();
      await this.storage.put('vapid', vapid);
    }
    return vapid;
  }

  async push(payload) {
    const subs = (await this.storage.get('subs')) || [];
    if (!subs.length) return 0;
    const vapid = await this.vapid();
    let sent = 0;
    const keep = [];
    for (const s of subs) {
      try {
        const result = await sendPush(s.sub, payload, vapid, 'mailto:bursa@example.com', this.pushFetch);
        if (result !== 'gone') keep.push(s);
        if (result === 'ok') sent++;
      } catch (e) {
        keep.push(s);
        console.log('push failed', e?.message || e);
      }
    }
    if (keep.length !== subs.length) await this.storage.put('subs', keep);
    return sent;
  }

  // התראה: נשמרת ביומן ונשלחת לטלפון. throttle = לא שוב על אותו נושא בזמן הזה
  async alert({ symbol = '', kind, title, body, throttle = THROTTLE_MS }) {
    const sent = (await this.storage.get('sent')) || {};
    const key = `${symbol}:${kind}`;
    const now = Date.now();
    if (throttle && sent[key] && now - sent[key] < throttle) return false;
    sent[key] = now;
    for (const [k, t] of Object.entries(sent)) if (now - t > 3 * 24 * 3600 * 1000) delete sent[k];
    await this.storage.put('sent', sent);
    const alerts = (await this.storage.get('alerts')) || [];
    alerts.unshift({ id: newId(), t: now, symbol, kind, title, body, read: false });
    await this.storage.put('alerts', alerts.slice(0, 200));
    await this.push({ title, body, url: symbol ? `#/s/${encodeURIComponent(symbol)}` : '#/alerts', tag: key });
    return true;
  }

  // ---------- המנוע ברקע ----------
  async ensureAlarm() {
    if (!(await this.storage.getAlarm())) await this.storage.setAlarm(Date.now() + 60 * 1000);
  }

  async personalSymbols() {
    const [watch, holdings, demo, palerts] = await Promise.all(['watch', 'holdings', 'demo', 'palerts'].map((k) => this.storage.get(k)));
    return [...new Set([...(holdings || []), ...(demo?.holdings || []), ...(watch || []), ...(palerts || [])].map((x) => x.symbol))];
  }

  async isPersonal(symbol) {
    return (await this.personalSymbols()).includes(symbol) || UNIVERSE.some((u) => u.symbol === symbol);
  }

  async saveSignal(symbol, quote, a) {
    const signals = (await this.storage.get('signals')) || {};
    const prev = signals[symbol];
    signals[symbol] = { name: NAMES[symbol] || quote.name || symbol, price: a.price, currency: quote.currency, change: a.change.d1, score: a.score, verdict: a.verdict, reasons: a.reasons.slice(0, 3).map((r) => r.text), t: Date.now() };
    await this.storage.put('signals', signals);
    return prev;
  }

  async alarm() {
    const open = marketsOpen();
    const anyOpen = open.us || open.ta;
    try {
      await this.scan(anyOpen);
      await this.marketCheck(anyOpen);
      await this.refreshOutlook();
    } catch (e) {
      console.log('alarm failed', e?.stack || e);
    }
    await this.storage.setAlarm(Date.now() + (anyOpen ? 2 : 20) * 60 * 1000);
  }

  // סריקה של עוד כמה מניות (בסבב): ניתוח, שמירה, והתראות כשמשהו השתנה
  async scan() {
    const personal = await this.personalSymbols();
    const all = [...new Set([...personal, ...UNIVERSE.map((u) => u.symbol)])];
    if (!all.length) return;
    let idx = ((await this.storage.get('scanIdx')) || 0) % all.length;
    // המניות שלך נבדקות בכל סבב; מהרשימה הכללית – לפי התור
    const batch = [...personal.slice(0, PER_ALARM / 2)];
    while (batch.length < Math.min(PER_ALARM, all.length)) {
      const s = all[idx];
      idx = (idx + 1) % all.length;
      if (!batch.includes(s)) batch.push(s);
      else if (batch.length >= all.length) break;
    }
    await this.storage.put('scanIdx', idx);
    const [holdings, watch, palerts, settingsRaw] = await Promise.all(['holdings', 'watch', 'palerts', 'settings'].map((k) => this.storage.get(k)));
    const settings = { ...DEFAULT_SETTINGS, ...(settingsRaw || {}) };
    for (const symbol of batch) {
      try {
        // בלי חדשות – כדי לא לעבור את מגבלת הבקשות של כל הרצה
        const s = await this.stock(symbol, '1m', { withNews: false });
        if (!s.analysis) continue;
        const prev = await this.saveSignal(symbol, s.quote, s.analysis);
        await this.checkAlerts(symbol, s, prev, { holdings: holdings || [], watch: watch || [], palerts: palerts || [], settings });
      } catch (e) {
        console.log('scan failed', symbol, e?.message || e);
      }
    }
  }

  async checkAlerts(symbol, s, prev, { holdings, watch, palerts, settings }) {
    const a = s.analysis;
    const name = s.quote.name || symbol;
    const price = a.price;
    const cur = s.quote.currency === 'ILS' ? '₪' : s.quote.currency === 'USD' ? '$' : ` ${s.quote.currency}`;
    const fmt = (p) => `${p >= 100 ? p.toFixed(1) : p.toFixed(2)}${cur}`;
    const owned = holdings.filter((h) => h.symbol === symbol);
    const watched = watch.some((w) => w.symbol === symbol);
    const why = a.reasons.slice(0, 2).map((r) => r.text).join(' · ');
    const wasBuy = prev && ['buy', 'strong_buy'].includes(prev.verdict);
    const wasSell = prev && ['sell', 'strong_sell'].includes(prev.verdict);

    // אות קנייה: חזק – לכל מניה; רגיל – רק למניות במעקב
    if (settings.buy && prev && (a.verdict === 'strong_buy' || (watched && a.verdict === 'buy')) && !wasBuy) {
      await this.alert({ symbol, kind: 'buy', title: `🟢 ${a.verdict === 'strong_buy' ? 'אות קנייה חזק' : 'אות קנייה'}: ${name}`, body: `${fmt(price)} · ציון ${a.score}. ${why}` });
    }
    // אות מכירה: למניות שבתיק (ובמעקב – רק חזק)
    if (settings.sell && prev && (owned.length ? ['sell', 'strong_sell'].includes(a.verdict) : watched && a.verdict === 'strong_sell') && !wasSell) {
      await this.alert({ symbol, kind: 'sell', title: `🔴 ${owned.length ? 'כדאי לשקול מכירה' : 'אות מכירה חזק'}: ${name}`, body: `${fmt(price)} · ציון ${a.score}. ${why}` });
    }
    // תנועה חדה היום
    const d1 = a.change.d1;
    if (settings.moves && (owned.length || watched) && d1 != null && Math.abs(d1) >= settings.movePct) {
      await this.alert({ symbol, kind: d1 > 0 ? 'up' : 'down', title: `${d1 > 0 ? '📈' : '📉'} ${name} ${d1 > 0 ? 'עלתה' : 'ירדה'} ${Math.abs(d1).toFixed(1)}% היום`, body: `המחיר עכשיו ${fmt(price)}`, throttle: 20 * 3600 * 1000 });
    }
    // סטופ-לוס ויעד במניות שבתיק
    for (const h of owned) {
      if (h.stop && price <= h.stop) await this.alert({ symbol, kind: `stop:${h.id}`, title: `⛔ ${name} ירדה לסטופ-לוס`, body: `המחיר ${fmt(price)} – מתחת לסטופ שקבעת (${fmt(h.stop)}). זה הזמן להחליט אם למכור.` });
      if (h.target && price >= h.target) await this.alert({ symbol, kind: `target:${h.id}`, title: `🎯 ${name} הגיעה ליעד`, body: `המחיר ${fmt(price)} – מעל היעד (${fmt(h.target)}). אפשר לממש רווח או להזיז את היעד.` });
    }
    // התראות מחיר (פעם אחת – ואז נמחקת)
    const hit = palerts.filter((p) => p.symbol === symbol && (p.op === 'above' ? price >= p.price : price <= p.price));
    if (hit.length) {
      for (const p of hit) await this.alert({ symbol, kind: `price:${p.id}`, title: `🔔 ${name} ${p.op === 'above' ? 'עלתה מעל' : 'ירדה מתחת ל-'}${fmt(p.price)}`, body: `המחיר עכשיו ${fmt(price)}`, throttle: 0 });
      const left = ((await this.storage.get('palerts')) || []).filter((p) => !hit.some((x) => x.id === p.id));
      await this.storage.put('palerts', left);
    }
  }

  // השוק כולו: ירידה חדה ב-S&P או קפיצה במדד הפחד – פעם ביום
  async marketCheck(anyOpen) {
    if (!anyOpen) return;
    const settings = { ...DEFAULT_SETTINGS, ...((await this.storage.get('settings')) || {}) };
    if (!settings.market) return;
    const q = await this.quotes(['^GSPC', '^VIX', 'TA35.TA']);
    const sp = q['^GSPC']?.change;
    const vix = q['^VIX']?.change;
    const ta = q['TA35.TA']?.change;
    const day = 20 * 3600 * 1000;
    if (sp != null && sp <= -2) await this.alert({ kind: 'market-down', title: `🌧️ השוק האמריקאי יורד ${Math.abs(sp).toFixed(1)}% היום`, body: 'לא להיבהל: ירידות חדות קורות. שווה להציץ בתיק ובתחזית השוק.', throttle: day });
    if (sp != null && sp >= 2) await this.alert({ kind: 'market-up', title: `☀️ השוק האמריקאי עולה ${sp.toFixed(1)}% היום`, body: 'יום חזק בוול סטריט.', throttle: day });
    if (vix != null && vix >= 15) await this.alert({ kind: 'vix', title: `😨 מדד הפחד קפץ ${vix.toFixed(0)}%`, body: 'יש לחץ בשווקים. תנודות גדולות צפויות.', throttle: day });
    if (ta != null && Math.abs(ta) >= 2) await this.alert({ kind: ta > 0 ? 'ta-up' : 'ta-down', title: `${ta > 0 ? '☀️' : '🌧️'} ת"א 35 ${ta > 0 ? 'עולה' : 'יורד'} ${Math.abs(ta).toFixed(1)}% היום`, body: 'תנועה חדה בבורסה בתל אביב.', throttle: day });
  }

  async refreshOutlook(force = false) {
    if (!this.env.ANTHROPIC_API_KEY && !this.env.AI_CLIENT) return;
    const old = await this.storage.get('outlook');
    if (!force && old && Date.now() - old.t < OUTLOOK_MS) return;
    // לא באמצע הלילה בישראל (חוץ מהפעם הראשונה)
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
    if (old && (hour < 7 || hour > 23)) return;
    const quotes = await this.quotes(INDICES.map((i) => i.symbol));
    const indices = INDICES.map((i) => ({ ...i, ...(quotes[i.symbol] || {}), name: i.name }));
    const news = await worldNews(this.fetchFn);
    try {
      const outlook = await marketOutlook(this.client(), indices, news);
      await this.storage.put('outlook', { ...outlook, news: news.slice(0, 12), t: Date.now() });
      const prevMood = old?.mood;
      if (prevMood && prevMood !== outlook.mood) {
        const settings = { ...DEFAULT_SETTINGS, ...((await this.storage.get('settings')) || {}) };
        if (settings.market) await this.alert({ kind: 'outlook', title: `🔭 תחזית השוק השתנתה: ${{ bullish: 'חיובית', neutral: 'ניטרלית', bearish: 'שלילית' }[outlook.mood]}`, body: outlook.headline, throttle: 6 * 3600 * 1000 });
      }
    } catch (e) {
      console.log('outlook failed', aiMessage(e));
    }
  }
}
