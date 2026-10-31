import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, Globe, Mic, Heart, Loader2, LogOut, PenLine, Search, Settings, X } from 'lucide-react';
import SearchView from './components/SearchView';
import DietFilter from './components/DietFilter';
import SettingsView from './components/SettingsView';
import { shoppingName } from './lib/shopping';
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
import SharedRecipe from './components/SharedRecipe';
import UpdateBanner from './components/UpdateBanner';
import AppInvite from './components/AppInvite';
import PrivacyView from './components/PrivacyView';
import AdminView from './components/AdminView';
import HelpView from './components/HelpView';
import CategoriesView from './components/CategoriesView';
import Paywall from './components/Paywall';
import PendingList from './components/PendingList';
import RecipeCard from './components/RecipeCard';
import RecipeView from './components/RecipeView';
import { CATEGORIES } from './lib/categories';
import { isNative } from './lib/native';
import {
  addCategory, setCategoryPrefs, addRecipeAsync, addTextRecipe, getJob, getRecipe, deleteRecipe, removeCategory, getMe, getPlan, getShopping, listRecipes, logout as apiLogout, refreshRecipe,
  updateRecipe, categorizeRecipe, estimateNutrition, getProfile, setProfile, publishRecipe, unpublishRecipe, safeRecipe, searchCommunity, substituteIngredient, talkApi, getPantry, shoppingOps, pantryOps, planOps, shareRecipe, recipeShareLink,
} from './lib/api';
import { SORTS, categoriesOf, countByCategory, emojiOf, filterRecipes, freeLeft, linkFromShare, orderCategories, parseAuthHash, parseShareLink, sortRecipes } from './lib/recipes';
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
      return { link: linkFromShare(`?${new URLSearchParams(data)}`), text: data.text || '' };
    } catch {
      return null;
    }
  }
  const link = linkFromShare(params.toString() ? `?${params}` : '');
  const text = params.get('text') || '';
  return link || text ? { link, text } : null;
}

const AUTH_LINK = takeAuthLink();

// מתכון ששותף בקישור (#recipe=...). נלקח מהכתובת ונמחק ממנה מיד
function takeShareLink() {
  const token = parseShareLink(window.location.hash);
  if (token) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return token;
}
const SHARE_LINK = takeShareLink();

const route = () => {
  const h = window.location.hash;
  if (h === '#/invites') return { view: 'invites' };
  if (h === '#/share') return { view: 'share' };
  if (h === '#/privacy') return { view: 'privacy' };
  if (h === '#/admin') return { view: 'admin' };
  if (h === '#/categories') return { view: 'categories' };
  if (h === '#/help' || h.startsWith('#/help/')) return { view: 'help', play: h.slice(7) };
  if (h === '#/shopping') return { view: 'shopping' };
  if (h.startsWith('#/new')) return { view: 'new', mode: h.includes('manual') ? 'manual' : h.includes('voice') ? 'voice' : 'photo' };
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
  // שיחה על מתכונים בקהילה (טיפים, "הכנתי!") – אותו אובייקט כל עוד ה-session לא השתנה
  const talk = useMemo(() => talkApi(session), [session]);
  // סינון לפי כשרות / רגישויות / תזונה – נשמר במכשיר (מי שצליאקי רוצה אותו תמיד)
  const [diets, setDiets] = usePersistentState('matkon_diets', []);
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
  // מתכון מהקהילה שנפתח מתוך החיפוש
  const [communityOpen, setCommunityOpen] = useState(null);
  // מתכון ששלחו לי בקישור: נשמר במכשיר עד שמחליטים, כדי שיחכה גם אחרי הרשמה (login: המשתמש ביקש להיכנס)
  const [incoming, setIncoming] = usePersistentState('matkon_incoming_share', SHARE_LINK ? { token: SHARE_LINK } : null);
  useEffect(() => {
    if (SHARE_LINK) setIncoming({ token: SHARE_LINK });
  }, [setIncoming]);
  // באפליקציה לאנדרואיד: קישור matkon://recipe/... (הכפתור "פתיחה באפליקציה" באתר)
  useEffect(() => {
    if (!isNative()) return undefined;
    let alive = true;
    let handle;
    // קישור שהאפליקציה נפתחה ממנו נשאר גם כשהיא נפתחת מחדש – מתכון שכבר טופל לא מוצג שוב
    const take = (link, launch) => {
      const token = parseShareLink(link);
      if (token && alive && !(launch && token === loadJson('matkon_share_done', ''))) setIncoming({ token });
    };
    import('@capacitor/core')
      .then(({ registerPlugin }) => {
        const app = registerPlugin('App');
        app.getLaunchUrl().then((r) => take(r?.url, true)).catch(() => {});
        return app.addListener('appUrlOpen', (e) => take(e.url));
      })
      .then((h) => {
        if (alive) handle = h;
        else h.remove();
      })
      .catch(() => {});
    return () => {
      alive = false;
      handle?.remove();
    };
  }, [setIncoming]);
  const [toast, setToast] = useState('');

  const isOwner = !session || ownerDevice;

  // רשימות משותפות: נשמרות בשרת פריט-פריט
  const same = useCallback((x) => x, []);
  // הורדת מתכון מקטגוריה אחת – הוא נשאר בשאר הקטגוריות שלו
  const removeFromCategory = async (recipe, cat) => {
    const next = categoriesOf(recipe).filter((c) => c !== cat);
    if (!next.length || !window.confirm(`להוריד את "${recipe.title}" מ${cat}?\nהמתכון יישאר ב${next.join(', ')}.`)) return;
    const patch = { category: next[0], categories: next };
    upsert({ ...recipe, ...patch });
    try {
      upsert(await updateRecipe(session, recipe.id, patch));
      setToast(`"${recipe.title}" הורד מ${cat}`);
    } catch (e) {
      upsert(recipe);
      setToast(e.message);
    }
  };
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
      setCommunityOpen(null);
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

  // מצרכים של מתכון לרשימת הקניות: רק שם המוצר, בלי כמות ("4 ביצים" → "ביצים"), ובלי כפילויות של פריטים פתוחים
  const shoppingWith = (list, recipe, lines) => {
    const key = (t) => t.trim().toLowerCase();
    const have = new Set(list.filter((i) => !i.checked).map((i) => key(i.text)));
    const fresh = [];
    for (const name of lines.map(shoppingName)) {
      if (have.has(key(name))) continue;
      have.add(key(name));
      fresh.push(name);
    }
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
      const { recipe, user: updatedUser, more = [] } = await addTextRecipe(session, { text });
      for (const r of more) upsert(safeRecipe(r));
      upsert(safeRecipe(recipe));
      if (updatedUser) setUser(updatedUser);
      setToast(more.length ? `נוספו ${more.length + 1} מתכונים: ${[recipe, ...more].map((r) => r.title).join(', ')}` : `"${recipe.title}" נוסף ל${recipe.category}`);
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
      // תמיד באישור: גם "שיתוף" דרך ה-service worker יכול להגיע מאתר זר (טופס שנשלח לכתובת השיתוף)
      if (shared?.link || shared?.text?.trim().length >= 20) setSharedOffer(shared);
    });
  }, [auth]); // eslint-disable-line react-hooks/exhaustive-deps

  // שיתוף מאפליקציה אחרת באפליקציה מהחנות (ShareTarget ב-mat_kon/mobile) – גם כאן רק באישור
  useEffect(() => {
    if (auth || !isNative()) return undefined;
    let alive = true;
    let handle;
    const take = async () => {
      const { registerPlugin } = await import('@capacitor/core');
      const { share } = await registerPlugin('ShareTarget').take();
      if (!alive || !share) return;
      const link = linkFromShare(`?${new URLSearchParams({ text: share.text || '', title: share.title || '' })}`);
      if (link || (share.text || '').trim().length >= 20) setSharedOffer({ link, text: share.text || '' });
    };
    take().catch(() => {});
    import('@capacitor/core')
      .then(({ registerPlugin }) => registerPlugin('ShareTarget').addListener('share', () => { take().catch(() => {}); }))
      .then((h) => {
        if (alive) handle = h;
        else h.remove();
      })
      .catch(() => {});
    return () => {
      alive = false;
      handle?.remove();
    };
  }, [auth]);

  const open = (id) => {
    window.location.hash = id ? `#/r/${id}` : '';
  };
  // חזרה: אחורה בהיסטוריה רק אם עברנו בין מסכים בתוך האפליקציה; אחרת למסך הבית (ולא החוצה מהאפליקציה)
  const back = () => (navigatedInApp.current ? window.history.back() : open(null));

  const counts = useMemo(() => countByCategory(recipes), [recipes]);
  const visible = useMemo(
    () => sortRecipes(filterRecipes(recipes, { query, category, favorites, diets: Array.isArray(diets) ? diets : [] }), sort),
    [recipes, query, category, favorites, diets, sort],
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

  // מתכון ששלחו לי: קודם הוא (גם לפני מסך הכניסה – תצוגה מקדימה), אלא אם ביקשו להיכנס כדי לראות אותו
  if (incoming && !(auth && incoming.login) && auth?.mode !== 'switch') {
    return (
      <>
        {paywall && <Paywall user={user} paymentUrl={paywall.paymentUrl} onClose={() => setPaywall(null)} />}
        <SharedRecipe
          token={incoming.token}
          session={session}
          onLogin={() => {
            setIncoming({ ...incoming, login: true });
            setAuth((a) => a || { mode: 'login' });
          }}
          onClose={() => {
            saveJson('matkon_share_done', incoming.token);
            setIncoming(null);
          }}
          onSaved={(data) => {
            if (data.user && session && !ownerDevice) setUser(data.user);
            upsert(safeRecipe(data.recipe));
            saveJson('matkon_share_done', incoming.token);
            setIncoming(null);
            setToast(data.updated ? 'המתכון כבר היה בספר שלך' : 'המתכון נשמר בספר שלך');
            open(data.recipe.id);
          }}
          onPaywall={(url) => setPaywall({ paymentUrl: url || paymentUrl })}
        />
      </>
    );
  }

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
          onCategorize={async (r) => upsert(safeRecipe(await categorizeRecipe(session, r.id)))}
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
            setRecipes((list) => list.map((r) => {
              const cats = categoriesOf(r);
              if (!cats.includes(name)) return r;
              const left = cats.filter((c) => c !== name);
              return left.length ? { ...r, category: left[0], categories: left } : { ...r, category: 'אחר', categories: ['אחר'] };
            }));
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

  // מתכון מהקהילה (מהחיפוש, או מהמתכונים הפופולריים בספר ריק)
  if ((nav.view === 'search' || nav.view === 'home') && communityOpen) {
    return (
      <>
        {paywall && <Paywall user={user} paymentUrl={paywall.paymentUrl} onClose={() => setPaywall(null)} />}
        <SharedRecipe
          communityKey={communityOpen.key}
          session={session}
          onClose={() => setCommunityOpen(null)}
          onSaved={(data) => {
            if (data.user && session && !ownerDevice) setUser(data.user);
            upsert(safeRecipe(data.recipe));
            setCommunityOpen(null);
            setToast(data.updated ? 'המתכון כבר היה בספר שלך' : 'המתכון נשמר בספר שלך');
            open(data.recipe.id);
          }}
          onPaywall={(url) => setPaywall({ paymentUrl: url || paymentUrl })}
        />
      </>
    );
  }
  if (nav.view === 'search') {
    const savedUrls = savedUrlSet(recipes);
    return (
      <>
        {paywall && <Paywall user={user} paymentUrl={paywall.paymentUrl} onClose={() => setPaywall(null)} />}
        <SearchView
          onOpenCommunity={setCommunityOpen}
          diets={Array.isArray(diets) ? diets : []}
          onDiets={setDiets}
          key={nav.q}
          session={session}
          initialQuery={nav.q}
          savedUrls={savedUrls}
          ownKeys={ownCommunityKeys(recipes)}
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
          onSaved={(recipe, updatedUser, more = []) => {
            // כמה מתכונים באותו צילום – כולם נוספו, ופותחים את הראשון
            for (const r of more) upsert(safeRecipe(r));
            upsert(recipe);
            if (updatedUser) setUser(updatedUser);
            if (more.length) setToast(`מהצילום נוצרו ${more.length + 1} מתכונים: ${[recipe, ...more].map((r) => r.title).join(', ')}`);
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
        onShareLink={async () => recipeShareLink(await shareRecipe(session, current.id))}
        onEstimateNutrition={async () => upsert(await estimateNutrition(session, current.id))}
        onSubstitute={(item) => substituteIngredient(session, current.id, item, Array.isArray(diets) ? diets : [])}
        bis={Boolean(user?.features?.bis)}
        community={{
          talk,
          getProfile: () => getProfile(session),
          setProfile: (name, terms) => setProfile(session, name, terms),
          publish: async (id) => {
            const res = await publishRecipe(session, id);
            upsert(safeRecipe(res.recipe));
            return res;
          },
          unpublish: async (id) => upsert(safeRecipe((await unpublishRecipe(session, id)).recipe)),
        }}
        onUpdate={async (patch) => {
          upsert({ ...current, ...patch });
          try {
            upsert(await updateRecipe(session, current.id, patch));
            // המצרכים השתנו: ההערכה התזונתית נמחקה בשרת – מחשבים מחדש ברקע (רק אם הייתה כזו)
            if (('ingredients' in patch || 'servings' in patch) && current.nutrition) {
              estimateNutrition(session, current.id).then(upsert).catch(() => {});
            }
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
          <UpdateBanner />
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
          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs font-medium">
            <a href="#/new?manual" className="rounded-2xl bg-white/15 hover:bg-white/25 py-2.5 flex flex-col items-center gap-1">
              <PenLine size={20} /> כתיבה ידנית
            </a>
            <a href="#/new?voice" className="rounded-2xl bg-white/15 hover:bg-white/25 py-2.5 flex flex-col items-center gap-1">
              <Mic size={20} /> בהקלטה
            </a>
            <a href="#/search" className="rounded-2xl bg-white/15 hover:bg-white/25 py-2.5 flex flex-col items-center gap-1">
              <Globe size={20} /> חיפוש מתכון
            </a>
            <a href="#/import" className="rounded-2xl bg-white/15 hover:bg-white/25 py-2.5 flex flex-col items-center gap-1">
              <FileUp size={20} /> מקובץ / ווטסאפ
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
        <AppInvite user={ownerDevice ? null : user} />
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
              <DietFilter value={Array.isArray(diets) ? diets : []} onChange={setDiets} />
            </div>

            <div className="mt-2 flex items-center justify-end gap-1 text-sm text-stone-500">
              מיון:
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-transparent font-medium text-stone-700 outline-none">
                {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </>
        )}

        {recipes.length === 0 && !pending.length && !loadError && <Empty session={session} onOpenCommunity={setCommunityOpen} />}

        {recipes.length > 0 && visible.length === 0 && (
          <p className="text-center text-stone-500 mt-10">
            לא נמצאו מתכונים
            {Array.isArray(diets) && diets.length > 0 && <button onClick={() => setDiets([])} className="block mx-auto mt-2 text-orange-700 underline">ביטול הסינון (כשר, ללא גלוטן…)</button>}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {visible.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              onOpen={() => open(r.id)}
              // בתוך קטגוריה: מתכון שנמצא בכמה קטגוריות אפשר להוריד מהקטגוריה הזו בלבד
              removeFrom={category && categoriesOf(r).length > 1 && categoriesOf(r).includes(category) ? category : null}
              onRemoveFrom={() => removeFromCategory(r, category)}
            />
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

// ספר ריק (משתמש חדש): מתכונים פופולריים מהקהילה לשמירה בלחיצה, ודרכים ברורות להוסיף מתכון
function Empty({ session, onOpenCommunity }) {
  const [popular, setPopular] = useState(null);
  useEffect(() => {
    let alive = true;
    searchCommunity(session, '', {})
      .then((list) => alive && setPopular(list.slice(0, 6)))
      .catch(() => alive && setPopular([]));
    return () => {
      alive = false;
    };
  }, [session]);
  const ways = [
    ['#/search', '🔎', 'חיפוש מתכון', 'כותבים שם של מנה'],
    ['#/new', '📷', 'צילום מתכון', 'דף מספר או פתק'],
    ['#/import', '📄', 'מקובץ', 'Word, PDF, ווטסאפ'],
  ];
  return (
    <div className="mt-6">
      <div className="text-center px-4 text-stone-600">
        <div className="text-5xl mb-2">🍳</div>
        <h2 className="text-xl font-bold text-stone-800">בואו נמלא את הספר שלכם</h2>
        <p className="mt-1 leading-relaxed">מדביקים למעלה קישור מכל אתר, יוטיוב, טיקטוק או אינסטגרם – או בוחרים דרך אחרת:</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {ways.map(([href, emoji, title, sub]) => (
          <a key={href} href={href} className="rounded-2xl bg-white shadow-sm p-3 text-center hover:shadow">
            <div className="text-2xl">{emoji}</div>
            <div className="font-bold text-stone-800 text-sm mt-1">{title}</div>
            <div className="text-xs text-stone-500">{sub}</div>
          </a>
        ))}
      </div>

      {(popular === null || popular.length > 0) && (
        <>
          <h3 className="mt-7 mb-1 font-black text-stone-900 flex items-center gap-2">⭐ פופולרי בקהילה</h3>
          <p className="text-sm text-stone-500 mb-3">מתכונים שמשתמשים אחרים שמרו ואהבו. לוחצים – ושומרים בספר שלכם.</p>
          {popular === null ? (
            <div className="py-6 flex justify-center text-stone-400"><Loader2 className="animate-spin" size={22} /></div>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {popular.map((r) => (
                <li key={r.key}>
                  <button onClick={() => onOpenCommunity(r)} className="w-full text-right rounded-2xl bg-white shadow-sm overflow-hidden hover:shadow">
                    {r.image ? (
                      <img src={r.image} alt="" loading="lazy" className="w-full aspect-[4/3] object-cover bg-stone-100" />
                    ) : (
                      <div className="w-full aspect-[4/3] bg-orange-50 flex items-center justify-center text-3xl">🍽️</div>
                    )}
                    <div className="p-2">
                      <div className="font-bold text-sm text-stone-900 leading-snug line-clamp-2">{r.title}</div>
                      <div className="mt-1 text-xs text-stone-500 flex flex-wrap gap-x-2">
                        {r.rating ? <span>⭐ {r.rating}</span> : null}
                        <span>נשמר ב-{r.saves} {r.saves === 1 ? 'ספר' : 'ספרים'}</span>
                        {r.madeCount > 0 && <span>📸 {r.madeCount}</span>}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <a href="#/search" className="mt-3 block text-center text-orange-700 font-medium">עוד מתכונים מהקהילה ←</a>
        </>
      )}

      <div className="text-center mt-6">
        <a href="#/help" className="inline-flex items-center gap-2 rounded-2xl bg-orange-100 text-orange-800 font-bold px-5 py-3">
          🎬 סרטוני הדרכה
        </a>
      </div>
    </div>
  );
}

// מתכונים מהקהילה שכבר שלי: שפרסמתי (published), או עותק ששמרתי מהקהילה (source.key = community:<key>)
function ownCommunityKeys(recipes) {
  const keys = new Set();
  for (const r of recipes) {
    if (r.published) keys.add(r.published);
    const k = r.source?.key;
    if (typeof k === 'string' && k.startsWith('community:')) keys.add(k.slice(10));
  }
  return keys;
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
