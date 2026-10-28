// מנוע הניתוח: פונקציות טהורות (בלי רשת) – אינדיקטורים, ציון קנייה/מכירה, תחזית סטטיסטית ובדיקה לאחור.
// נר = { t (שניות), o, h, l, c, v }. כל המספרים מחושבים מהנרות היומיים.
//
// חשוב: אף אחד לא יודע לחזות את השוק בוודאות. הציון משלב כללים מוכרים (מגמה, מומנטום, RSI, MACD, בולינגר),
// והתחזית היא "טווח סביר" לפי התנודתיות בעבר – לא נבואה. הבדיקה לאחור מראה כמה הכללים עבדו על המניה הזאת בעבר.

const TRADING_DAYS = 252;

export function sma(values, n) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

export function ema(values, n) {
  const out = new Array(values.length).fill(null);
  if (values.length < n) return out;
  const k = 2 / (n + 1);
  let prev = values.slice(0, n).reduce((a, b) => a + b, 0) / n;
  out[n - 1] = prev;
  for (let i = n; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

// RSI לפי Wilder (14 ימים)
export function rsi(closes, n = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= n) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= n;
  loss /= n;
  out[n] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function macd(closes, fast = 12, slow = 26, signal = 9) {
  const ef = ema(closes, fast);
  const es = ema(closes, slow);
  const line = closes.map((_, i) => (ef[i] != null && es[i] != null ? ef[i] - es[i] : null));
  const start = line.findIndex((v) => v != null);
  const sig = new Array(closes.length).fill(null);
  if (start >= 0) {
    const s = ema(line.slice(start), signal);
    s.forEach((v, j) => { sig[start + j] = v; });
  }
  const hist = line.map((v, i) => (v != null && sig[i] != null ? v - sig[i] : null));
  return { line, signal: sig, hist };
}

export function bollinger(closes, n = 20, k = 2) {
  const mid = sma(closes, n);
  const upper = new Array(closes.length).fill(null);
  const lower = new Array(closes.length).fill(null);
  for (let i = n - 1; i < closes.length; i++) {
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += (closes[j] - mid[i]) ** 2;
    const sd = Math.sqrt(s / n);
    upper[i] = mid[i] + k * sd;
    lower[i] = mid[i] - k * sd;
  }
  return { mid, upper, lower };
}

export function logReturns(closes) {
  const out = [];
  for (let i = 1; i < closes.length; i++) if (closes[i - 1] > 0 && closes[i] > 0) out.push(Math.log(closes[i] / closes[i - 1]));
  return out;
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const stdev = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};

// הירידה הגדולה ביותר מהשיא (באחוזים, מספר שלילי)
export function maxDrawdown(closes) {
  let peak = -Infinity;
  let worst = 0;
  for (const c of closes) {
    peak = Math.max(peak, c);
    if (peak > 0) worst = Math.min(worst, c / peak - 1);
  }
  return worst * 100;
}

const pct = (a, b) => (a != null && b ? (a / b - 1) * 100 : null);
const round = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);

// כל האינדיקטורים פעם אחת (לניתוח ולבדיקה לאחור)
export function indicators(candles) {
  const closes = candles.map((c) => c.c);
  return {
    closes,
    volumes: candles.map((c) => c.v || 0),
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    rsi: rsi(closes),
    macd: macd(closes),
    bb: bollinger(closes),
    vol20: sma(candles.map((c) => c.v || 0), 20),
  };
}

// הציון ביום i (רק לפי מה שהיה ידוע עד אותו יום). מחזיר { score, reasons: [{ text, w }] }
export function scoreAt(ind, i) {
  const reasons = [];
  const add = (w, text) => reasons.push({ w, text });
  const c = ind.closes[i];
  const s50 = ind.sma50[i];
  const s200 = ind.sma200[i];
  const r = ind.rsi[i];
  const h = ind.macd.hist[i];
  const hPrev = ind.macd.hist[i - 1];

  // מגמה ארוכה
  if (s200 != null) {
    if (c > s200) add(15, 'המחיר מעל הממוצע של 200 יום – מגמה ארוכה חיובית');
    else add(-15, 'המחיר מתחת לממוצע של 200 יום – מגמה ארוכה שלילית');
    if (s50 != null) {
      const prev50 = ind.sma50[i - 5];
      const prev200 = ind.sma200[i - 5];
      if (prev50 != null && prev200 != null && prev50 <= prev200 && s50 > s200) add(15, 'צלב הזהב: הממוצע הקצר עבר עכשיו את הארוך');
      else if (prev50 != null && prev200 != null && prev50 >= prev200 && s50 < s200) add(-15, 'צלב המוות: הממוצע הקצר ירד עכשיו מתחת לארוך');
      else if (s50 > s200) add(8, 'ממוצע 50 מעל ממוצע 200');
      else add(-8, 'ממוצע 50 מתחת לממוצע 200');
    }
  }
  if (s50 != null) {
    if (c > s50) add(5, 'המחיר מעל ממוצע 50 יום');
    else add(-5, 'המחיר מתחת לממוצע 50 יום');
  }

  // מומנטום: 3 חודשים
  if (i >= 63) {
    const m3 = pct(c, ind.closes[i - 63]);
    if (m3 > 15) add(10, `מומנטום חזק: +${Math.round(m3)}% ב-3 חודשים`);
    else if (m3 > 5) add(5, `עלייה של ${Math.round(m3)}% ב-3 חודשים`);
    else if (m3 < -15) add(-10, `ירידה חדה: ${Math.round(m3)}% ב-3 חודשים`);
    else if (m3 < -5) add(-5, `ירידה של ${Math.round(-m3)}% ב-3 חודשים`);
  }

  // RSI: מכירת יתר במגמה טובה = הזדמנות; קניית יתר = זהירות
  if (r != null) {
    const upTrend = s200 != null && c > s200;
    if (r < 30) add(upTrend ? 15 : 6, `RSI נמוך (${Math.round(r)}) – מכירת יתר, ייתכן תיקון למעלה`);
    else if (r > 75) add(-15, `RSI גבוה מאוד (${Math.round(r)}) – קניית יתר, ייתכן תיקון למטה`);
    else if (r > 70) add(-8, `RSI גבוה (${Math.round(r)}) – קרוב לקניית יתר`);
  }

  // MACD
  if (h != null && hPrev != null) {
    if (hPrev <= 0 && h > 0) add(12, 'MACD חצה למעלה – סימן לתחילת עלייה');
    else if (hPrev >= 0 && h < 0) add(-12, 'MACD חצה למטה – סימן להיחלשות');
    else if (h > 0 && h > hPrev) add(5, 'MACD חיובי ומתחזק');
    else if (h < 0 && h < hPrev) add(-5, 'MACD שלילי ונחלש');
  }

  // רצועות בולינגר
  const lo = ind.bb.lower[i];
  const up = ind.bb.upper[i];
  if (lo != null && c < lo) add(5, 'המחיר ירד מתחת לרצועת בולינגר התחתונה');
  if (up != null && c > up) add(-5, 'המחיר מעל רצועת בולינגר העליונה');

  // מחזור חריג ביום עלייה / ירידה
  const v = ind.volumes[i];
  const v20 = ind.vol20[i - 1];
  if (v20 && v > v20 * 2 && i > 0) {
    if (c > ind.closes[i - 1]) add(5, 'מחזור מסחר כפול מהרגיל ביום עלייה – ביקוש חזק');
    else add(-5, 'מחזור מסחר כפול מהרגיל ביום ירידה – לחץ מכירות');
  }

  const score = Math.max(-100, Math.min(100, reasons.reduce((s, x) => s + x.w, 0)));
  return { score, reasons };
}

export const VERDICTS = {
  strong_buy: 'קנייה חזקה',
  buy: 'קנייה',
  hold: 'להחזיק / לחכות',
  sell: 'מכירה',
  strong_sell: 'מכירה חזקה',
};

export function verdictOf(score) {
  if (score >= 40) return 'strong_buy';
  if (score >= 15) return 'buy';
  if (score <= -40) return 'strong_sell';
  if (score <= -15) return 'sell';
  return 'hold';
}

// תמיכה והתנגדות פשוטות: השפל והשיא של 3 החודשים האחרונים (בלי היום)
function levels(candles) {
  const last = candles.slice(-64, -1);
  if (!last.length) return { support: null, resistance: null };
  return { support: Math.min(...last.map((c) => c.l ?? c.c)), resistance: Math.max(...last.map((c) => c.h ?? c.c)) };
}

// ניתוח מלא למניה
export function analyze(candles) {
  if (!candles || candles.length < 30) return null;
  const ind = indicators(candles);
  const i = candles.length - 1;
  const closes = ind.closes;
  const c = closes[i];
  const { score, reasons } = scoreAt(ind, i);
  const rets = logReturns(closes.slice(-61));
  const year = closes.slice(-TRADING_DAYS);
  const back = (n) => (i >= n ? pct(c, closes[i - n]) : null);
  return {
    price: round(c, 4),
    change: {
      d1: round(back(1)),
      w1: round(back(5)),
      m1: round(back(21)),
      m3: round(back(63)),
      m6: round(back(126)),
      y1: round(back(TRADING_DAYS)),
    },
    rsi: round(ind.rsi[i], 1),
    macd: round(ind.macd.hist[i], 4),
    sma50: round(ind.sma50[i], 4),
    sma200: round(ind.sma200[i], 4),
    bbUpper: round(ind.bb.upper[i], 4),
    bbLower: round(ind.bb.lower[i], 4),
    volatility: round(stdev(rets) * Math.sqrt(TRADING_DAYS) * 100, 1),
    drawdown: round(maxDrawdown(year), 1),
    high52: round(Math.max(...year), 4),
    low52: round(Math.min(...year), 4),
    ...Object.fromEntries(Object.entries(levels(candles)).map(([k, v]) => [k, round(v, 4)])),
    score,
    verdict: verdictOf(score),
    reasons: reasons.sort((a, b) => Math.abs(b.w) - Math.abs(a.w)),
  };
}

// התפלגות נורמלית מצטברת (קירוב)
export function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

export const HORIZONS = [
  { id: 'w1', days: 5, name: 'שבוע' },
  { id: 'm1', days: 21, name: 'חודש' },
  { id: 'm3', days: 63, name: '3 חודשים' },
  { id: 'y1', days: 252, name: 'שנה' },
];

// תחזית: טווח סביר (80% מהמקרים) לכל טווח זמן, לפי תנודתיות ומגמה בעבר.
// המגמה "מכווצת" לעבר תשואה ממוצעת של שוק (~8% בשנה) – כדי לא להבטיח שעלייה חדה תימשך לנצח,
// ומוסיפים הטיה קטנה לפי הציון. בנוסף: כמה פעמים בעבר המניה באמת עלתה בטווח הזה.
export function forecast(candles, score = 0) {
  if (!candles || candles.length < 60) return null;
  const closes = candles.map((c) => c.c);
  const last = closes[closes.length - 1];
  const all = logReturns(closes);
  const recent = all.slice(-TRADING_DAYS);
  const sigma = stdev(recent.length >= 60 ? recent : all);
  const histMu = mean(all);
  const marketMu = Math.log(1.08) / TRADING_DAYS;
  const weight = Math.min(all.length / (TRADING_DAYS * 10), 0.35); // כמה לסמוך על העבר של המניה עצמה
  const mu = weight * histMu + (1 - weight) * marketMu + (score / 100) * 0.0004;
  const z = 1.2816;
  return {
    sigmaYear: round(sigma * Math.sqrt(TRADING_DAYS) * 100, 1),
    driftYear: round((Math.exp(mu * TRADING_DAYS) - 1) * 100, 1),
    horizons: HORIZONS.map(({ id, days, name }) => {
      const m = mu * days;
      const s = sigma * Math.sqrt(days);
      // בעבר: כמה מחלונות של אותו אורך הסתיימו בעלייה
      let up = 0;
      let n = 0;
      for (let k = days; k < closes.length; k++) {
        n++;
        if (closes[k] > closes[k - days]) up++;
      }
      return {
        id,
        days,
        name,
        expected: round(last * Math.exp(m), 4),
        low: round(last * Math.exp(m - z * s), 4),
        high: round(last * Math.exp(m + z * s), 4),
        probUp: round(normCdf(s ? m / s : 0) * 100, 0),
        histUp: n >= 20 ? round((up / n) * 100, 0) : null,
      };
    }),
  };
}

// בדיקה לאחור: מה היה קורה אילו פעלנו לפי הציון בעבר (נכנסים בקנייה, יוצאים במכירה), מול "קנה והחזק".
// בנוסף: אחרי כל אות קנייה – האם המחיר היה גבוה יותר 20 ימי מסחר אחר כך.
export function backtest(candles, { enter = 15, exit = -15, cost = 0.001 } = {}) {
  if (!candles || candles.length < 260) return null;
  const ind = indicators(candles);
  const closes = ind.closes;
  const start = 200;
  let inPos = false;
  let equity = 1;
  let entry = 0;
  let peak = 1;
  let worst = 0;
  const trades = [];
  let hits = 0;
  let signals = 0;
  const fwdBuy = [];
  const fwdAll = [];
  let prevVerdict = null;
  for (let i = start; i < closes.length; i++) {
    const { score } = scoreAt(ind, i);
    if (i + 20 < closes.length) {
      const fwd = closes[i + 20] / closes[i] - 1;
      fwdAll.push(fwd);
      const v = verdictOf(score);
      // אות קנייה חדש (לא כל יום שבו הציון גבוה)
      if ((v === 'buy' || v === 'strong_buy') && prevVerdict !== 'buy' && prevVerdict !== 'strong_buy') {
        signals++;
        fwdBuy.push(fwd);
        if (fwd > 0) hits++;
      }
    }
    prevVerdict = verdictOf(score);
    if (inPos && i > start) equity *= closes[i] / closes[i - 1];
    if (!inPos && score >= enter) {
      inPos = true;
      entry = closes[i];
      equity *= 1 - cost;
      trades.push({ in: candles[i].t, from: closes[i] });
    } else if (inPos && score <= exit) {
      inPos = false;
      equity *= 1 - cost;
      Object.assign(trades[trades.length - 1], { out: candles[i].t, to: closes[i], ret: round((closes[i] / entry - 1) * 100, 1) });
    }
    peak = Math.max(peak, equity);
    worst = Math.min(worst, equity / peak - 1);
  }
  const closed = trades.filter((t) => t.ret != null);
  const years = (closes.length - start) / TRADING_DAYS;
  return {
    years: round(years, 1),
    strategy: round((equity - 1) * 100, 1),
    buyHold: round((closes[closes.length - 1] / closes[start] - 1) * 100, 1),
    strategyDrawdown: round(worst * 100, 1),
    buyHoldDrawdown: round(maxDrawdown(closes.slice(start)), 1),
    trades: trades.length,
    winRate: closed.length ? round((closed.filter((t) => t.ret > 0).length / closed.length) * 100, 0) : null,
    signals,
    signalHit: signals ? round((hits / signals) * 100, 0) : null,
    avgAfterSignal: fwdBuy.length ? round(mean(fwdBuy) * 100, 2) : null,
    avgAnyDay: fwdAll.length ? round(mean(fwdAll) * 100, 2) : null,
    inPosition: inPos,
    lastTrades: trades.slice(-5),
  };
}
