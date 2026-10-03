import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Heart, LogOut, MessageCircle, PlusCircle, Search, ShoppingCart, UserPlus, X } from 'lucide-react';
import Auth from './components/Auth';
import AddLink from './components/AddLink';
import ImportView from './components/ImportView';
import NewRecipeView from './components/NewRecipeView';
import ShoppingView from './components/ShoppingView';
import InvitesView from './components/InvitesView';
import Paywall from './components/Paywall';
import PendingList from './components/PendingList';
import RecipeCard from './components/RecipeCard';
import RecipeView from './components/RecipeView';
import { CATEGORIES } from './lib/categories';
import {
  addRecipe, addTextRecipe, deleteRecipe, getMe, getShopping, listRecipes, logout as apiLogout, putShopping, refreshRecipe, updateRecipe,
} from './lib/api';
import { CATEGORY_EMOJI, countByCategory, filterRecipes, freeLeft, linkFromShare, parseAuthHash } from './lib/recipes';
import { usePersistentState } from './lib/storage';

// קישור הזמנה (#invite=...) או כניסה (#login). נלקח מהכתובת ונמחק ממנה מיד.
function takeAuthLink() {
  const auth = parseAuthHash(window.location.hash);
  if (auth) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return auth;
}

// קישור ששותף לאפליקציה (share target): ?url=... / ?text=...
function takeSharedLink() {
  const link = linkFromShare(window.location.search);
  if (window.location.search) window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  return link;
}

const AUTH_LINK = takeAuthLink();

const route = () => {
  const h = window.location.hash;
  if (h === '#/invites') return { view: 'invites' };
  if (h === '#/shopping') return { view: 'shopping' };
  if (h === '#/new') return { view: 'new' };
  if (h.startsWith('#/import')) return { view: 'import' };
  const id = (h.match(/^#\/r\/([\w-]+)/) || [])[1];
  return id ? { view: 'recipe', id } : { view: 'home' };
};

// בלי session = בעל האפליקציה: פתוח, בלי הרשמה ובלי הגבלה.
// עם session = משתמש שנרשם מקישור הזמנה, עם ספר מתכונים משלו.
export default function App() {
  const [session, setSession] = usePersistentState('matkon_session', '');
  const [user, setUser] = usePersistentState('matkon_user', null);
  const [recipes, setRecipes] = usePersistentState('matkon_recipes', []);
  // רשימת הקניות: נשמרת בשרת (משותפת לכל המכשירים של אותו ספר) ומקומית לתצוגה מהירה
  const [shopping, setShopping] = usePersistentState('matkon_shopping', []);
  const shoppingTimer = useRef(null);
  // מכשיר שנרשם פעם מקישור הזמנה נשאר מכשיר של משתמש מוזמן, גם אחרי יציאה
  const [guestDevice, setGuestDevice] = usePersistentState('matkon_guest', false);
  const [auth, setAuth] = useState(() => {
    if (AUTH_LINK && !(AUTH_LINK.mode === 'register' && session)) return AUTH_LINK;
    return guestDevice && !session ? { mode: 'login' } : null;
  });
  const [paywall, setPaywall] = useState(null);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [pending, setPending] = useState([]);
  const [nav, setNav] = useState(route);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const [favorites, setFavorites] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');

  const isOwner = !session;

  const signOut = useCallback(() => {
    apiLogout(session);
    setSession('');
    setUser(null);
    setRecipes([]);
    setAuth({ mode: 'login' });
  }, [session, setSession, setUser, setRecipes]);

  useEffect(() => {
    const onHash = () => setNav(route());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const reload = useCallback(async () => {
    if (auth) return;
    try {
      if (session) {
        const me = await getMe(session);
        setUser(me.user);
        setPaymentUrl(me.paymentUrl);
      }
      setRecipes(await listRecipes(session));
      getShopping(session).then(setShopping).catch(() => {});
      setLoadError('');
    } catch (e) {
      if (e.status === 401) signOut();
      else setLoadError(e.message);
    }
  }, [auth, session, setUser, setRecipes, signOut]);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveShopping = useCallback(
    (items) => {
      setShopping(items);
      clearTimeout(shoppingTimer.current);
      shoppingTimer.current = setTimeout(() => {
        putShopping(session, items).catch((e) => setToast(`רשימת הקניות לא נשמרה: ${e.message}`));
      }, 600);
    },
    [session, setShopping],
  );

  const upsert = useCallback(
    (recipe) => setRecipes((list) => [recipe, ...list.filter((r) => r.id !== recipe.id)]),
    [setRecipes],
  );

  const add = useCallback(
    async (url) => {
      if (freeLeft(user) === 0) {
        setPaywall({ paymentUrl });
        return;
      }
      const key = `${Date.now()}-${Math.random()}`;
      setPending((p) => [...p, { key, url, error: '' }]);
      try {
        const { recipe, updated, user: updatedUser } = await addRecipe(session, url);
        upsert(recipe);
        if (updatedUser) setUser(updatedUser);
        setPending((p) => p.filter((x) => x.key !== key));
        setToast(updated ? `"${recipe.title}" עודכן` : `"${recipe.title}" נוסף ל${recipe.category}`);
      } catch (e) {
        setPending((p) => p.filter((x) => x.key !== key || e.status !== 402));
        if (e.status === 401) return signOut();
        if (e.status === 402) return setPaywall({ paymentUrl: e.data.paymentUrl || '' });
        setPending((p) => p.map((x) => (x.key === key ? { ...x, error: e.message } : x)));
      }
    },
    [session, user, paymentUrl, upsert, setUser, signOut],
  );

  // קישור ששותף לאפליקציה מתווסף מיד
  useEffect(() => {
    if (auth) return;
    const shared = takeSharedLink();
    if (shared) add(shared);
  }, [auth]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (id) => {
    window.location.hash = id ? `#/r/${id}` : '';
  };
  const back = () => (window.history.length > 1 ? window.history.back() : open(null));

  const counts = useMemo(() => countByCategory(recipes), [recipes]);
  const visible = useMemo(() => filterRecipes(recipes, { query, category, favorites }), [recipes, query, category, favorites]);
  const current = nav.view === 'recipe' && recipes.find((r) => r.id === nav.id);
  const left = freeLeft(user);

  if (auth) {
    return (
      <Auth
        mode={auth.mode}
        token={auth.token}
        onDone={({ session: s, user: u }) => {
          setRecipes([]);
          setUser(u);
          setSession(s);
          setGuestDevice(true);
          setAuth(null);
        }}
      />
    );
  }

  if (nav.view === 'invites' && isOwner) return <InvitesView onBack={back} />;

  if (nav.view === 'shopping') {
    return (
      <>
        <ShoppingView session={session} items={shopping} onChange={saveShopping} onBack={() => open(null)} onToast={setToast} />
        {toast && <Toast text={toast} />}
      </>
    );
  }

  if (nav.view === 'new') {
    return (
      <>
        {paywall && <Paywall user={user} paymentUrl={paywall.paymentUrl} onClose={() => setPaywall(null)} />}
        <NewRecipeView
          session={session}
          onBack={() => open(null)}
          onSaved={(recipe, updatedUser) => {
            upsert(recipe);
            if (updatedUser) setUser(updatedUser);
            window.location.replace(`#/r/${recipe.id}`);
          }}
          onPaywall={(url) => setPaywall({ paymentUrl: url || paymentUrl })}
        />
      </>
    );
  }

  if (nav.view === 'import') {
    return (
      <>
        {paywall && <Paywall user={user} paymentUrl={paywall.paymentUrl} onClose={() => setPaywall(null)} />}
        <ImportView
          session={session}
          user={user}
          recipes={recipes}
          onBack={() => open(null)}
          onRecipe={(recipe, updatedUser) => {
            upsert(recipe);
            if (updatedUser) setUser(updatedUser);
          }}
          onPaywall={(url) => setPaywall({ paymentUrl: url || paymentUrl })}
        />
      </>
    );
  }

  if (current) {
    return (
      <>
      {toast && <Toast text={toast} />}
      <RecipeView
        key={current.id}
        recipe={current}
        onBack={back}
        onUpdate={async (patch) => {
          upsert({ ...current, ...patch });
          try {
            upsert(await updateRecipe(session, current.id, patch));
          } catch (e) {
            setToast(e.message);
            reload();
          }
        }}
        onRefresh={async () => {
          const { recipe } = await refreshRecipe(session, current.id);
          upsert(recipe);
          setToast('המתכון עודכן מהמקור');
        }}
        onAddToShopping={(lines) => {
          const have = new Set(shopping.filter((i) => i.recipeId === current.id && !i.checked).map((i) => i.text));
          const fresh = lines.filter((l) => !have.has(l));
          saveShopping([
            ...shopping,
            ...fresh.map((text) => ({ id: `${Date.now()}-${Math.random()}`, text, checked: false, recipeId: current.id, recipeTitle: current.title })),
          ]);
          setToast(fresh.length ? `נוספו ${fresh.length} מצרכים לרשימת הקניות` : 'המצרכים כבר ברשימה');
        }}
        onDelete={async () => {
          await deleteRecipe(session, current.id);
          setRecipes((list) => list.filter((r) => r.id !== current.id));
          open(null);
        }}
      />
      </>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      {paywall && <Paywall user={user} paymentUrl={paywall.paymentUrl} onClose={() => setPaywall(null)} />}
      <header className="bg-gradient-to-bl from-orange-500 to-amber-500 text-white px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-5 rounded-b-3xl shadow-sm">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight" dir="ltr">mat-kon</h1>
              <p className="text-orange-50 text-sm">
                {user ? `ספר המתכונים של ${user.name}` : 'כל קישור או סרטון הופך למתכון מסודר'}
              </p>
            </div>
            <div className="flex items-center gap-2">
            <a href="#/shopping" className="relative p-2 rounded-full bg-white/15 hover:bg-white/25" aria-label="רשימת קניות" title="רשימת קניות">
              <ShoppingCart size={20} />
              {shopping.some((i) => !i.checked) && (
                <span className="absolute -top-1 -left-1 min-w-5 h-5 px-1 rounded-full bg-white text-orange-600 text-xs font-bold flex items-center justify-center">
                  {shopping.filter((i) => !i.checked).length}
                </span>
              )}
            </a>
            {isOwner ? (
              <a href="#/invites" className="flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 px-3 py-2 text-sm font-medium">
                <UserPlus size={18} /> <span className="hidden sm:inline">הזמנות</span>
              </a>
            ) : (
              <button onClick={signOut} className="p-2 rounded-full hover:bg-white/15" aria-label="יציאה" title="יציאה">
                <LogOut size={20} />
              </button>
            )}
            </div>
          </div>
          <AddLink onAdd={add} />
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            <a href="#/new" className="inline-flex items-center gap-1.5 text-sm font-medium text-white/95 hover:text-white">
              <PlusCircle size={16} /> מתכון מתמונה או כתיבה ידנית
            </a>
            <a href="#/import" className="inline-flex items-center gap-1.5 text-sm font-medium text-white/95 hover:text-white">
              <MessageCircle size={16} /> ייבוא מצ'אט או מקבוצה בווטסאפ
            </a>
          </div>
          {left !== null && (
            <button onClick={() => left === 0 && setPaywall({ paymentUrl })} className="mt-3 w-full text-right text-sm text-orange-50">
              <div className="flex justify-between mb-1">
                <span>{left === 0 ? 'נגמרו המתכונים החינמיים' : `נשארו ${left} מתכונים חינמיים`}</span>
                <span dir="ltr">{user.added}/{user.freeLimit}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/25 overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: `${Math.min(100, (user.added / user.freeLimit) * 100)}%` }} />
              </div>
            </button>
          )}
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
          onPaste={async (item, text) => {
            try {
              const { recipe, user: updatedUser } = await addTextRecipe(session, { url: item.url, text });
              upsert(recipe);
              if (updatedUser) setUser(updatedUser);
              setPending((p) => p.filter((x) => x.key !== item.key));
              setToast(`"${recipe.title}" נוסף ל${recipe.category}`);
            } catch (e) {
              if (e.status === 402) setPaywall({ paymentUrl: e.data.paymentUrl || paymentUrl });
              throw e;
            }
          }}
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

      {toast && <Toast text={toast} />}
    </div>
  );
}

function Toast({ text }) {
  return (
    <div className="fixed bottom-6 inset-x-4 z-50 flex justify-center pointer-events-none">
      <div className="bg-stone-900 text-white text-sm rounded-full px-4 py-2.5 shadow-lg">{text}</div>
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
