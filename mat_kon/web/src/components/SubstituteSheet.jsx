import { useEffect, useState } from 'react';
import { Check, Loader2, Repeat, X } from 'lucide-react';

// "חסר לי": מה אפשר לשים במקום המצרך במתכון הזה – כמה, איך, ומה זה משנה. אפשר לשמור את התחליף בהערות שלי
export default function SubstituteSheet({ item, load, onClose, onSaveNote }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    let alive = true;
    load()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center print:hidden" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <Repeat size={20} className="text-orange-500 mt-1 shrink-0" />
          <div className="flex-1">
            <h2 className="text-lg font-black">מה אפשר לשים במקום?</h2>
            <p className="text-sm text-stone-500">{item}</p>
          </div>
          <button onClick={onClose} className="p-2 -m-2 text-stone-400" aria-label="סגירה"><X size={20} /></button>
        </div>

        {!data && !error && (
          <div className="py-8 text-center text-stone-500">
            <Loader2 className="animate-spin mx-auto mb-2 text-orange-500" size={26} />
            מחפשים תחליף שמתאים למתכון…
          </div>
        )}
        {error && <p className="mt-4 rounded-xl bg-rose-50 text-rose-700 p-3 text-sm">{error}</p>}

        {data && (
          <div className="mt-4 space-y-3">
            {(data.options || []).map((o, n) => {
              const line = `במקום ${item}: ${o.name}${o.amount ? ` – ${o.amount}` : ''}`;
              return (
                <div key={n} className="rounded-2xl border border-stone-200 p-3">
                  <div className="font-bold text-stone-900">{o.name}</div>
                  {o.amount && <div className="text-sm text-orange-800 mt-0.5">{o.amount}</div>}
                  {o.how && <div className="text-sm text-stone-700 mt-1">{o.how}</div>}
                  {o.effect && <div className="text-xs text-stone-500 mt-1">{o.effect}</div>}
                  <button
                    onClick={() => { onSaveNote(line); setSaved(line); }}
                    disabled={saved === line}
                    className="mt-2 text-sm text-orange-700 inline-flex items-center gap-1 disabled:text-emerald-700"
                  >
                    {saved === line ? <><Check size={14} /> נשמר בהערות שלי</> : 'שמירה בהערות שלי'}
                  </button>
                </div>
              );
            })}
            {data.note && <p className="text-sm text-stone-600 rounded-xl bg-orange-50 p-3">{data.note}</p>}
            {!(data.options || []).length && !data.note && <p className="text-sm text-stone-500">לא מצאתי תחליף טוב למצרך הזה.</p>}
            <p className="text-xs text-stone-400">הצעה של AI – כדאי לטעום ולהתאים.</p>
          </div>
        )}
      </div>
    </div>
  );
}
