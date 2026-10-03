import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Globe, Heart, Loader2, LogOut, MessageCircle, PenLine, Plus, Search, Settings, Trash2, X } from 'lucide-react';
import SearchView from './components/SearchView';
import SettingsView from './components/SettingsView';
import Auth from './components/Auth';
import AddLink from './components/AddLink';
import ImportView from './components/ImportView';
import NewRecipeView from './components/NewRecipeView';
import ShoppingView from './components/ShoppingView';
import PlanView from './components/PlanView';
import FridgeView from './components/FridgeView';
import BottomNav from './components/BottomNav';
import { prunePlan } from './lib/plan';
import { scaleSections } from './lib/scale';
import { loadJson } from './lib/storage';
import InvitesView from './components/InvitesView';
import Paywall from './components/Paywall';
import PendingList from './components/PendingList';
import RecipeCard from './components/RecipeCard';
import RecipeView from './components/RecipeView';
import { CATEGORIES } from './lib/categories';
import {
  addCategory, addRecipe, addTextRecipe, deleteRecipe, removeCategory, getMe, getPlan, getShopping, listRecipes, logout as apiLogout, putPlan, putShopping, refreshRecipe,
  updateRecipe,
} from './lib/api';
import { SORTS, countByCategory, emojiOf, filterRecipes, freeLeft, linkFromShare, parseAuthHash, sortRecipes, topTags } from './lib/recipes';
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
  if (h.startsWith('#/new')) return { view: 'new', mode: h.includes('manual') ? 'manual' : 'photo' };
  if (h === '#/plan') return { view: 'plan' };
  if (h === '#/fridge') return { view: 'fridge' };
  if (h === '#/settings') return { view: 'settings' };
  if (h.startsWith('#/search')) return { view: 'search', q: decodeURIComponent((h.match(/[?&]q=([^&]*)/) || [])[1] || '') };
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
  // תכנון ארוחות שבועי (נשמר בשרת, כמו רשימת הקניות)
  const [plan, setPlan] = usePersistentState('matkon_plan', {});
  const planTimer = useRef(null);
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
  const [tag, setTag] = useState(null);
  // תמונות שצולמו מהמסך הראשי ("צילום מתכון"), עוברות למסך בניית המתכון
  const [photoFiles, setPhotoFiles] = useState(null);
  const [sort, setSort] = usePersistentState('matkon_sort', 'new');
  // קטגוריות שהמשתמש הוסיף (הקבועות ב-lib/categories)
  const [custom, setCustom] = usePersistentState('matkon_custom_categories', []);
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
      const me = await getMe(session);
      if (session) {
        setUser(me.user);
        setPaymentUrl(me.paymentUrl);
      }
      setCustom((me.categories || []).filter((c) => !CATEGORIES.includes(c)));
      setRecipes(await listRecipes(session));
      getShopping(session).then(setShopping).catch(() => {});
      getPlan(session).then(setPlan).catch(() => {});
      setLoadError('');
    } catch (e) {
      if (e.status === 401) signOut();
      else setLoadError(e.message);
    }
  }, [auth, session, setUser, setRecipes, setCustom, signOut]);

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

  const savePlan = useCallback(
    (next) => {
      const pruned = prunePlan(next);
      setPlan(pruned);
      clearTimeout(planTimer.current);
      planTimer.current = setTimeout(() => {
        putPlan(session, pruned).catch((e) => setToast(`התכנון לא נשמר: ${e.message}`));
      }, 600);
    },
    [session, setPlan],
  );

  // מצרכים של מתכון לרשימת הקניות, לפי מספר המנות שנבחר לו (בלי כפילויות של פריטים פתוחים)
  const shoppingWith = (list, recipe, lines) => {
    const have = new Set(list.filter((i) => i.recipeId === recipe.id && !i.checked).map((i) => i.text));
    const fresh = lines.filter((l) => !have.has(l));
    return {
      list: [...list, ...fresh.map((text) => ({ id: `${Date.now()}-${Math.random()}`, text, checked: false, recipeId: recipe.id, recipeTitle: recipe.title }))],
      added: fresh.length,
    };
  };
  const scaledLines = (recipe) => scaleSections(recipe.ingredients, loadJson(`matkon_factor_${recipe.id}`, 1)).flatMap((s) => s.items);

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
  const visible = useMemo(
    () => sortRecipes(filterRecipes(recipes, { query, category, favorites, tag }), sort),
    [recipes, query, category, favorites, tag, sort],
  );
  // כל הקטגוריות: הקבועות, אחריהן שלי, ו"אחר" בסוף
  const allCategories = [...CATEGORIES.filter((c) => c !== 'אחר'), ...custom, 'אחר'];
  const tags = useMemo(() => topTags(recipes), [recipes]);
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

  const openShopping = shopping.filter((i) => !i.checked).length;

  if (nav.view === 'shopping') {
    return (
      <>
        <ShoppingView session={session} items={shopping} onChange={saveShopping} onBack={() => open(null)} onToast={setToast} />
        {toast && <Toast text={toast} />}
        <BottomNav view="shopping" shoppingCount={openShopping} />
      </>
    );
  }

  if (nav.view === 'plan') {
    return (
      <>
        <PlanView
          plan={plan}
          recipes={recipes}
          onChange={savePlan}
          onShopWeek={(weekRecipes) => {
            let list = shopping;
            let added = 0;
            for (const r of weekRecipes) {
              const res = shoppingWith(list, r, scaledLines(r));
              list = res.list;
              added += res.added;
            }
            saveShopping(list);
            setToast(added ? `נוספו ${added} מצרכים לרשימת הקניות` : 'המצרכים כבר ברשימה');
            window.location.hash = '#/shopping';
          }}
        />
        {toast && <Toast text={toast} />}
        <BottomNav view="plan" shoppingCount={openShopping} />
      </>
    );
  }

  if (nav.view === 'settings') {
    return (
      <>
        <SettingsView
          session={session}
          isOwner={isOwner}
          recipes={recipes}
          custom={custom}
          shopping={shopping}
          plan={plan}
          onRestored={reload}
          onBack={() => open(null)}
          onToast={setToast}
        />
        {toast && <Toast text={toast} />}
      </>
    );
  }

  if (nav.view === 'search') {
    const savedUrls = new Set(recipes.map((r) => {
      try {
        const u = new URL(r.source?.url);
        return u.hostname.replace(/^(www|m)\./, '') + u.pathname.replace(/\/+$/, '');
      } catch {
        return '';
      }
    }));
    return (
      <>
        {paywall && <Paywall user={user} paymentUrl={paywall.paymentUrl} onClose={() => setPaywall(null)} />}
        <SearchView
          key={nav.q}
          session={session}
          initialQuery={nav.q}
          savedUrls={savedUrls}
          onAdd={(url, title) => {
            add(url);
            setToast(`"${title}" נכנס לספר – מסדר מתכון ברקע`);
          }}
          onBack={() => open(null)}
          onPaywall={(url) => setPaywall({ paymentUrl: url || paymentUrl })}
        />
        {toast && <Toast text={toast} />}
      </>
    );
  }

  if (nav.view === 'fridge') {
    return (
      <>
        <FridgeView recipes={recipes} />
        <BottomNav view="fridge" shoppingCount={openShopping} />
      </>
    );
  }

  if (nav.view === 'new') {
    return (
      <>
        {paywall && <Paywall user={user} paymentUrl={paywall.paymentUrl} onClose={() => setPaywall(null)} />}
        <NewRecipeView
          key={nav.mode}
          initialMode={nav.mode}
          initialFiles={photoFiles}
          onFilesTaken={() => setPhotoFiles(null)}
          session={session}
          categories={allCategories}
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
        categories={allCategories}
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
          const { list, added } = shoppingWith(shopping, current, lines);
          saveShopping(list);
          setToast(added ? `נוספו ${added} מצרכים לרשימת הקניות` : 'המצרכים כבר ברשימה');
        }}
        onAddToPlan={(day, dayLabel, meal) => {
          savePlan({ ...plan, [day]: [...(plan[day] || []), { id: `${Date.now()}`, recipeId: current.id, title: current.title, meal }] });
          setToast(`נוסף לתכנון של ${dayLabel}`);
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
    <div className="min-h-screen pb-24">
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
              <a href="#/settings" className="p-2 rounded-full bg-white/15 hover:bg-white/25" aria-label="הגדרות" title="הגדרות">
                <Settings size={20} />
              </a>
              {!isOwner && (
                <button onClick={signOut} className="p-2 rounded-full hover:bg-white/15" aria-label="יציאה" title="יציאה">
                  <LogOut size={20} />
                </button>
              )}
            </div>
          </div>
          <AddLink onAdd={add} onSearch={(q) => { window.location.hash = `#/search?q=${encodeURIComponent(q)}`; }} />
          {/* עוד דרכים להוסיף מתכון */}
          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs font-medium">
            <label className="rounded-2xl bg-white/15 hover:bg-white/25 py-2.5 flex flex-col items-center gap-1 cursor-pointer">
              <Camera size={20} /> צילום מתכון
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (!e.target.files?.length) return;
                  setPhotoFiles([...e.target.files]);
                  e.target.value = '';
                  window.location.hash = '#/new';
                }}
              />
            </label>
            <a href="#/new?manual" className="rounded-2xl bg-white/15 hover:bg-white/25 py-2.5 flex flex-col items-center gap-1">
              <PenLine size={20} /> כתיבה ידנית
            </a>
            <a href="#/search" className="rounded-2xl bg-white/15 hover:bg-white/25 py-2.5 flex flex-col items-center gap-1">
              <Globe size={20} /> חיפוש ברשת
            </a>
            <a href="#/import" className="rounded-2xl bg-white/15 hover:bg-white/25 py-2.5 flex flex-col items-center gap-1">
              <MessageCircle size={20} /> ייבוא מווטסאפ
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
              <Chip active={!category && !favorites && !tag} onClick={() => { setCategory(null); setFavorites(false); setTag(null); }}>
                הכל <span className="opacity-60">{recipes.length}</span>
              </Chip>
              <Chip active={favorites} onClick={() => setFavorites((f) => !f)}>
                <Heart size={14} className="inline -mt-0.5" fill={favorites ? 'currentColor' : 'none'} /> מועדפים
              </Chip>
              {allCategories.filter((c) => counts[c] || custom.includes(c)).map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
                  {emojiOf(c)} {c} <span className="opacity-60">{counts[c] || 0}</span>
                </Chip>
              ))}
              <NewCategory
                onAdd={async (name) => {
                  setCustom(await addCategory(session, name));
                  setCategory(name);
                  setToast(`הקטגוריה "${name}" נוספה. בדף מתכון אפשר להעביר אליה מתכונים.`);
                }}
              />
            </div>

            {category && custom.includes(category) && (
              <div className="mt-2 flex items-center gap-2 text-sm text-stone-500">
                <span>"{category}" היא קטגוריה שלכם · הסוכן ישבץ בה מתכונים חדשים כשהיא מתאימה</span>
                <button
                  onClick={async () => {
                    if (!window.confirm(`למחוק את הקטגוריה "${category}"? המתכונים שבה יעברו ל"אחר".`)) return;
                    try {
                      const res = await removeCategory(session, category);
                      setCustom(res.custom);
                      setRecipes((list) => list.map((r) => (r.category === category ? { ...r, category: 'אחר' } : r)));
                      setCategory(null);
                    } catch (e) {
                      setToast(e.message);
                    }
                  }}
                  className="shrink-0 inline-flex items-center gap-1 text-red-600"
                >
                  <Trash2 size={14} /> מחיקה
                </button>
              </div>
            )}

            {tags.length > 0 && (
              <div className="mt-2 -mx-4 px-4 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {tags.map(([t, n]) => (
                  <button
                    key={t}
                    onClick={() => setTag(tag === t ? null : t)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs border ${tag === t ? 'bg-stone-800 border-stone-800 text-white' : 'bg-white border-stone-200 text-stone-600'}`}
                  >
                    #{t} <span className="opacity-60">{n}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-2 flex items-center justify-end gap-1 text-sm text-stone-500">
              מיון:
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-transparent font-medium text-stone-700 outline-none">
                {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
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
      <BottomNav view="home" shoppingCount={openShopping} />
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

// "+ קטגוריה": יצירת קטגוריה חדשה ישר מהספר
function NewCategory({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="shrink-0 rounded-full px-3.5 py-1.5 text-sm border border-dashed border-orange-300 text-orange-700 bg-orange-50/50">
        <Plus size={14} className="inline -mt-0.5" /> קטגוריה
      </button>
    );
  }
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setOpen(false);
    setBusy(true);
    setError('');
    try {
      await onAdd(name.trim());
      setName('');
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="shrink-0 flex items-center gap-1">
      <input
        autoFocus
        value={name}
        onChange={(e) => { setName(e.target.value); setError(''); }}
        maxLength={30}
        placeholder="שם הקטגוריה"
        title={error}
        className={`w-36 rounded-full border px-3 py-1.5 text-sm outline-none ${error ? 'border-red-400' : 'border-orange-300'}`}
      />
      <button disabled={busy} className="rounded-full bg-orange-500 text-white px-3 py-1.5 text-sm font-bold disabled:opacity-50">
        {busy ? <Loader2 size={14} className="animate-spin" /> : 'הוספה'}
      </button>
      <button type="button" onClick={() => { setOpen(false); setError(''); }} className="p-1 text-stone-400" aria-label="ביטול"><X size={16} /></button>
      {error && <span className="text-xs text-red-600 whitespace-nowrap">{error}</span>}
    </form>
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
