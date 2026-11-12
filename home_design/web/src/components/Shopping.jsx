import { priceText, searchLinks, totals } from '../lib/shop';

// רשימת הקניות של ההדמיה שמוצגת: מה לקנות, איפה, וכמה זה עולה בערך
export default function Shopping({ shop, busy, disabled, onAsk, onShare }) {
  if (!shop) {
    return (
      <div className="rounded-2xl border border-line bg-card p-4">
        <h2 className="m-0 text-lg font-bold">מה לקנות וכמה זה עולה</h2>
        <p className="m-0 mb-3 text-sm text-muted">המעצב משווה את ההדמיה לצילום ומכין רשימת קניות עם הערכת מחיר ואיפה קונים.</p>
        <button className="btn btn-main w-full" disabled={disabled} onClick={onAsk}>
          {busy ? 'המעצב מכין רשימה… כחצי דקה' : '🛒 להכין רשימת קניות'}
        </button>
      </div>
    );
  }
  const t = totals(shop);
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <h2 className="m-0 text-lg font-bold">מה לקנות וכמה זה עולה</h2>
      {shop.summary && <p className="m-0 mt-1 text-sm text-muted">{shop.summary}</p>}

      <div className="mt-3 rounded-xl bg-soft p-3">
        <span className="block text-sm text-muted">סך הכול בערך</span>
        <strong className="block text-xl">{priceText(t.all.min, t.all.max)}</strong>
        {shop.labor && (
          <span className="block text-sm text-muted">
            מוצרים וחומרים {priceText(t.items.min, t.items.max)} · עבודה {priceText(t.labor.min, t.labor.max)}
          </span>
        )}
      </div>

      <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
        {shop.items.map((item) => (
          <li key={item.name} className="rounded-xl border border-line p-3">
            <div className="flex items-start justify-between gap-3">
              <strong>{item.name}</strong>
              <span className="shrink-0 font-semibold">{priceText(item.min, item.max)}</span>
            </div>
            {(item.details || item.quantity) && (
              <p className="m-0 text-sm text-muted">{[item.quantity, item.details].filter(Boolean).join(' · ')}</p>
            )}
            {item.stores?.length > 0 && <p className="m-0 mt-1 text-sm">איפה קונים: {item.stores.join(', ')}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {searchLinks(item.search).map((l) => (
                <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="chip inline-flex items-center no-underline">
                  {l.label} ↗
                </a>
              ))}
            </div>
          </li>
        ))}
        {shop.labor && (
          <li className="rounded-xl border border-line p-3">
            <div className="flex items-start justify-between gap-3">
              <strong>עבודה מקצועית</strong>
              <span className="shrink-0 font-semibold">{priceText(shop.labor.min, shop.labor.max)}</span>
            </div>
            <p className="m-0 text-sm text-muted">{shop.labor.description}</p>
          </li>
        )}
      </ul>

      {shop.tips && <p className="m-0 mt-3 text-sm">💡 {shop.tips}</p>}
      <p className="m-0 mt-3 text-xs text-muted">
        המחירים הם הערכה של המעצב לפי התמונה, לא הצעת מחיר. המחיר האמיתי תלוי במידות המדויקות ובחנות – כדאי לבדוק בקישורים.
      </p>
      <div className="mt-3 flex gap-2">
        <button className="btn flex-1" onClick={onShare}>שיתוף הרשימה</button>
        <button className="btn flex-1" disabled={disabled} onClick={onAsk}>{busy ? 'מכין…' : 'להכין מחדש'}</button>
      </div>
    </div>
  );
}
