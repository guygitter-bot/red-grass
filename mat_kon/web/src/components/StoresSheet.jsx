import { useState } from 'react';
import { ChevronDown, ExternalLink, Loader2, MapPin, Navigation, ShoppingBag, X } from 'lucide-react';
import { findStores } from '../lib/api';

const distanceText = (m) => (m < 1000 ? `${m} מ'` : `${(m / 1000).toFixed(1)} ק"מ`);
const price = (n) => `₪${n.toFixed(2).replace(/\.00$/, '')}`;
const orderLink = (chainName, orderUrl) =>
  orderUrl || `https://www.google.com/search?q=${encodeURIComponent(`${chainName} הזמנה אונליין`)}`;

function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('המכשיר לא תומך במיקום'));
    navigator.geolocation.getCurrentPosition(
      // מיקום בקירוב (~100 מ'): מספיק למציאת סופרים, ולא נשלח מיקום מדויק לשירותים חיצוניים
      (p) => resolve({ lat: Math.round(p.coords.latitude * 1000) / 1000, lon: Math.round(p.coords.longitude * 1000) / 1000 }),
      (e) => reject(new Error(e.code === 1
        ? 'אין הרשאת מיקום. אפשר לאשר אותה בהגדרות הדפדפן (סמל המנעול ליד הכתובת) ולנסות שוב.'
        : 'לא הצלחתי למצוא את המיקום. נסו שוב.')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

// איפה לקנות את מה שחסר: מבקשים מיקום רק כשלוחצים, מוצאים סופרים קרובים ומשווים מחירים
export default function StoresSheet({ session, items, title, onClose }) {
  const [state, setState] = useState({ step: 'ask' }); // ask | locating | searching | done | error
  const [open, setOpen] = useState(null);

  const run = async () => {
    try {
      setState({ step: 'locating' });
      const { lat, lon } = await locate();
      setState({ step: 'searching' });
      const data = await findStores(session, lat, lon, items);
      setState({ step: 'done', ...data });
    } catch (e) {
      setState({ step: 'error', error: e.message });
    }
  };

  const { stores = [], prices } = state;
  const nearest = (chain) => stores.find((s) => s.chain === chain);
  const cheapest = prices?.chains?.[0]?.total;

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-[#fffbf5] w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <ShoppingBag className="text-orange-500" size={22} />
          <div className="flex-1 font-bold">איפה לקנות הכי זול{title ? ` – ${title}` : ''}</div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-stone-100" aria-label="סגירה"><X size={20} /></button>
        </div>

        {items.length > 0 && (
          <p className="text-sm text-stone-600 mb-3 leading-relaxed line-clamp-3">
            <span className="font-bold">צריך לקנות:</span> {items.join(' · ')}
          </p>
        )}

        {state.step === 'ask' && (
          <div className="text-center py-4">
            <MapPin className="mx-auto text-orange-400 mb-2" size={36} />
            <p className="text-stone-600 text-sm leading-relaxed mb-4">
              כדי למצוא סופרים קרובים אצטרך את המיקום שלך. הוא משמש רק לחיפוש הזה ולא נשמר.
            </p>
            <button onClick={run} className="rounded-2xl bg-orange-500 text-white font-bold px-6 py-3 inline-flex items-center gap-2">
              <Navigation size={18} /> שימוש במיקום שלי
            </button>
          </div>
        )}

        {(state.step === 'locating' || state.step === 'searching') && (
          <div className="text-center py-8 text-stone-500">
            <Loader2 className="animate-spin mx-auto mb-2 text-orange-500" size={28} />
            {state.step === 'locating' ? 'מאתר את המיקום…' : 'מחפש סופרים קרובים ומשווה מחירים… (עד דקה וחצי)'}
          </div>
        )}

        {state.step === 'error' && (
          <div className="text-center py-4">
            <p className="text-sm text-red-600 mb-3">{state.error}</p>
            <button onClick={run} className="rounded-2xl bg-orange-500 text-white font-bold px-5 py-2.5">ניסיון נוסף</button>
          </div>
        )}

        {state.step === 'done' && (
          <>
            {prices?.chains?.length > 0 && (
              <>
                <h3 className="font-bold mb-2">השוואת מחירים לסל</h3>
                <ul className="space-y-2 mb-2">
                  {prices.chains.map((c, i) => {
                    const branch = nearest(c.chain);
                    return (
                      <li key={c.chainName} className={`rounded-2xl bg-white shadow-sm p-3 ${i === 0 ? 'ring-2 ring-emerald-400' : ''}`}>
                        <button onClick={() => setOpen(open === c.chainName ? null : c.chainName)} className="w-full flex items-center gap-2 text-right">
                          <span className="flex-1 min-w-0">
                            <span className="font-bold">{c.chainName}</span>
                            {i === 0 && <span className="mr-2 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5">הכי זול</span>}
                            {branch && <span className="block text-xs text-stone-500 truncate">הסניף הקרוב: {branch.name} · {distanceText(branch.distance)}</span>}
                            {c.missing > 0 && <span className="block text-xs text-amber-700">בלי {c.missing} מוצרים שאין להם מחיר ברשת הזו</span>}
                          </span>
                          <span className="text-left">
                            <span className="block font-bold text-lg">{price(c.total)}</span>
                            {i > 0 && cheapest != null && <span className="block text-xs text-stone-500">+{price(c.total - cheapest)}</span>}
                          </span>
                          <ChevronDown size={18} className={`text-stone-400 transition-transform ${open === c.chainName ? 'rotate-180' : ''}`} />
                        </button>
                        {open === c.chainName && (
                          <ul className="mt-2 border-t border-stone-100 pt-2 space-y-1 text-sm">
                            {c.items.map((it, j) => (
                              <li key={j} className="flex gap-2">
                                <span className="flex-1 text-stone-700">{it.product || it.item}</span>
                                <span className="font-medium">{it.promo && <span className="text-emerald-700 text-xs ml-1">מבצע</span>}{price(it.price)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <a
                          href={orderLink(c.chainName, branch?.orderUrl || c.orderUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-orange-700"
                        >
                          <ExternalLink size={14} /> {branch?.orderUrl || c.orderUrl ? 'הזמנה אונליין' : 'חיפוש הזמנה אונליין'}
                        </a>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-xs text-stone-500 mb-4 leading-relaxed">
                  {prices.source === 'cheapersal' ? 'מחירים ממחירון הרשתות (Cheapersal). ' : 'הערכת מחירים לפי מה שנמצא ברשת – המחיר בקופה יכול להיות שונה. '}
                  {prices.note}
                </p>
              </>
            )}
            {prices?.source === 'error' && <p className="text-sm text-amber-700 mb-3">{prices.note}</p>}

            <h3 className="font-bold mb-2">סופרים קרובים</h3>
            {!stores.length ? (
              <p className="text-sm text-stone-500">לא מצאתי סופרים בסביבה.</p>
            ) : (
              <ul className="space-y-2">
                {stores.map((s) => (
                  <li key={s.id} className="rounded-2xl bg-white shadow-sm p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{s.name}</div>
                        <div className="text-xs text-stone-500">
                          {distanceText(s.distance)}{s.address ? ` · ${s.address}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      <a href={`https://waze.com/ul?ll=${s.lat},${s.lon}&navigate=yes`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-stone-100 px-3 py-1 inline-flex items-center gap-1">
                        <Navigation size={14} /> ניווט
                      </a>
                      {s.chainName && (
                        <a href={orderLink(s.chainName, s.orderUrl)} target="_blank" rel="noopener noreferrer" className="rounded-full bg-orange-50 text-orange-800 px-3 py-1 inline-flex items-center gap-1">
                          <ExternalLink size={14} /> {s.orderUrl ? 'הזמנה אונליין' : 'חיפוש הזמנה'}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
