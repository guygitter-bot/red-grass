import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Globe, Heart, LogOut, MessageCircle, PenLine, Search, Settings, X } from 'lucide-react';
import SearchView from './components/SearchView';
import SettingsView from './components/SettingsView';
import Auth from './components/Auth';
import AddLink from './components/AddLink';
import ImportView from './components/ImportView';
import NewRecipeView from './components/NewRecipeView';
import ShoppingView from './components/ShoppingView';
import PlanView from './components/PlanView';
import InventoryView from './components/InventoryView';
import BottomNav from './components/BottomNav';
import { prunePlan } from './lib/plan';
import { scaleSections } from './lib/scale';
import { loadJson, saveJson } from './lib/storage';
import { mergePantry } from './lib/fridge';
import { itemsToPlan, planToItems } from './lib/sync';
import useSyncedList from './hooks/useSyncedList';
import useIdbState from './hooks/useIdbState';

// מתכונים מהמכשיר עוברים את אותה בדיקה כמו מהשרת (נתון פגום לא יפיל את האפליקציה)
const cleanRecipes = (list) => (Array.isArray(list) ? list.filter((r) => r && typeof r === 'object' && r.id).map(safeRecipe) : []);
import InvitesView from './components/InvitesView';
import ShareView from './components/ShareView';
import PrivacyView from './components/PrivacyView';
import AdminView from './components/AdminView';
import HelpView from './components/HelpView';
import CategoriesView from './components/CategoriesView';
import Paywall from './components/Paywall';
import PendingList from './components/PendingList';
import RecipeCard from './components/RecipeCard';
import RecipeView from './components/RecipeView';
import { CATEGORIES } from './lib/categories';
import {
  addCategory, setCategoryPrefs, addRecipeAsync, addTextRecipe, getJob, getRecipe, deleteRecipe, removeCategory, getMe, getPlan, getShopping, listRecipes, logout as apiLogout, refreshRecipe,
  updateRecipe, safeRecipe, getPantry, shoppingOps, pantryOps, planOps,
} from './lib/api';
import { SORTS, countByCategory, emojiOf, filterRecipes, freeLeft, linkFromShare, orderCategories, parseAuthHash, sortRecipes } from './lib/recipes';
import { usePersistentState } from './lib/storage';

// קישור הזמנה (#invite=...) או כניסה (#login). נלקח מהכתובת ונמחק ממנה מיד.
function takeAuthLink() {
  const auth = parseAuthHash(window.location.hash);
  if (auth) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return auth;
}

// מה ששותף לאפליקציה (share target). שיתוף אמיתי מגיע דרך ה-service worker (?shared=link + מטמון) ומתווסף מיד;
// ?url=... / ?text=... ישירות בכתובת (קישור שמישהו שלח) רק מוצע, באישור.
async function takeShared() {
  const params = new URLSearchParams(window.location.search);
  if (window.location.search) window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  if (params.get('shared') === 'link') {
    try {
      const cache = await caches.open('matkon-share');
      const res = await cache.match('shared-link');
      if (!res) return null;
      await cache.delete('shared-link');
      const data = await res.json();
      return { trusted: true, link: linkFromShare(`?${new URLSearchParams(data)}`), text: data.text || '' };
    } catch {
      return null;
    }
  }
  const link = linkFromShare(params.toString() ? `?${params}` : '');
  const text = params.get('text') || '';
  return link || text ? { trusted: false, link, text } : null;
}

const AUTH_LINK = takeAuthLink();

const route = () => {
  const h = window.location.hash;
  if (h === '#/invites') return { view: 'invites' };
  if (h === '#/share') return { view: 'share' };
  if (h === '#/privacy') return { view: 'privacy' };
  if (h === '#/admin') return { view: 'admin' };
  if (h === '#/categories') return { view: 'categories' };
  if (h === '#/help' || h.startsWith('#/help/')) return { view: 'help', play: h.slice(7) };
  if (h === '#/shopping') return { view: 'shopping' };
  if (h.startsWith('#/new')) return { view: 'new', mode: h.includes('manual') ? 'manual' : 'photo' };
  if (h === '#/plan') return { view: 'plan' };
  if (h === '#/fridge') return { view: 'fridge' };
  if (h === '#/fridge/fridge' || h === '#/fridge/pantry') return { view: 'fridge', place: h.slice(9) };
  if (h === '#/settings') return { view: 'settings' };
  if (h.startsWith('#/search')) return { view: 'search', q: decodeURIComponent((h.match(/[?&]q=([^&]*)/) || [])[1] || '') };
  if (h.startsWith('#/import')) return { view: 'import' };
  const id = (h.match(/^#\/r\/([\w-]+)/) || [])[1];
  return id ? { view: 'recipe', id } : { view: 'home' };
};

// בלי session = בעל האפליקציה כשהספר פתוח. כשהספר נעול, בעל האפליקציה נכנס פעם אחת בכל מכשיר
// (סיסמת בעלים או חשבון הגוגל שלו) ומקבל session של בעלים.
// session של משתמש = מי שנרשם מקישור הזמנה, עם ספר מתכונים משלו.
export default function App() {
  const [session, setSession] = usePersistentState('matkon_session', '');
  const [user, setUser] = usePersistentState('matkon_user', null);
  const [recipes, setRecipes] = useIdbState('matkon_recipes', [], cleanRecipes);
  // רשימת הקניות: נשמרת בשרת (משותפת לכל המכשירים של אותו ספר) ומקומית לתצוגה מהירה
  const [shopping, setShopping] = usePersistentState('matkon_shopping', []);
  // תכנון ארוחות שבועי (נשמר בשרת, כמו רשימת הקניות)
  const [plan, setPlan] = usePersistentState('matkon_plan', {});
  const [pantry, setPantry] = usePersistentState('matkon_pantry', []);
  // מכשיר שנרשם פעם מקישור הזמנה נשאר מכשיר של משתמש מוזמן, גם אחרי יציאה
  const [guestDevice, setGuestDevice] = usePersistentState('matkon_guest', false);
  // מכשיר של בעל האפליקציה שנכנס עם סיסמת הבעלים / חשבון הגוגל שלו (כשהספר נעול)
  const [ownerDevice, setOwnerDevice] = usePersistentState('matkon_owner_device', false);
  const [auth, setAuth] = useState(() => {
    // קישור הזמנה/הצטרפות במכשיר שכבר מחובר: שואלים אם לצאת ולהמשך (ולא מתעלמים בשקט)
    if (AUTH_LINK && ['register', 'join'].includes(AUTH_LINK.mode) && session) return { mode: 'switch', link: AUTH_LINK };
    if (AUTH_LINK) return AUTH_LINK;
    return guestDevice && !session ? { mode: 'login' } : null;
  });
  const [paywall, setPaywall] = useState(null);
  const [paymentUrl, setPaymentUrl] = useState('');
  // קישורים שמתווספים ברקע (נשמר במכשיר – ממשיכים לעקוב גם אחרי שהאפליקציה נסגרה ונפתחה)
  const [pending, setPending] = usePersistentState('matkon_pending', []);
  const [nav, setNav] = useState(route);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const [favorites, setFavorites] = useState(false);
  // תמונות שצולמו מהמסך הראשי ("צילום מתכון"), עוברות למסך בניית המתכון
  const [photoFiles, setPhotoFiles] = useState(null);
  const takePhotos = (files) => {
    setPhotoFiles(files);
    window.location.hash = '#/new';
  };
  const [sort, setSort] = usePersistentState('matkon_sort', 'new');
  // קטגוריות שהמשתמש הוסיף (הקבועות ב-lib/categories)
  const [custom, setCustom] = usePersistentState('matkon_custom_categories', []);
  // סדר הקטגוריות ומועדפות (נשמר בשרת לכל הספר)
  const [categoryPrefs, setCategoryPrefsState] = usePersistentState('matkon_category_prefs', { order: [], favorites: [] });
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');

  const isOwner = !session || ownerDevice;

  // רשימות משותפות: נשמרות בשרת פריט-פריט
  const same = useCallback((x) => x, []);
  const syncError = useCallback((what) => (e) => setToast(`${what} לא נשמר${what === 'רשימת הקניות' ? 'ה' : ''}: ${e.message}`), []);
  const shoppingSync = useSyncedList({
    value: shopping, setValue: setShopping, toItems: same, fromItems: same, syncKey: 'matkon_shopping_synced',
    send: useCallback((ops) => shoppingOps(session, ops), [session]), onError: useMemo(() => syncError('רשימת הקניות'), [syncError]),
  });
  const pantrySync = useSyncedList({
    value: pantry, setValue: setPantry, toItems: same, fromItems: same, syncKey: 'matkon_pantry_synced',
    send: useCallback((ops) => pantryOps(session, ops), [session]), onError: useMemo(() => syncError('המלאי'), [syncError]),
  });
  const planSync = useSyncedList({
    value: plan, setValue: setPlan, toItems: planToItems, fromItems: itemsToPlan, syncKey: 'matkon_plan_synced',
    send: useCallback((ops) => planOps(session, ops), [session]), onError: useMemo(() => syncError('התכנון'), [syncError]),
  });

  // נתונים ששייכים לספר מסוים – נמחקים מהמכשיר ביציאה ובכניסה לחשבון אחר
  const clearBookCache = useCallback(() => {
    for (const sync of [shoppingSync, pantrySync, planSync]) sync.reset();
    setRecipes([]);
    setShopping([]);
    setPlan({});
    setPantry([]);
    setCustom([]);
    setCategoryPrefsState({ order: [], favorites: [] });
    setPending([]);
    navigator.serviceWorker?.controller?.postMessage('clear-user-caches');
    try {
      for (const k of Object.keys(localStorage)) {
        if (/^matkon_(factor|checked)_/.test(k) || k === 'matkon_fridge') localStorage.removeItem(k);
      }
    } catch {
      // אחסון חסום – אין מה לנקות
    }
  }, [shoppingSync, pantrySync, planSync, setRecipes, setShopping, setPlan, setPantry, setCustom, setPending]);

  const signOut = useCallback(() => {
    apiLogout(session);
    setSession('');
    setUser(null);
    setOwnerDevice(false);
    clearBookCache();
    setAuth({ mode: 'login' });
  }, [session, setSession, setUser, setOwnerDevice, clearBookCache]);

  const navigatedInApp = useRef(false);
  useEffect(() => {
    const onHash = () => {
      navigatedInApp.current = true;
      setNav(route());
    };
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
      if (session && !ownerDevice) {
        setUser(me.user);
        setPaymentUrl(me.paymentUrl);
      }
      setCustom((me.categories || []).filter((c) => !CATEGORIES.includes(c)));
      if (me.categoryPrefs) setCategoryPrefsState(me.categoryPrefs);
      setRecipes(await listRecipes(session));
      const started = Date.now();
      getShopping(session).then((v) => shoppingSync.loaded(v, started)).catch(() => {});
      getPlan(session).then((v) => planSync.loaded(v, started)).catch(() => {});
      getPantry(session)
        .then((items) => {
          pantrySync.loaded(items, started);
          // מעבר חד פעמי: מה שנכתב פעם ב"מה יש במקרר" (רק במכשיר הזה) עובר למלאי בשרת
          const old = loadJson('matkon_fridge', []);
          if (!items.length && old.length) {
            pantrySync.change(mergePantry([], old.map((name) => ({ name, place: 'fridge' }))));
            saveJson('matkon_fridge', []);
          }
        })
        .catch(() => {});
      setLoadError('');
    } catch (e) {
      if (e.status === 401) signOut();
      else setLoadError(e.message);
    }
  }, [auth, session, ownerDevice, setUser, setRecipes, setCustom, signOut, shoppingSync.loaded, planSync.loaded, pantrySync]);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveShopping = shoppingSync.change;
  const savePantry = pantrySync.change;
  const savePlan = useCallback(
    (next) => planSync.change((current) => prunePlan(typeof next === 'function' ? next(current) : next)),
    [planSync],
  );

  // חזרה לאפליקציה: טוענים מחדש, כדי לראות מה בני המשפחה שינו בינתיים
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

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
        const job = await addRecipeAsync(session, url);
        setPending((p) => p.map((x) => (x.key === key ? { ...x, jobId: job.id } : x)));
      } catch (e) {
        setPending((p) => p.filter((x) => x.key !== key || e.status !== 402));
        if (e.status === 401) return signOut();
        if (e.status === 402) return setPaywall({ paymentUrl: e.data.paymentUrl || '' });
        setPending((p) => p.map((x) => (x.key === key ? { ...x, error: e.message } : x)));
      }
    },
    [session, user, paymentUrl, setPending, signOut],
  );

  // מעקב אחרי הוספות ברקע: כל 3 שניות בודקים מה הסתיים
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(() => {
    // בפתיחת האפליקציה: קישור שנשלח אבל לא קיבל מספר עבודה (נסגרה באמצע) – אפשר לנסות שוב
    setPending((p) => p.map((x) => (!x.jobId && !x.error ? { ...x, error: 'החיבור נקטע לפני שהקישור נשלח. נסו שוב.' } : x)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (auth) return undefined;
    let busy = false;
    const tick = async () => {
      if (busy) return; // בדיקה קודמת עוד רצה – לא מטפלים באותה עבודה פעמיים
      busy = true;
      try {
        await poll();
      } finally {
        busy = false;
      }
    };
    const poll = async () => {
      for (const item of pendingRef.current.filter((x) => x.jobId && !x.error)) {
        let job;
        try {
          job = await getJob(session, item.jobId);
        } catch (e) {
          if (e.status === 404) setPending((p) => p.map((x) => (x.key === item.key ? { ...x, error: 'העבודה לא נמצאה. נסו שוב.' } : x)));
          continue;
        }
        // מעל 10 דקות מאז שהעבודה התחילה לרוץ – מציגים שגיאה (עבודה שמחכה בתור אחרי אחרות לא נחשבת)
        const started = Date.parse(job.startedAt || '') || (job.status === 'pending' ? Date.now() : Number(String(item.key).split('-')[0]));
        if (job.status !== 'done' && job.status !== 'error' && Date.now() - started > 10 * 60 * 1000) {
          setPending((p) => p.map((x) => (x.key === item.key ? { ...x, error: 'זה לוקח יותר מדי זמן. נסו שוב.' } : x)));
          continue;
        }
        if (job.status === 'done') {
          try {
            upsert(await getRecipe(session, job.recipeId));
          } catch {
            // יופיע בטעינה הבאה
          }
          setPending((p) => p.filter((x) => x.key !== item.key));
          setToast(job.updated ? `"${job.title}" עודכן` : `"${job.title}" נוסף ל${job.category}`);
          if (session && !ownerDevice) getMe(session).then((me) => me.user && setUser(me.user)).catch(() => {});
        } else if (job.status === 'error') {
          if (job.code === 402) setPaywall({ paymentUrl });
          setPending((p) => p.map((x) => (x.key === item.key ? { ...x, error: job.error } : x)));
        }
      }
    };
    tick();
    const t = setInterval(tick, 3000);
    return () => clearInterval(t);
  }, [auth, session, ownerDevice, paymentUrl, upsert, setUser, setPending]);

  // מתכון כטקסט (שיתוף בלי קישור)
  const addSharedText = useCallback(async (text) => {
    setToast('מסדר מתכון מהטקסט ששותף…');
    try {
      const { recipe, user: updatedUser } = await addTextRecipe(session, { text });
      upsert(safeRecipe(recipe));
      if (updatedUser) setUser(updatedUser);
      setToast(`"${recipe.title}" נוסף ל${recipe.category}`);
    } catch (e) {
      if (e.status === 402) setPaywall({ paymentUrl: e.data.paymentUrl || '' });
      else setToast(e.message);
    }
  }, [session, upsert, setUser]);

  // שיתוף לאפליקציה: מהאפליקציה עצמה – מתווסף מיד; מקישור בכתובת – רק באישור
  const [sharedOffer, setSharedOffer] = useState(null);
  useEffect(() => {
    if (auth) return;
    takeShared().then((shared) => {
      if (!shared) return;
      if (!shared.trusted) setSharedOffer(shared);
      else if (shared.link) add(shared.link);
      else if (shared.text.trim().length >= 20) addSharedText(shared.text);
    });
  }, [auth]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (id) => {
    window.location.hash = id ? `#/r/${id}` : '';
  };
  // חזרה: אחורה בהיסטוריה רק אם עברנו בין מסכים בתוך האפליקציה; אחרת למסך הבית (ולא החוצה מהאפליקציה)
  const back = () => (navigatedInApp.current ? window.history.back() : open(null));

  const counts = useMemo(() => countByCategory(recipes), [recipes]);
  const visible = useMemo(
    () => sortRecipes(filterRecipes(recipes, { query, category, favorites }), sort),
    [recipes, query, category, favorites, sort],
  );
  // כל הקטגוריות: הקבועות, אחריהן שלי, ו"אחר" בסוף
  const allCategories = [...CATEGORIES.filter((c) => c !== 'אחר'), ...custom, 'אחר'];
  const orderedCategories = orderCategories(allCategories, categoryPrefs);
  const favoriteCategories = orderedCategories.filter((c) => categoryPrefs.favorites?.includes(c));
  // קיצורי דרך במסך הבית: כל הקטגוריות המועדפות שיש בהן מתכונים (השורה יורדת שורה כשצריך)
  const shortcuts = favoriteCategories.filter((c) => counts[c]);
  const saveCategoryPrefs = (next) => {
    const prev = categoryPrefs;
    setCategoryPrefsState(next);
    setCategoryPrefs(session, next).catch((e) => {
      setCategoryPrefsState(prev);
      setToast(`הסדר לא נשמר: ${e.message}`);
    });
  };
  const current = nav.view === 'recipe' && recipes.find((r) => r.id === nav.id);
  const left = freeLeft(user);

  if (auth?.mode === 'switch') {
    return (
      <SwitchAccount
        name={ownerDevice ? 'בעל האפליקציה' : user?.name || user?.email || ''}
        join={auth.link.mode === 'join'}
        onContinue={() => {
          apiLogout(session);
          setSession('');
          setUser(null);
          setOwnerDevice(false);
          clearBookCache();
          setAuth(auth.link);
        }}
        onCancel={() => setAuth(null)}
      />
    );
  }

  if (auth) {
    return (
      <Auth
        mode={auth.mode}
        token={auth.token}
        onDone={({ session: s, user: u, owner }) => {
          clearBookCache();
          setUser(u);
          setSession(s);
          setOwnerDevice(Boolean(owner));
          setGuestDevice(!owner);
          setAuth(null);
        }}
      />
    );
  }

  if (nav.view === 'invites' && isOwner) return <InvitesView onBack={back} />;
  if (nav.view === 'privacy') return <PrivacyView onBack={back} />;
  if (nav.view === 'categories') {
    return (
      <>
        <CategoriesView
          categories={orderedCategories}
          custom={custom}
          favorites={categoryPrefs.favorites || []}
          onToggleFavorite={(c) => {
            const favs = categoryPrefs.favorites || [];
            saveCategoryPrefs({ ...categoryPrefs, favorites: favs.includes(c) ? favs.filter((x) => x !== c) : [...favs, c] });
          }}
          onReorder={(shown) => {
            // הסדר החדש של מה שמוצג, ואחריו שאר הקטגוריות בסדר שהיה
            saveCategoryPrefs({ ...categoryPrefs, order: [...shown, ...orderedCategories.filter((c) => !shown.includes(c))] });
          }}
          counts={counts}
          recipes={recipes}
          active={category}
          onBack={back}
          onPick={(c) => {
            setCategory(c);
            setFavorites(false);
            back();
          }}
          onAdd={async (name) => {
            setCustom(await addCategory(session, name));
            setToast(`הקטגוריה "${name}" נוספה. בדף מתכון אפשר להעביר אליה מתכונים.`);
          }}
          onRemove={async (name) => {
            const res = await removeCategory(session, name);
            setCustom(res.custom);
            setRecipes((list) => list.map((r) => (r.category === name ? { ...r, category: 'אחר' } : r)));
            if (category === name) setCategory(null);
          }}
        />
        {toast && <Toast text={toast} />}
      </>
    );
  }
  if (nav.view === 'help') {
    return (
      <HelpView
        playing={nav.play}
        onBack={() => open(null)}
        onClose={() => (navigatedInApp.current ? window.history.back() : window.location.replace('#/help'))}
      />
    );
  }
  if (nav.view === 'admin' && isOwner) return <AdminView onBack={back} />;
  if (nav.view === 'share') return <ShareView session={session} user={ownerDevice ? null : user} onBack={back} />;

  const openShopping = shopping.filter((i) => !i.checked).length;

  if (nav.view === 'shopping') {
    return (
      <>
        <ShoppingView session={session} items={shopping} onChange={saveShopping} onBack={() => open(null)} onToast={setToast} />
        {toast && <Toast text={toast} />}
        <BottomNav view="shopping" shoppingCount={openShopping} onPhotos={takePhotos} />
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
        <BottomNav view="plan" shoppingCount={openShopping} onPhotos={takePhotos} />
      </>
    );
  }

  if (nav.view === 'settings') {
    return (
      <>
        <SettingsView
          session={session}
          isOwner={isOwner}
          user={ownerDevice ? null : user}
          recipes={recipes}
          custom={custom}
          shopping={shopping}
          plan={plan}
          pantry={pantry}
          onRestored={reload}
          onAddLinks={(links) => {
            links.forEach((link) => add(link));
            setToast(`${links.length} מתכונים מושלמים מהמקור ברקע`);
            open(null);
          }}
          onSignedOut={signOut}
          onBack={() => open(null)}
          onToast={setToast}
        />
        {toast && <Toast text={toast} />}
      </>
    );
  }

  if (nav.view === 'search') {
    const savedUrls = savedUrlSet(recipes);
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
        {paywall && <Paywall user={user} paymentUrl={paywall.paymentUrl} onClose={() => setPaywall(null)} />}
        <InventoryView
          key={nav.place || 'home'}
          place={nav.place}
          session={session}
          recipes={recipes}
          pantry={pantry}
          onChange={savePantry}
          savedUrls={savedUrlSet(recipes)}
          onAdd={(url, title) => {
            add(url);
            setToast(`"${title}" נכנס לספר – מסדר מתכון ברקע`);
          }}
          onAddToShopping={(recipe, lines) => {
            const { list, added } = shoppingWith(shopping, recipe, lines);
            saveShopping(list);
            setToast(added ? `נוספו ${added} מצרכים לרשימת הקניות` : 'המצרכים כבר ברשימה');
          }}
          onToast={setToast}
          onPaywall={(url) => setPaywall({ paymentUrl: url || paymentUrl })}
        />
        {toast && <Toast text={toast} />}
        <BottomNav view="fridge" shoppingCount={openShopping} onPhotos={takePhotos} />
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
        pantryNames={pantry.map((i) => i.name)}
        categories={allCategories}
        onBack={back}
        onUpdate={async (patch) => {
          upsert({ ...current, ...patch });
          try {
            upsert(await updateRecipe(session, current.id, patch));
          } catch (e) {
            setToast(e.message);
            reload();
            throw e; // העורך נשאר פתוח עם הטקסט, כדי שלא יאבד
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
              {session && (
                <button onClick={signOut} className="p-2 rounded-full hover:bg-white/15" aria-label="יציאה" title="יציאה">
                  <LogOut size={20} />
                </button>
              )}
            </div>
          </div>
          <AddLink onAdd={add} onSearch={(q) => { window.location.hash = `#/search?q=${encodeURIComponent(q)}`; }} />
          {/* עוד דרכים להוסיף מתכון */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-medium">
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
        {sharedOffer && (
          <div className="mt-4 rounded-2xl bg-white shadow-sm p-3 border border-orange-200">
            <div className="font-bold">להוסיף לספר את מה ששותף?</div>
            <div className="text-sm text-stone-600 mt-1 line-clamp-2 break-all" dir="auto">{sharedOffer.link || sharedOffer.text}</div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  if (sharedOffer.link) add(sharedOffer.link);
                  else addSharedText(sharedOffer.text);
                  setSharedOffer(null);
                }}
                className="rounded-xl bg-orange-500 text-white font-bold px-4 py-2"
              >
                הוספה
              </button>
              <button onClick={() => setSharedOffer(null)} className="rounded-xl bg-stone-100 px-4 py-2">לא, תודה</button>
            </div>
          </div>
        )}
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
                placeholder="חיפוש לפי שם או מצרך"
                className="w-full rounded-2xl border border-stone-200 bg-white py-3 pr-10 pl-10 outline-none focus:border-orange-400"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-label="ניקוי">
                  <X size={18} />
                </button>
              )}
            </div>

            {/* שורה אחת קצרה: קטגוריות (מסך משלהן, וגם סרטוני ההדרכה שם), הכל, מועדפים */}
            <div className="mt-3 flex flex-wrap gap-2">
              {category && !shortcuts.includes(category) ? (
                <span className="rounded-full bg-orange-500 border border-orange-500 text-white text-sm flex items-center">
                  <a href="#/categories" className="pr-3.5 pl-1 py-1.5">{emojiOf(category)} {category} <span className="opacity-70">{counts[category] || 0}</span></a>
                  <button onClick={() => setCategory(null)} className="pl-2.5 pr-1 py-1.5" aria-label="ביטול הסינון לפי קטגוריה"><X size={15} /></button>
                </span>
              ) : (
                <a href="#/categories" className="rounded-full px-3.5 py-1.5 text-sm border bg-white border-stone-200 text-stone-700">
                  📂 קטגוריות
                </a>
              )}
              <Chip active={!category && !favorites} onClick={() => { setCategory(null); setFavorites(false); }}>
                הכל <span className="opacity-60">{recipes.length}</span>
              </Chip>
              <Chip active={favorites} onClick={() => setFavorites((f) => !f)}>
                <Heart size={14} className="inline -mt-0.5" fill={favorites ? 'currentColor' : 'none'} /> מתכונים מועדפים
              </Chip>
              {shortcuts.map((c) => (
                <Chip key={c} active={category === c} onClick={() => { setCategory(category === c ? null : c); setFavorites(false); }}>
                  {emojiOf(c)} {c}
                </Chip>
              ))}
            </div>

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
      <BottomNav view="home" shoppingCount={openShopping} onPhotos={takePhotos} />
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
      <a href="#/help" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-orange-100 text-orange-800 font-bold px-5 py-3">
        🎬 סרטוני הדרכה
      </a>
    </div>
  );
}

// הקישורים שכבר בספר (כדי לסמן "נוסף" בתוצאות חיפוש)
function savedUrlSet(recipes) {
  return new Set(recipes.map((r) => {
    try {
      const u = new URL(r.source?.url);
      return u.hostname.replace(/^(www|m)\./, '') + u.pathname.replace(/\/+$/, '');
    } catch {
      return '';
    }
  }));
}

// פתחו קישור הזמנה/הצטרפות במכשיר שכבר מחובר לחשבון אחר
function SwitchAccount({ name, join, onContinue, onCancel }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-orange-50 to-amber-50">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm p-6 text-center">
        <img src="icon.svg" alt="" className="w-14 h-14 mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2">{join ? 'הצטרפות לספר משותף' : 'הרשמה עם קישור הזמנה'}</h1>
        <p className="text-stone-600 leading-relaxed mb-5">
          המכשיר הזה מחובר כרגע{name ? ` כ-${name}` : ''}. כדי {join ? 'להצטרף לספר' : 'להירשם'} צריך קודם לצאת מהחשבון הנוכחי.
          הספר הנוכחי לא נמחק, ואפשר לחזור אליו בכניסה.
        </p>
        <button onClick={onContinue} className="w-full rounded-2xl bg-orange-500 text-white font-bold py-3">יציאה והמשך</button>
        <button onClick={onCancel} className="w-full mt-2 rounded-2xl bg-stone-100 font-medium py-3">ביטול</button>
      </div>
    </div>
  );
}
