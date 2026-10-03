import { useCallback, useEffect, useMemo, useState } from 'react';
import { Heart, LogOut, Search, X } from 'lucide-react';
import Login from './components/Login';
import AddLink from './components/AddLink';
import PendingList from './components/PendingList';
import RecipeCard from './components/RecipeCard';
import RecipeView from './components/RecipeView';
import { CATEGORIES } from './lib/categories';
import { addRecipe, deleteRecipe, listRecipes, refreshRecipe, updateRecipe } from './lib/api';
import { CATEGORY_EMOJI, countByCategory, filterRecipes, linkFromShare } from './lib/recipes';
import { usePersistentState } from './lib/storage';

// קוד גישה מקישור: https://mat-kon.pages.dev/#code=XXXX (נמחק מהכתובת מיד)
function takeCodeFromHash() {
  const m = window.location.hash.match(/[#&]code=([^&]+)/);
  if (!m) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return decodeURIComponent(m[1]);
}

// קישור ששותף לאפליקציה (share target): ?url=... / ?text=...
function takeSharedLink() {
  const link = linkFromShare(window.location.search);
  if (window.location.search) window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  return link;
}

const HASH_CODE = takeCodeFromHash();

const routeId = () => (window.location.hash.match(/^#\/r\/([\w-]+)/) || [])[1] || null;

export default function App() {
  const [code, setCode] = usePersistentState('matkon_code', () => HASH_CODE || '');
  const [recipes, setRecipes] = usePersistentState('matkon_recipes', []);
  const [pending, setPending] = useState([]);
  const [openId, setOpenId] = useState(routeId);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const [favorites, setFavorites] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');

  const logout = useCallback(() => {
    setCode('');
    setRecipes([]);
  }, [setCode, setRecipes]);

  useEffect(() => {
    if (HASH_CODE) setCode(HASH_CODE);
  }, [setCode]);

  useEffect(() => {
    const onHash = () => setOpenId(routeId());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const reload = useCallback(async () => {
    if (!code) return;
    try {
      setRecipes(await listRecipes(code));
      setLoadError('');
    } catch (e) {
      if (e.status === 401) logout();
      else setLoadError(e.message);
    }
  }, [code, setRecipes, logout]);

  useEffect(() => {
    reload();
  }, [reload]);

  const upsert = useCallback(
    (recipe) => setRecipes((list) => [recipe, ...list.filter((r) => r.id !== recipe.id)]),
    [setRecipes],
  );

  const add = useCallback(
    async (url) => {
      const key = `${Date.now()}-${Math.random()}`;
      setPending((p) => [...p, { key, url, error: '' }]);
      try {
        const { recipe, updated } = await addRecipe(code, url);
        upsert(recipe);
        setPending((p) => p.filter((x) => x.key !== key));
        setToast(updated ? `"${recipe.title}" עודכן` : `"${recipe.title}" נוסף ל${recipe.category}`);
      } catch (e) {
        if (e.status === 401) return logout();
        setPending((p) => p.map((x) => (x.key === key ? { ...x, error: e.message } : x)));
      }
    },
    [code, upsert, logout],
  );

  // קישור ששותף לאפליקציה מתווסף מיד
  useEffect(() => {
    if (!code) return;
    const shared = takeSharedLink();
    if (shared) add(shared);
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (id) => {
    window.location.hash = id ? `#/r/${id}` : '';
  };

  const counts = useMemo(() => countByCategory(recipes), [recipes]);
  const visible = useMemo(() => filterRecipes(recipes, { query, category, favorites }), [recipes, query, category, favorites]);
  const current = openId && recipes.find((r) => r.id === openId);

  if (!code) return <Login onLogin={setCode} />;

  if (current) {
    return (
      <RecipeView
        key={current.id}
        recipe={current}
        onBack={() => (window.history.length > 1 ? window.history.back() : open(null))}
        onUpdate={async (patch) => {
          upsert({ ...current, ...patch });
          try {
            upsert(await updateRecipe(code, current.id, patch));
          } catch (e) {
            setToast(e.message);
            reload();
          }
        }}
        onRefresh={async () => {
          const { recipe } = await refreshRecipe(code, current.id);
          upsert(recipe);
          setToast('המתכון עודכן מהמקור');
        }}
        onDelete={async () => {
          await deleteRecipe(code, current.id);
          setRecipes((list) => list.filter((r) => r.id !== current.id));
          open(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="bg-gradient-to-bl from-orange-500 to-amber-500 text-white px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-5 rounded-b-3xl shadow-sm">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight" dir="ltr">mat-kon</h1>
              <p className="text-orange-50 text-sm">כל קישור או סרטון הופך למתכון מסודר</p>
            </div>
            <button onClick={logout} className="p-2 rounded-full hover:bg-white/15" aria-label="התנתקות" title="התנתקות">
              <LogOut size={20} />
            </button>
          </div>
          <AddLink onAdd={add} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4">
        <PendingList
          items={pending}
          onRetry={(item) => {
            setPending((p) => p.filter((x) => x.key !== item.key));
            add(item.url);
          }}
          onDismiss={(item) => setPending((p) => p.filter((x) => x.key !== item.key))}
        />

        {loadError && (
          <div className="mt-4 rounded-2xl bg-red-50 text-red-700 p-3 text-sm flex items-center justify-between gap-2">
            <span>{loadError}</span>
            <button onClick={reload} className="font-bold underline shrink-0">נסו שוב</button>
          </div>
        )}

        {recipes.length > 0 && (
          <>
            <div className="mt-5 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש לפי שם, מצרך או תגית"
                className="w-full rounded-2xl border border-stone-200 bg-white py-3 pr-10 pl-10 outline-none focus:border-orange-400"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-label="ניקוי">
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="mt-3 -mx-4 px-4 flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <Chip active={!category && !favorites} onClick={() => { setCategory(null); setFavorites(false); }}>
                הכל <span className="opacity-60">{recipes.length}</span>
              </Chip>
              <Chip active={favorites} onClick={() => setFavorites((f) => !f)}>
                <Heart size={14} className="inline -mt-0.5" fill={favorites ? 'currentColor' : 'none'} /> מועדפים
              </Chip>
              {CATEGORIES.filter((c) => counts[c]).map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
                  {CATEGORY_EMOJI[c]} {c} <span className="opacity-60">{counts[c]}</span>
                </Chip>
              ))}
            </div>
          </>
        )}

        {recipes.length === 0 && !pending.length && !loadError && <Empty />}

        {recipes.length > 0 && visible.length === 0 && (
          <p className="text-center text-stone-500 mt-10">לא נמצאו מתכונים</p>
        )}

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {visible.map((r) => (
            <RecipeCard key={r.id} recipe={r} onOpen={() => open(r.id)} />
          ))}
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 inset-x-4 flex justify-center pointer-events-none">
          <div className="bg-stone-900 text-white text-sm rounded-full px-4 py-2.5 shadow-lg">{toast}</div>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm border transition ${
        active ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-stone-200 text-stone-700'
      }`}
    >
      {children}
    </button>
  );
}

function Empty() {
  return (
    <div className="text-center mt-12 px-6 text-stone-600">
      <div className="text-6xl mb-4">🍳</div>
      <h2 className="text-xl font-bold text-stone-800 mb-2">ספר המתכונים ריק</h2>
      <p className="leading-relaxed">
        הדביקו למעלה קישור למתכון מכל אתר, או לסרטון ב-YouTube, TikTok או Instagram.
        <br />
        המתכון יסודר עם מצרכים ואופן הכנה וייכנס לקטגוריה המתאימה.
      </p>
      <p className="text-sm mt-4 text-stone-500">
        בטלפון: אחרי "הוסף למסך הבית" אפשר גם לשתף קישור ישירות ל-mat-kon.
      </p>
    </div>
  );
}
