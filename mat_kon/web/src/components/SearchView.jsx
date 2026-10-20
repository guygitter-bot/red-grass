import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Clock, ExternalLink, Flame, Globe, Loader2, Plus, Search, Users } from 'lucide-react';
import { searchCommunity, searchRecipes } from '../lib/api';
import { hostOf } from '../lib/recipes';
import { CommunityStats } from './SharedRecipe';
import DietFilter from './DietFilter';

const KOSHER = { parve: 'פרווה', dairy: 'חלבי', meat: 'בשרי' };
const urlKey = (url) => {
  try {
    return hostOf(url) + new URL(url).pathname.replace(/\/+$/, '');
  } catch {
    return url;
  }
};

// diets: אותו סינון כמו בספר (כשר, ללא גלוטן…), נשמר במכשיר
// חיפוש מתכון: קודם במאגר הקהילה (מיד ובחינם, לפי דירוג ומספר שמירות), ואחר כך – אם צריך – הסוכן מחפש ברשת
export default function SearchView({ session, initialQuery, onAdd, onBack, onPaywall, savedUrls, onOpenCommunity, diets = [], onDiets }) {
  const [query, setQuery] = useState(initialQuery || '');
  const [asked, setAsked] = useState(initialQuery || '');
  const [community, setCommunity] = useState(null);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState({});
  const webStarted = useRef('');

  // חיפוש ברשת (AI): רק כשמבקשים, או כשבקהילה אין כלום
  const runWeb = async (q) => {
    if (q.trim().length < 2) return;
    webStarted.current = q;
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

  // חיפוש בקהילה בכל שינוי של החיפוש או של הסינונים
  useEffect(() => {
    let alive = true;
    setCommunity(null);
    searchCommunity(session, asked.trim(), { diets })
      .then((list) => {
        if (!alive) return;
        setCommunity(list);
        if (!list.length && asked.trim().length >= 2 && !diets.length && webStarted.current !== asked) runWeb(asked);
      })
      .catch(() => {
        if (alive) setCommunity([]);
      });
    return () => {
      alive = false;
    };
  }, [asked, diets.join(','), session]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (q) => {
    setResults(null);
    setError('');
    setAsked(q);
  };
  return (
    <div className="min-h-screen pb-16">
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-2 h-14 flex items-center gap-1">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-100" aria-label="חזרה">
            <ArrowRight size={22} />
          </button>
          <div className="font-bold">חיפוש מתכון</div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4">
        <form onSubmit={(e) => { e.preventDefault(); submit(query); }} className="mt-4 flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="למשל: עוגת גבינה פירורים"
              className="w-full rounded-2xl border border-stone-200 bg-white py-3 pr-10 pl-3 outline-none focus:border-orange-400"
            />
          </div>
          <button disabled={query.trim().length < 2} className="rounded-2xl bg-orange-500 text-white px-4 font-bold shrink-0 disabled:opacity-40">חיפוש</button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          <DietFilter value={diets} onChange={onDiets} />
        </div>

        {/* מהקהילה */}
        <h2 className="mt-5 mb-2 font-black text-stone-900 flex items-center gap-2">
          <Users size={18} className="text-orange-500" />
          {asked.trim() ? 'מהקהילה' : 'פופולרי בקהילה'}
        </h2>
        {!community && <div className="py-6 flex justify-center text-stone-400"><Loader2 className="animate-spin" size={22} /></div>}
        {community && !community.length && (
          <p className="text-sm text-stone-500">{asked.trim() ? 'עוד אין בקהילה מתכון כזה.' : 'עוד אין מתכונים מתאימים בקהילה.'}</p>
        )}
        <ul className="grid gap-2 lg:grid-cols-2">
          {(community || []).map((r) => {
            const saved = savedUrls.has(urlKey(r.url));
            return (
              <li key={r.key}>
                <button onClick={() => onOpenCommunity(r)} className="w-full text-right rounded-2xl bg-white shadow-sm p-2 flex gap-3 items-start hover:shadow">
                  {r.image ? (
                    <img src={r.image} alt="" loading="lazy" className="w-20 h-20 rounded-xl object-cover bg-stone-100 shrink-0" />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-orange-50 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="font-bold text-stone-900 leading-snug">{r.title}</div>
                    {r.credit && <div className="text-xs text-stone-500 truncate" dir="auto">{r.credit}</div>}
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-stone-600"><CommunityStats s={r} /></div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-stone-500">
                      {r.minutes && <span className="inline-flex items-center gap-1"><Clock size={12} />{r.minutes} דק׳</span>}
                      {r.calories && <span className="inline-flex items-center gap-1"><Flame size={12} />{Math.round(r.calories)} קל׳ למנה</span>}
                      {KOSHER[r.kosher] && <span>{KOSHER[r.kosher]}</span>}
                      {saved && <span className="text-emerald-700 font-medium inline-flex items-center gap-0.5"><Check size={12} />בספר שלך</span>}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        {diets.length > 0 && <p className="mt-2 text-xs text-stone-400">הסינון – הערכה לפי המצרכים.</p>}

        {/* ברשת */}
        <h2 className="mt-7 mb-2 font-black text-stone-900 flex items-center gap-2">
          <Globe size={18} className="text-orange-500" /> ברשת
        </h2>
        {!busy && !results && !error && (
          <button
            onClick={() => runWeb(asked.trim() || query.trim())}
            disabled={(asked.trim() || query.trim()).length < 2}
            className="w-full rounded-2xl border border-dashed border-orange-300 bg-orange-50/50 text-orange-700 font-medium py-3 flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Globe size={18} /> חיפוש ברשת{asked.trim() ? ` "${asked.trim()}"` : ''}
          </button>
        )}
        {busy && (
          <div className="mt-4 text-center text-stone-500">
            <Loader2 className="animate-spin mx-auto mb-2 text-orange-500" size={28} />
            מחפש מתכונים טובים ברשת… (חצי דקה בערך)
          </div>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {results && !results.length && <p className="mt-4 text-center text-stone-500">לא נמצאו מתכונים ברשת. נסו שם אחר.</p>}

        <ul className="mt-2 space-y-2">
          {(results || []).map((r) => {
            const saved = added[r.url] || savedUrls.has(urlKey(r.url));
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
