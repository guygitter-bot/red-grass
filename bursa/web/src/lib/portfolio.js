// חישובי שווי תיק בצד הלקוח: מחזיקות + מחירים + שערי מטבע -> שורות וסכומים בשקלים
export const DEMO_START = 100000;
const FX_SYMBOL = { USD: 'ILS=X', EUR: 'EURILS=X', GBP: 'GBPILS=X' };

// שער המרה לשקל (null אם עוד לא ידוע)
export function rateOf(currency, quotes) {
  if (!currency || currency === 'ILS') return 1;
  const s = FX_SYMBOL[currency];
  return s ? quotes?.[s]?.price ?? null : null;
}

// כל הסמלים שצריך לבקש מחיר עבורם (מניות + שערי מטבע)
export function neededSymbols(lists) {
  const set = new Set(['ILS=X']);
  for (const list of lists) {
    for (const h of list || []) {
      set.add(h.symbol);
      if (FX_SYMBOL[h.currency]) set.add(FX_SYMBOL[h.currency]);
    }
  }
  return [...set];
}

export function valueHoldings(holdings, quotes) {
  let value = 0;
  let cost = 0;
  let day = 0;
  const rows = (holdings || []).map((h) => {
    const q = quotes?.[h.symbol];
    const rate = rateOf(h.currency || q?.currency, quotes);
    const now = q?.price ?? null;
    const v = now != null ? now * h.qty : null;
    const c = h.price * h.qty;
    if (v != null && rate != null) {
      value += v * rate;
      cost += c * rate;
      if (q?.change != null) day += (v - v / (1 + q.change / 100)) * rate;
    }
    return {
      ...h,
      now,
      change: q?.change ?? null,
      value: v,
      gain: v != null ? v - c : null,
      gainPct: v != null && c ? (v / c - 1) * 100 : null,
      valueILS: v != null && rate != null ? v * rate : null,
    };
  });
  return { rows, value, cost, gain: value - cost, gainPct: cost ? (value / cost - 1) * 100 : null, day };
}

// תיק הדמה: מזומן + מניות. הרווח מול 100,000 ההתחלתיים
export function valueDemo(demo, quotes) {
  const h = valueHoldings(demo?.holdings, quotes);
  const total = (demo?.cash ?? DEMO_START) + h.value;
  return { ...h, cash: demo?.cash ?? DEMO_START, total, gain: total - DEMO_START, gainPct: (total / DEMO_START - 1) * 100 };
}
