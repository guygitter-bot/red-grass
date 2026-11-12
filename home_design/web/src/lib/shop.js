// רשימת הקניות של הדמיה: סכומים, תצוגת מחיר וקישורי חיפוש למחירים אמיתיים.
//   shop = { summary, items: [{ name, details, quantity, min, max, stores, search }], labor: { description, min, max } | null, tips }

// רשימה ישנה או חלקית ממשיכה לעבוד
export function safeShop(shop) {
  if (!shop || !Array.isArray(shop.items)) return null;
  return { summary: '', tips: '', labor: null, ...shop };
}

// סך הכול: חומרים ומוצרים, ועם עבודה מקצועית אם צריך
export function totals(shop) {
  const items = (shop?.items || []).reduce((t, i) => ({ min: t.min + (i.min || 0), max: t.max + (i.max || 0) }), { min: 0, max: 0 });
  const labor = shop?.labor ? { min: shop.labor.min || 0, max: shop.labor.max || 0 } : { min: 0, max: 0 };
  return { items, labor, all: { min: items.min + labor.min, max: items.max + labor.max } };
}

const nis = (n) => `${Math.round(n).toLocaleString('he-IL')} ₪`;

// "1,200 עד 1,800 ₪", או מחיר אחד כשאין טווח
export function priceText(min, max) {
  if (!max && !min) return 'מחיר לא ידוע';
  if (!min || min === max) return `כ-${nis(max || min)}`;
  // "עד" ולא מקף: טווח מספרים עם מקף מתהפך בטקסט מימין לשמאל
  return `${Math.round(min).toLocaleString('he-IL')} עד ${nis(max)}`;
}

// קישורים לחיפוש המוצר באתרים עם מחירים אמיתיים
export function searchLinks(search) {
  const q = encodeURIComponent(String(search || '').trim());
  return [
    { label: 'מחירים ב-Zap', url: `https://www.zap.co.il/search.aspx?keyword=${q}` },
    { label: 'חיפוש בגוגל', url: `https://www.google.com/search?tbm=shop&hl=he&gl=il&q=${q}` },
  ];
}

// הרשימה כטקסט לשיתוף (ווטסאפ, פתקים)
export function shopText(shop, title) {
  const t = totals(shop);
  const lines = [`🛒 ${title}`, ''];
  for (const i of shop.items) {
    lines.push(`• ${i.name}${i.quantity ? ` (${i.quantity})` : ''} – ${priceText(i.min, i.max)}`);
    if (i.stores?.length) lines.push(`  איפה: ${i.stores.join(', ')}`);
  }
  if (shop.labor) lines.push(`• עבודה: ${shop.labor.description} – ${priceText(shop.labor.min, shop.labor.max)}`);
  lines.push('', `סך הכול בערך: ${priceText(t.all.min, t.all.max)}`, '(הערכה בלבד)');
  return lines.join('\n');
}
