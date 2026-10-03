import { useEffect, useState } from 'react';
import { ArrowRight, Check, ExternalLink, Globe, Loader2, Plus, Search } from 'lucide-react';
import { searchRecipes } from '../lib/api';
import { hostOf } from '../lib/recipes';

// חיפוש מתכון ברשת לפי שם: הסוכן מחפש ומחזיר כמה מתכונים טובים, ובוחרים מה להוסיף לספר
export default function SearchView({ session, initialQuery, onAdd, onBack, onPaywall, savedUrls }) {
  const [query, setQuery] = useState(initialQuery || '');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState({});

  const run = async (q) => {
    if (q.trim().length < 2) return;
    setBusy(true);
    setError('');
    setResults(null);
    try {
      setResults(await searchRecipes(session, q.trim()));
    } catch (e) {
      if (e.status === 402) onPaywall(e.data.paymentUrl || '');
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialQuery) run(initialQuery);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen pb-16">
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-2 h-14 flex items-center gap-1">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-100" aria-label="חזרה">
            <ArrowRight size={22} />
          </button>
          <div className="font-bold">חיפוש מתכון ברשת</div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4">
        <form onSubmit={(e) => { e.preventDefault(); run(query); }} className="mt-4 flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="למשל: עוגת גבינה פירורים"
              className="w-full rounded-2xl border border-stone-200 bg-white py-3 pr-10 pl-3 outline-none focus:border-orange-400"
            />
          </div>
          <button disabled={busy || query.trim().length < 2} className="rounded-2xl bg-orange-500 text-white px-4 font-bold shrink-0 disabled:opacity-40">חיפוש</button>
        </form>

        {busy && (
          <div className="mt-10 text-center text-stone-500">
            <Loader2 className="animate-spin mx-auto mb-2 text-orange-500" size={28} />
            מחפש מתכונים טובים ברשת… (חצי דקה בערך)
          </div>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {!busy && !results && !error && (
          <p className="mt-12 text-center text-stone-500 leading-relaxed">
            <Globe className="mx-auto mb-3 text-orange-400" size={40} />
            כתבו שם של מנה, ונמצא כמה מתכונים טובים מאתרי בישול.
            <br />
            בוחרים אחד, והוא מסודר ונכנס לספר כמו קישור רגיל.
          </p>
        )}
        {results && !results.length && <p className="mt-10 text-center text-stone-500">לא נמצאו מתכונים. נסו שם אחר.</p>}

        <ul className="mt-4 space-y-2">
          {(results || []).map((r) => {
            const saved = added[r.url] || savedUrls.has(hostOf(r.url) + new URL(r.url).pathname.replace(/\/+$/, ''));
            return (
              <li key={r.url} className="rounded-2xl bg-white shadow-sm p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-stone-900">{r.title}</div>
                    <div className="text-xs text-stone-500 mt-0.5" dir="auto">{r.site || hostOf(r.url)}</div>
                    {r.description && <p className="text-sm text-stone-600 mt-1">{r.description}</p>}
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-orange-700">
                      <ExternalLink size={12} /> לצפייה במתכון
                    </a>
                  </div>
                  <button
                    disabled={saved}
                    onClick={() => {
                      onAdd(r.url, r.title);
                      setAdded((a) => ({ ...a, [r.url]: true }));
                    }}
                    className={`shrink-0 rounded-xl px-3 py-2 text-sm font-bold flex items-center gap-1 ${saved ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-500 text-white'}`}
                  >
                    {saved ? <><Check size={16} /> נוסף</> : <><Plus size={16} /> לספר</>}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
