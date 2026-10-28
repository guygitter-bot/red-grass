// נתוני שוק מבחוץ: מחירים וגרפים מ-Yahoo Finance (בלי מפתח), חדשות מ-Yahoo ומ-Google News.
// כל פונקציה מקבלת fetchFn כדי שבבדיקות אפשר יהיה להחליף ברשת מדומה.
// שימו לב: בחלק מהבורסות המחיר מגיע בעיכוב של עד 15-20 דקות (כך Yahoo מספקים בחינם).

const UA = { 'user-agent': 'Mozilla/5.0 (compatible; bursa-app/1.0)', accept: 'application/json,text/xml,*/*' };
const HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

// סמל תקין: אותיות, מספרים ו-. - ^ = (למשל AAPL, LUMI.TA, ^GSPC, ILS=X, BTC-USD)
export const SYMBOL_RE = /^[A-Za-z0-9^][A-Za-z0-9.\-=^]{0,19}$/;
export const cleanSymbol = (s) => {
  const v = String(s || '').trim().toUpperCase();
  return SYMBOL_RE.test(v) ? v : null;
};

async function getJson(fetchFn, path) {
  let lastError;
  for (const host of HOSTS) {
    try {
      const res = await fetchFn(`${host}${path}`, { headers: UA, signal: AbortSignal.timeout(12000) });
      if (res.status === 404) throw Object.assign(new Error('המניה לא נמצאה'), { notFound: true });
      if (!res.ok) throw new Error(`Yahoo ${res.status}`);
      return await res.json();
    } catch (e) {
      if (e.notFound) throw e;
      lastError = e;
    }
  }
  throw lastError || new Error('אין חיבור לנתוני השוק');
}

// מניות בתל אביב: Yahoo מחזירים מחיר באגורות (ILA) – ממירים לשקלים
function money(currency) {
  if (currency === 'ILA') return { currency: 'ILS', factor: 0.01 };
  if (currency === 'GBp') return { currency: 'GBP', factor: 0.01 };
  return { currency: currency || 'USD', factor: 1 };
}

// גרף: range = 1d/5d/1mo/3mo/6mo/1y/2y/5y/10y/max, interval = 5m/15m/1h/1d/1wk
export async function fetchChart(fetchFn, symbol, range = '2y', interval = '1d') {
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplits`;
  const data = await getJson(fetchFn, path);
  const result = data?.chart?.result?.[0];
  if (!result) throw Object.assign(new Error('המניה לא נמצאה'), { notFound: true });
  return parseChart(result);
}

export function parseChart(result) {
  const meta = result.meta || {};
  const { currency, factor } = money(meta.currency);
  const q = result.indicators?.quote?.[0] || {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose;
  const ts = result.timestamp || [];
  const candles = [];
  for (let i = 0; i < ts.length; i++) {
    const c = q.close?.[i];
    if (c == null || !Number.isFinite(c)) continue;
    // מחיר מתואם לדיבידנדים ופיצולים (כדי שפיצול מניה לא ייראה כמו קריסה)
    const ratio = adj?.[i] && c ? adj[i] / c : 1;
    const f = factor * ratio;
    candles.push({
      t: ts[i],
      o: (q.open?.[i] ?? c) * f,
      h: (q.high?.[i] ?? c) * f,
      l: (q.low?.[i] ?? c) * f,
      c: c * f,
      v: q.volume?.[i] || 0,
    });
  }
  const price = meta.regularMarketPrice != null ? meta.regularMarketPrice * factor : candles.at(-1)?.c ?? null;
  const prev = (meta.chartPreviousClose ?? meta.previousClose);
  return {
    quote: {
      symbol: meta.symbol,
      name: meta.longName || meta.shortName || meta.symbol,
      currency,
      exchange: meta.fullExchangeName || meta.exchangeName || '',
      type: meta.instrumentType || '',
      price,
      prevClose: prev != null ? prev * factor : null,
      dayHigh: meta.regularMarketDayHigh != null ? meta.regularMarketDayHigh * factor : null,
      dayLow: meta.regularMarketDayLow != null ? meta.regularMarketDayLow * factor : null,
      volume: meta.regularMarketVolume ?? null,
      time: meta.regularMarketTime ?? null,
      high52: meta.fiftyTwoWeekHigh != null ? meta.fiftyTwoWeekHigh * factor : null,
      low52: meta.fiftyTwoWeekLow != null ? meta.fiftyTwoWeekLow * factor : null,
    },
    candles,
  };
}

// מחיר עכשיו + שינוי יומי (גרף של יום אחד ב-5 דקות)
export async function fetchQuote(fetchFn, symbol) {
  const { quote, candles } = await fetchChart(fetchFn, symbol, '1d', '5m');
  const change = quote.price != null && quote.prevClose ? (quote.price / quote.prevClose - 1) * 100 : null;
  return { ...quote, change, spark: candles.map((c) => Math.round(c.c * 10000) / 10000) };
}

// חיפוש מניה לפי שם / סמל, וגם חדשות עליה
export async function search(fetchFn, q, { quotes = 8, news = 0 } = {}) {
  const data = await getJson(fetchFn, `/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=${quotes}&newsCount=${news}&lang=en-US&enableFuzzyQuery=true`);
  return {
    results: (data.quotes || [])
      .filter((x) => x.symbol && ['EQUITY', 'ETF', 'INDEX', 'MUTUALFUND', 'CRYPTOCURRENCY', 'CURRENCY', 'FUTURE'].includes(x.quoteType))
      .map((x) => ({ symbol: x.symbol, name: x.longname || x.shortname || x.symbol, exchange: x.exchDisp || x.exchange || '', type: x.typeDisp || x.quoteType })),
    news: (data.news || []).map((n) => ({
      title: n.title,
      source: n.publisher || '',
      url: n.link,
      time: n.providerPublishTime || null,
    })).filter((n) => n.title && /^https?:\/\//.test(n.url || '')),
  };
}

const decode = (s) => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&')
  .replace(/<[^>]+>/g, '')
  .trim();

// RSS (Google News) -> [{ title, source, url, time }]
export function parseRss(xml, max = 15) {
  const items = [];
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const tag = (name) => decode((m[1].match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)) || [])[1]);
    const title = tag('title');
    const url = tag('link');
    if (!title || !/^https?:\/\//.test(url)) continue;
    const source = tag('source');
    const date = Date.parse(tag('pubDate'));
    items.push({ title: source && title.endsWith(` - ${source}`) ? title.slice(0, -(source.length + 3)) : title, source, url, time: Number.isFinite(date) ? Math.floor(date / 1000) : null });
    if (items.length >= max) break;
  }
  return items;
}

// חדשות עולם וכלכלה (באנגלית מארה"ב ובעברית מישראל)
const NEWS_FEEDS = [
  'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=iw&gl=IL&ceid=IL:iw',
  'https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en',
];

export async function worldNews(fetchFn) {
  const lists = await Promise.all(NEWS_FEEDS.map(async (url) => {
    try {
      const res = await fetchFn(url, { headers: UA, signal: AbortSignal.timeout(12000) });
      return res.ok ? parseRss(await res.text(), 12) : [];
    } catch {
      return [];
    }
  }));
  return lists.flat().sort((a, b) => (b.time || 0) - (a.time || 0));
}

// האם בורסה פתוחה עכשיו (בערך; בלי חגים). ניו יורק: ב'-ו' 9:30-16:00. תל אביב (מ-2026): ב'-ה' 9:59-17:25, ו' עד 13:50
export function marketsOpen(now = new Date()) {
  const at = (tz) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(now).map((p) => [p.type, p.value]));
    return { day: parts.weekday, min: Number(parts.hour) * 60 + Number(parts.minute) };
  };
  const ny = at('America/New_York');
  const il = at('Asia/Jerusalem');
  const weekday = (d) => !['Sat', 'Sun'].includes(d);
  return {
    us: weekday(ny.day) && ny.min >= 570 && ny.min < 960,
    ta: weekday(il.day) && il.min >= 599 && il.min < (il.day === 'Fri' ? 830 : 1045),
  };
}
