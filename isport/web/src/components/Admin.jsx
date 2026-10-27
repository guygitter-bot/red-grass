// מסך הניהול (#/admin, בסיסמה):
//   #/admin              רשימת המוצרים: חיפוש, קטגוריה, פרסום/הסתרה
//   #/admin/edit/<id>    עריכה (או new למוצר חדש): קטגוריה ופרטים בסיסיים -> "מלא אוטומטית" -> מאשרים תמונות -> שומרים
//   #/admin/settings     קטגוריות, וואטסאפ, אינסטגרם, הודעה בראש האתר
//   #/admin/import       ייבוא מערוץ טלגרם (ImportTelegram.jsx)
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Check, Eye, EyeOff, ImagePlus, Link2, LogOut, Plus, Search, Send, Settings, Sparkles, Star, Trash2, X } from 'lucide-react';
import { api, imageUrl, load, shrinkImage, store } from '../lib/api';
import { USD_ILS, money, monthCost, monthName } from '../lib/cost';
import { go } from '../lib/route';
import { DEFAULT_CATEGORIES, KIND_LABEL, TEMPLATES, autoCode, searchShirts, withCategories } from '../lib/shirt';
import { Chip, Field, ShirtImage, ThemeButton, TutorialVideo, inputClass } from './ui';
import Logo from './Logo';
import ImportTelegram from './ImportTelegram';

const TOKEN = 'isport_admin';
const MAX_IMAGES = 4;
// טיוטת עורך שנשמרת כשהחיבור פג באמצע עבודה (sessionStorage) וחוזרת אחרי כניסה מחדש
const DRAFT = 'isport_draft';
const DRAFT_MS = 24 * 60 * 60 * 1000;
const EXPIRED = 'החיבור פג – התחברו שוב';
const readDraft = (id) => {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT) || 'null');
    return d && d.id === id && Date.now() - d.at < DRAFT_MS ? d : null;
  } catch {
    return null;
  }
};
const writeDraft = (d) => {
  try {
    if (d) sessionStorage.setItem(DRAFT, JSON.stringify({ ...d, at: Date.now() }));
    else sessionStorage.removeItem(DRAFT);
  } catch {
    // לא נשמר
  }
};
// הודעה שעוברת לעורך אחרי שמוצר חדש נשמר (העורך נפתח מחדש עם המזהה שלה)
let flash = null;

export default function Admin({ route }) {
  const [token, setToken] = useState(() => load(TOKEN, ''));
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  // הודעה במסך הכניסה (למשל: החיבור פג) + מה שנשמר בעורך כשהחיבור נפל
  const [notice, setNotice] = useState('');
  const draftRef = useRef(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const call = async (path, body) => {
    const used = token;
    try {
      return await api(path, body, used);
    } catch (e) {
      // החיבור פג: שומרים את הטיוטה הפתוחה, מנקים הכול וחוזרים למסך הכניסה
      if (e.status === 401 && tokenRef.current === used && used) {
        if (draftRef.current) writeDraft(draftRef.current());
        store(TOKEN, null);
        tokenRef.current = '';
        setState(null);
        setNotice(EXPIRED);
        setToken('');
      }
      throw e;
    }
  };

  const refresh = () => {
    const used = token;
    return call('/admin/state')
      .then((s) => {
        // תשובה שהגיעה אחרי יציאה / החלפת משתמש – לא מציגים
        if (tokenRef.current !== used) return;
        setState(s);
        setError('');
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    if (token) refresh();
  }, [token]);

  // בכניסה להגדרות – נתונים עדכניים (העלויות משתנות אחרי כל השלמה אוטומטית)
  useEffect(() => {
    if (token && route[0] === 'settings') refresh();
  }, [route[0]]);

  useEffect(() => {
    const prev = document.title;
    document.title = 'ניהול – Isport';
    return () => {
      document.title = prev;
    };
  }, []);

  if (!token) {
    return (
      <Login
        notice={notice}
        onLogin={(t) => {
          store(TOKEN, t);
          tokenRef.current = t;
          setState(null);
          setNotice('');
          setToken(t);
        }}
      />
    );
  }

  const logout = async () => {
    await call('/logout').catch(() => {});
    writeDraft(null);
    store(TOKEN, null);
    tokenRef.current = '';
    setState(null);
    setNotice('');
    setToken('');
  };

  // עדכון מוצר אחד ברשימה בלי לטעון הכול מחדש
  const putShirt = (shirt) =>
    setState((s) => ({ ...s, shirts: [shirt, ...s.shirts.filter((x) => x.id !== shirt.id)].sort((a, b) => b.createdAt - a.createdAt) }));

  const categories = state?.categories || DEFAULT_CATEGORIES;
  let page;
  if (!state) page = (
      <div className="p-10 text-center text-muted">
        {error || 'טוען…'}
        {error && (
          <div className="mt-4">
            <button onClick={refresh} className="rounded-full bg-ink px-5 py-2.5 font-bold text-white dark:bg-lime dark:text-ink">נסו שוב</button>
          </div>
        )}
      </div>
    );
  else if (route[0] === 'edit') {
    const shirt = route[1] === 'new' ? null : state.shirts.find((s) => s.id === route[1]);
    page =
      route[1] !== 'new' && !shirt ? (
        <div className="p-10 text-center text-muted">המוצר לא נמצא</div>
      ) : (
        <Editor key={route[1]} shirt={shirt} categories={categories} call={call} imagesReady={state.images} draftRef={draftRef} onSaved={putShirt} onDeleted={refresh} />
      );
  } else if (route[0] === 'import') page = <ImportTelegram state={state} categories={categories} call={call} onSaved={putShirt} onLost={(text) => setNotice((n) => `${n ? `${n}\n` : ''}${text}`)} />;
  else if (route[0] === 'settings') page = <SettingsPage state={state} call={call} onSaved={(patch) => setState((s) => (s ? { ...s, ...patch } : s))} />;
  else page = <List state={state} categories={categories} call={call} onChange={putShirt} />;

  return (
    <div className="min-h-dvh pb-16">
      <header className="sticky top-0 z-30 bg-ink text-white" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <a href="#/admin" aria-label="ניהול">
            <Logo className="h-12" />
          </a>
          <span className="rounded-full bg-lime px-2 py-0.5 text-xs font-bold text-ink">ניהול</span>
          <div className="flex-1" />
          <a href="#/" className="rounded-full px-3 py-1.5 text-sm hover:bg-white/10">לאתר</a>
          <a href="#/admin/settings" className="rounded-full p-2 hover:bg-white/10" aria-label="הגדרות">
            <Settings size={20} />
          </a>
          <ThemeButton />
          <button onClick={logout} className="rounded-full p-2 hover:bg-white/10" aria-label="יציאה">
            <LogOut size={20} />
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 pt-5">{page}</div>
    </div>
  );
}

function Login({ onLogin, notice }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token } = await api('/login', { password });
      onLogin(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-ink px-4">
      <Logo className="h-36" />
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
        <h1 className="mb-4 text-center text-lg font-bold">כניסה לניהול</h1>
        {notice && <p className="mb-3 whitespace-pre-line rounded-xl bg-amber-400/20 p-3 text-sm text-amber-800 dark:text-amber-200">{notice}</p>}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="סיסמה"
          autoComplete="current-password"
          className={inputClass}
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button disabled={busy || !password} className="mt-4 w-full rounded-full bg-ink py-3 font-bold text-white disabled:opacity-50 dark:bg-lime dark:text-ink">
          {busy ? 'נכנס…' : 'כניסה'}
        </button>
        <a href="#/" className="mt-4 block text-center text-sm text-muted hover:underline">חזרה לאתר</a>
      </form>
    </div>
  );
}

// ---------- רשימת המוצרים ----------

function List({ state, categories, call, onChange }) {
  const [query, setQuery] = useState('');
  const [show, setShow] = useState('all');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [video, setVideo] = useState(false);
  const [cat, setCat] = useState('');

  const all = withCategories(state.shirts, categories);
  const list = searchShirts(all, query, { category: cat }).filter((s) => show === 'all' || (show === 'live' ? s.published : !s.published));
  const live = state.shirts.filter((s) => s.published).length;

  const toggle = async (s) => {
    setBusy(s.id);
    setError('');
    try {
      onChange((await call('/admin/publish', { id: s.id, published: !s.published })).shirt);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">המוצרים</h1>
          <p className="text-sm text-muted">
            {state.shirts.length} מוצרים · {live} באתר · {state.shirts.length - live} מוסתרים
          </p>
        </div>
        <div className="flex gap-2">
          <a href="#/admin/import" className="flex items-center gap-1.5 rounded-full px-4 py-2.5 font-bold ring-1 ring-line hover:bg-soft">
            <Send size={16} /> ייבוא מטלגרם
          </a>
          <a href={`#/admin/edit/new${cat ? `/${cat}` : ''}`} className="flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 font-bold text-white dark:bg-lime dark:text-ink">
            <Plus size={18} /> מוצר חדש
          </a>
        </div>
      </div>

      <button onClick={() => setVideo(!video)} className="mb-3 text-sm font-bold text-lime-ink hover:underline">
        🎬 {video ? 'סגירת הסרטון' : 'סרטון הדרכה: איך מוסיפים מוצר'}
      </button>
      {video && <TutorialVideo name="admin" className="mb-4" />}
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש לפי קבוצה, מותג, סוג, שנה, צבע או קוד" className={`${inputClass} pr-10`} />
      </div>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        <Chip active={!cat} onClick={() => setCat('')}>כל הקטגוריות</Chip>
        {categories.map((c) => (
          <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
            {c.name}
            {!c.active && ' (מוסתרת)'}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Chip small active={show === 'all'} onClick={() => setShow('all')}>הכול</Chip>
        <Chip small active={show === 'live'} onClick={() => setShow('live')}>באתר</Chip>
        <Chip small active={show === 'hidden'} onClick={() => setShow('hidden')}>מוסתרים</Chip>
      </div>
      {error && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}

      <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl bg-card ring-1 ring-line">
        {list.map((s) => (
          <div key={s.id} className="flex items-center gap-3 p-3">
            <a href={`#/admin/edit/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <ShirtImage shirt={s} className="h-14 w-14 shrink-0 rounded-xl" />
              <div className="min-w-0">
                <div className="line-clamp-2 break-words font-bold">
                  {s.featured && <Star size={14} className="me-1 inline fill-amber-400 text-amber-400" />}
                  {s.teamHe || s.team} · {s.type} {s.year}
                </div>
                <div dir="ltr" className="truncate text-right font-mono text-xs text-muted">{s.code}</div>
                {!cat && <div className="truncate text-xs text-muted">{s.categoryName}</div>}
                {!s.flyLink && <div className="text-xs text-red-600 dark:text-red-400">חסר קישור FlyLinking</div>}
              </div>
            </a>
            <button
              onClick={() => toggle(s)}
              disabled={busy === s.id}
              className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold ${
                s.published ? 'bg-lime text-ink' : 'bg-soft text-muted'
              } disabled:opacity-50`}
              title={s.published ? 'להסתיר מהאתר' : 'לפרסם באתר'}
            >
              {s.published ? <Eye size={16} /> : <EyeOff size={16} />}
              {s.published ? 'באתר' : 'מוסתר'}
            </button>
          </div>
        ))}
        {!list.length && <div className="p-8 text-center text-muted">{state.shirts.length ? 'לא נמצאו מוצרים' : 'עוד אין מוצרים. לחצו "מוצר חדש".'}</div>}
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        השלמה אוטומטית החודש: {state.usage.calls} פעמים · בערך {money(monthCost(state.usage).ils)} ·{' '}
        <a href="#/admin/settings" className="underline">פירוט</a>
      </p>
    </div>
  );
}

// ---------- עריכת מוצר ----------

// השדות לפי סוג הקטגוריה (מוצר רגיל: מותג במקום קבוצה, דגם במקום סוג חולצה)
const FIELDS = {
  football: {
    team: ['קבוצה / נבחרת (באנגלית)', 'Liverpool'], type: ['סוג חולצה', 'Home / Away / GK'], year: ['שנה / עונה', '2025/26'],
    types: ['Home', 'Away', 'Third', 'GK', 'Special', 'Training', 'Retro'], teamHe: ['שם בעברית', 'ליברפול'],
    describe: "צווארון, צבעים, עיצוב, שרוולים, סמל וכו'",
  },
  basketball: {
    team: ['קבוצה / נבחרת (באנגלית)', 'Golden State Warriors'], type: ['סוג גופייה', 'Icon / Association / Statement'], year: ['שנה / עונה', '2025/26'],
    types: ['Icon', 'Association', 'Statement', 'City', 'Classic'], teamHe: ['שם בעברית', 'גולדן סטייט ווריורס'],
    describe: 'צבעים, עיצוב, סמל, פרטים מיוחדים',
  },
  plain: {
    team: ['מותג (באנגלית)', 'Nike'], type: ['דגם', 'Air Jordan 1 Mid'], year: ['שנה (לא חובה)', '2025'],
    types: [], teamHe: ['מותג בעברית', 'נייקי'],
    describe: 'חומרים, צבעים, עיצוב, תכונות עיקריות',
  },
};

const EMPTY = {
  category: 'football',
  team: '', teamHe: '', kind: 'club', type: 'Home', year: '', color: '', colorHe: '',
  country: '', countryHe: '', league: '', leagueHe: '', description: '', tags: [],
  code: '', codeManual: false, flyLink: '', images: [], longSleeve: false, published: false, featured: false,
};

function Editor({ shirt, categories, call, imagesReady, draftRef, onSaved, onDeleted }) {
  // מוצר חדש מתוך קטגוריה (#/admin/edit/new/<קטגוריה>)
  const startCategory = window.location.hash.split('/')[4];
  // טיוטה שנשמרה כשהחיבור פג (אותו מוצר) – חוזרת כמו שהייתה
  const [draft] = useState(() => {
    const d = readDraft(shirt?.id || 'new');
    writeDraft(null);
    return d;
  });
  // מתי המוצר נשמר לאחרונה כשהעורך נפתח – נשלח כ-base כדי לא לדרוס שינוי ממכשיר אחר
  const [baseAt, setBaseAt] = useState(() => (draft ? draft.baseAt : shirt?.updatedAt));
  const [form, setForm] = useState(() => {
    if (draft) return { ...EMPTY, ...draft.form };
    const start = categories.find((c) => c.id === startCategory);
    const fresh = start ? { category: start.id, type: FIELDS[start.template].types[0] || '' } : {};
    return { ...EMPTY, ...fresh, ...(shirt || {}) };
  });
  const [tagsText, setTagsText] = useState(() => (draft ? draft.tagsText : (shirt?.tags || []).join(', ')));
  const [suggestions, setSuggestions] = useState([]);
  const [auto, setAuto] = useState({ details: false, images: false });
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(() => {
    const f = flash;
    flash = null;
    return draft ? { text: 'החיבור פג בזמן העבודה – הטיוטה שלכם שוחזרה. בדקו ושמרו.' } : f;
  });
  const [imageLink, setImageLink] = useState('');

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  // בלי קבוצה עוד אין קוד (אחרת היה מוצג רק "Home")
  const code = form.codeManual ? form.code : form.team.trim() ? autoCode(form) : '';
  const full = form.images.length >= MAX_IMAGES;
  const template = categories.find((c) => c.id === form.category)?.template || 'football';
  const F = FIELDS[template];
  const plain = template === 'plain';

  // החלפת קטגוריה: סוג ברירת המחדל מתאים לקטגוריה החדשה
  const setCategory = (id) => {
    const next = categories.find((c) => c.id === id)?.template || 'plain';
    const defaults = Object.values(FIELDS).map((x) => x.types[0]);
    setForm((f) => ({ ...f, category: id, type: !f.type || defaults.includes(f.type) ? FIELDS[next].types[0] || '' : f.type }));
  };

  const fail = (e) => setMsg({ error: true, text: e.message });

  // אם החיבור יפול באמצע – מסך הניהול ישמור את מה שבעורך (ראו call ב-Admin)
  useEffect(() => {
    draftRef.current = () => ({ id: shirt?.id || 'new', form, tagsText, baseAt });
    return () => {
      draftRef.current = null;
    };
  });

  // "מלא אוטומטית": פרטים + הצעות תמונות במקביל
  const autoFill = async () => {
    if (!form.team.trim()) return setMsg({ error: true, text: plain ? 'כתבו קודם את שם המותג' : 'כתבו קודם את שם הקבוצה / הנבחרת' });
    setMsg(null);
    setAuto({ details: true, images: true });
    // התשובה יכולה לקחת עד דקה: משלימים רק שדה שלא השתנה מאז הלחיצה
    const snap = form;
    const snapTags = tagsText;
    const basics = { category: form.category, team: form.team, type: form.type, year: form.year, color: form.color };
    const details = call('/admin/enrich', basics)
      .then(({ details: d }) => {
        setForm((f) => ({
          ...f,
          ...Object.fromEntries(
            Object.entries(d).filter(([k, v]) => {
              if (k === 'tags' || !v || f[k] !== snap[k]) return false;
              // סוג ושנה שהמשתמש כתב – נשארים (הסוכן מתבקש לשמור אותם)
              return !((k === 'type' || k === 'year') && String(snap[k] || '').trim());
            }),
          ),
        }));
        setTagsText((cur) => (cur === snapTags ? (d.tags || []).join(', ') : cur));
      })
      .catch(fail)
      .finally(() => setAuto((a) => ({ ...a, details: false })));
    const images = call('/admin/find-images', basics)
      .then(({ images: list }) => {
        setSuggestions(list);
        if (!list.length) setMsg({ text: 'לא מצאנו תמונות ברשת. אפשר להעלות מהמכשיר או להדביק קישור לתמונה.' });
      })
      .catch(fail)
      .finally(() => setAuto((a) => ({ ...a, images: false })));
    await Promise.all([details, images]);
  };

  const addImage = async (path, body, id) => {
    if (full) return setMsg({ error: true, text: `אפשר עד ${MAX_IMAGES} תמונות. הסירו תמונה קודם.` });
    setBusy(id);
    setMsg(null);
    try {
      const { key } = await call(path, body);
      setForm((f) => ({ ...f, images: [...f.images, key].slice(0, MAX_IMAGES) }));
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      setBusy('');
    }
  };

  const approve = async (s) => {
    if (await addImage('/admin/image-import', { url: s.url }, s.url)) setSuggestions((list) => list.filter((x) => x.url !== s.url));
  };

  const upload = async (files) => {
    for (const file of [...files].slice(0, MAX_IMAGES - form.images.length)) {
      let data;
      try {
        data = await shrinkImage(file);
      } catch {
        setMsg({ error: true, text: 'לא הצלחנו לקרוא את התמונה' });
        continue;
      }
      await addImage('/admin/image-upload', { data }, 'upload');
    }
  };

  const moveImage = (i, to) =>
    setForm((f) => {
      const list = [...f.images];
      const [x] = list.splice(i, 1);
      list.splice(to, 0, x);
      return { ...f, images: list };
    });

  const save = async (publish) => {
    setBusy('save');
    setMsg(null);
    const body = {
      ...form,
      published: publish ?? form.published,
      code,
      tags: tagsText.split(/[,،\n]/).map((t) => t.trim()).filter(Boolean),
    };
    try {
      const res = await call('/admin/shirt', shirt ? { ...body, base: baseAt } : body);
      writeDraft(null);
      setBaseAt(res.shirt.updatedAt);
      onSaved(res.shirt);
      setForm({ ...EMPTY, ...res.shirt });
      const done = { text: res.shirt.published ? 'נשמר ✓ המוצר מופיע באתר' : 'נשמר ✓ (מוסתר מהאתר)' };
      setMsg(done);
      if (!shirt) {
        flash = done;
        go(`admin/edit/${res.shirt.id}`);
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    if (!window.confirm('למחוק את המוצר לגמרי? (אפשר גם רק להסתיר אותו)')) return;
    setBusy('delete');
    try {
      await call('/admin/shirt-delete', { id: shirt.id });
      await onDeleted();
      go('admin');
    } catch (e) {
      fail(e);
      setBusy('');
    }
  };

  return (
    <div>
      <a href="#/admin" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:underline">
        <ArrowRight size={16} /> לכל המוצרים
      </a>
      <h1 className="mb-4 text-2xl font-black">{shirt ? `${shirt.teamHe || shirt.team} ${shirt.type} ${shirt.year}` : 'מוצר חדש'}</h1>

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          {/* שלב 1: פרטים בסיסיים */}
          <Box title="1. פרטים בסיסיים" sub="ממלאים את אלה, ולוחצים &quot;מלא אוטומטית&quot; – המערכת תשלים קוד, תיאור, סיווג, תגים ותמונות.">
            <Field label="קטגוריה">
              <select value={form.category} onChange={(e) => setCategory(e.target.value)} className={`${inputClass} mb-3`} aria-label="קטגוריה">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {!c.active ? ' (מוסתרת)' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={F.team[0]}>
                <input value={form.team} onChange={(e) => set({ team: e.target.value })} placeholder={F.team[1]} dir="ltr" className={inputClass} />
              </Field>
              <Field label={F.type[0]}>
                <input value={form.type} onChange={(e) => set({ type: e.target.value })} placeholder={F.type[1]} dir="ltr" list="types" className={inputClass} />
                <datalist id="types">
                  {F.types.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </Field>
              <Field label={F.year[0]}>
                <input value={form.year} onChange={(e) => set({ year: e.target.value })} placeholder={F.year[1]} dir="ltr" className={inputClass} />
              </Field>
              <Field label="צבע (באנגלית)">
                <input value={form.color} onChange={(e) => set({ color: e.target.value })} placeholder="Red" dir="ltr" className={inputClass} />
              </Field>
            </div>
            <button
              onClick={autoFill}
              disabled={auto.details || auto.images}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-lime py-3 font-bold text-ink disabled:opacity-60"
            >
              <Sparkles size={18} />
              {auto.details || auto.images ? 'מחפש ברשת וממלא… (עד דקה)' : 'מלא אוטומטית'}
            </button>
          </Box>

          {/* שלב 2: תמונות */}
          <Box title={`2. תמונות (${form.images.length}/${MAX_IMAGES})`} sub="התמונה הראשונה היא הראשית. רק תמונות שאישרתם מופיעות באתר.">
            {!imagesReady && <p className="mb-3 rounded-lg bg-soft p-2 text-sm">אחסון התמונות עוד לא מוגדר בשרת.</p>}
            <div className="grid grid-cols-4 gap-2">
              {form.images.map((key, i) => (
                <div key={key} className="group relative">
                  <img src={imageUrl(key)} alt="" className="aspect-square w-full rounded-xl bg-white object-contain ring-1 ring-line" />
                  {i === 0 && <span className="absolute right-1 top-1 rounded-full bg-ink px-1.5 text-[10px] font-bold text-white">ראשית</span>}
                  <div className="absolute inset-x-1 bottom-1 flex justify-between">
                    {i > 0 ? (
                      <button onClick={() => moveImage(i, 0)} className="rounded-full bg-card/90 p-1 shadow" title="להפוך לראשית">
                        <Star size={14} />
                      </button>
                    ) : (
                      <span />
                    )}
                    <button onClick={() => set({ images: form.images.filter((k) => k !== key) })} className="rounded-full bg-card/90 p-1 text-red-600 shadow" title="הסרה">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {!full && (
                <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-muted hover:border-muted">
                  <span className="flex flex-col items-center gap-1 text-xs">
                    <ImagePlus size={22} />
                    {busy === 'upload' ? 'מעלה…' : 'מהמכשיר'}
                  </span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                      upload(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>

            {!full && (
              <div className="mt-3 flex gap-2">
                <input value={imageLink} onChange={(e) => setImageLink(e.target.value)} placeholder="או הדביקו קישור לתמונה" dir="ltr" className={`${inputClass} py-2 text-sm`} />
                <button
                  onClick={async () => {
                    if (await addImage('/admin/image-import', { url: imageLink.trim() }, 'link')) setImageLink('');
                  }}
                  disabled={!imageLink.trim() || busy === 'link'}
                  className="shrink-0 rounded-xl bg-soft px-3 text-sm font-bold disabled:opacity-50"
                >
                  <Link2 size={18} />
                </button>
              </div>
            )}

            {(auto.images || suggestions.length > 0) && (
              <div className="mt-4">
                <div className="mb-2 text-sm font-bold">תמונות שנמצאו ברשת – לחצו כדי לאשר</div>
                {auto.images ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {Array.from({ length: 4 }, (_, i) => (
                      <div key={i} className="aspect-square animate-pulse rounded-xl bg-soft" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {suggestions.map((s) => (
                      <button
                        key={s.url}
                        onClick={() => approve(s)}
                        disabled={full || Boolean(busy)}
                        className="group relative overflow-hidden rounded-xl ring-1 ring-line disabled:opacity-50"
                        title={new URL(s.page).hostname}
                      >
                        <img
                          src={s.url}
                          alt=""
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="aspect-square w-full bg-white object-contain"
                          onError={() => setSuggestions((list) => list.filter((x) => x.url !== s.url))}
                        />
                        <span className="absolute inset-0 grid place-items-center bg-black/40 text-white opacity-0 transition group-hover:opacity-100">
                          {busy === s.url ? '…' : <Check size={28} />}
                        </span>
                        <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 text-[10px] text-white" dir="ltr">
                          {new URL(s.page).hostname.replace(/^www\./, '')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-muted">ודאו שמותר לכם להשתמש בתמונה (למשל תמונות מהספק או מהאתר של המוכר).</p>
              </div>
            )}
          </Box>

          {/* שלב 3: כל הפרטים */}
          <Box title="3. פרטים, סיווג ותיאור">
            <div className="grid grid-cols-2 gap-3">
              <Field label={F.teamHe[0]}>
                <input value={form.teamHe} onChange={(e) => set({ teamHe: e.target.value })} placeholder={F.teamHe[1]} className={inputClass} />
              </Field>
              {plain ? (
                <div />
              ) : (
                <Field label="קבוצה או נבחרת">
                  <select value={form.kind} onChange={(e) => set({ kind: e.target.value })} className={inputClass}>
                    <option value="club">{KIND_LABEL.club}</option>
                    <option value="national">{KIND_LABEL.national}</option>
                  </select>
                </Field>
              )}
              <Field label={plain ? 'מדינת המותג (אנגלית)' : 'מדינה (אנגלית)'}>
                <input value={form.country} onChange={(e) => set({ country: e.target.value })} dir="ltr" className={inputClass} />
              </Field>
              <Field label={plain ? 'מדינת המותג (עברית)' : 'מדינה (עברית)'}>
                <input value={form.countryHe} onChange={(e) => set({ countryHe: e.target.value })} className={inputClass} />
              </Field>
              <Field label={plain ? 'סדרה / ענף (אנגלית)' : form.kind === 'national' ? 'התאחדות (אנגלית)' : 'ליגה (אנגלית)'}>
                <input value={form.league} onChange={(e) => set({ league: e.target.value })} dir="ltr" className={inputClass} />
              </Field>
              <Field label={plain ? 'סדרה / ענף (עברית)' : form.kind === 'national' ? 'התאחדות (עברית)' : 'ליגה (עברית)'}>
                <input value={form.leagueHe} onChange={(e) => set({ leagueHe: e.target.value })} className={inputClass} />
              </Field>
              <Field label="צבע (עברית)">
                <input value={form.colorHe} onChange={(e) => set({ colorHe: e.target.value })} className={inputClass} />
              </Field>
            </div>
            <div className="mt-3 space-y-3">
              <Field label="תיאור קצר" hint={F.describe}>
                <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={4} className={inputClass} />
              </Field>
              <Field label="תגים לחיפוש" hint="מופרדים בפסיק">
                <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="פרמייר ליג, אנפילד" className={inputClass} />
              </Field>
            </div>
          </Box>
        </div>

        {/* בצד: קוד, קישור, מתגים ושמירה */}
        <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Box title="קוד מוצר">
            <input
              value={code}
              onChange={(e) => set({ code: e.target.value.replace(/\s/g, ''), codeManual: true })}
              dir="ltr"
              className={`${inputClass} font-mono`}
              placeholder="Team-Type-Year-Color"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>{form.codeManual ? 'נערך ידנית' : 'אוטומטי: Team-Type-Year-Color'}</span>
              {form.codeManual && (
                <button onClick={() => set({ codeManual: false, code: '' })} className="font-bold text-lime-ink hover:underline">
                  חזרה לאוטומטי
                </button>
              )}
            </div>
          </Box>

          <Box title="קישור FlyLinking">
            <input value={form.flyLink} onChange={(e) => set({ flyLink: e.target.value.trim() })} placeholder="https://…" dir="ltr" className={inputClass} />
            {form.flyLink && (
              <a href={form.flyLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-bold text-lime-ink hover:underline">
                פתיחת הקישור לבדיקה ↗
              </a>
            )}
          </Box>

          <Box>
            {template === 'football' && <Toggle label="יש גם גרסת שרוול ארוך" checked={form.longSleeve} onChange={(v) => set({ longSleeve: v })} />}
            <Toggle label="מומלץ (מופיע ראשון)" checked={form.featured} onChange={(v) => set({ featured: v })} />
            <Toggle label="מפורסם באתר" checked={form.published} onChange={(v) => set({ published: v })} />
          </Box>

          {msg && (
            <p className={`rounded-xl p-3 text-sm ${msg.error ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-lime/20'}`}>{msg.text}</p>
          )}

          <div className="grid gap-2">
            <button onClick={() => save()} disabled={busy === 'save'} className="rounded-full bg-ink py-3 font-bold text-white disabled:opacity-50 dark:bg-lime dark:text-ink">
              {busy === 'save' ? 'שומר…' : 'שמירה'}
            </button>
            {!form.published && (
              <button onClick={() => save(true)} disabled={busy === 'save'} className="rounded-full bg-lime py-3 font-bold text-ink ring-1 ring-ink/10 disabled:opacity-50">
                שמירה ופרסום באתר
              </button>
            )}
            {shirt?.published && (
              <a href={`#/shirt/${shirt.id}`} className="py-2 text-center text-sm font-bold text-muted hover:underline">
                צפייה בדף המוצר באתר
              </a>
            )}
            {shirt && (
              <button onClick={remove} disabled={busy === 'delete'} className="mt-2 flex items-center justify-center gap-1 py-2 text-sm text-red-600 hover:underline dark:text-red-400">
                <Trash2 size={15} /> מחיקה
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Box({ title, sub, children }) {
  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-line">
      {title && <h2 className="font-extrabold">{title}</h2>}
      {sub && <p className="mb-3 mt-0.5 text-sm text-muted">{sub}</p>}
      {title && !sub && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-2">
      <span className="font-medium">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-line transition peer-checked:bg-lime-ink after:absolute after:right-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:-translate-x-5" />
    </label>
  );
}

// ---------- הגדרות ----------

function SettingsPage({ state, call, onSaved }) {
  const [form, setForm] = useState(state.settings);
  // מאיפה הטופס נטען (settingsAt) – נשלח כ-base; ואם לא נגעו בו, רענון מהשרת מחליף אותו
  const [baseAt, setBaseAt] = useState(state.settingsAt);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const change = (patch) => {
    setDirty(true);
    setForm((f) => ({ ...f, ...patch }));
  };

  useEffect(() => {
    if (!dirty) {
      setForm(state.settings);
      setBaseAt(state.settingsAt);
    }
  }, [state.settings, state.settingsAt]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { settings, settingsAt } = await call('/admin/settings', { ...form, base: baseAt });
      setForm(settings);
      setBaseAt(settingsAt);
      setDirty(false);
      onSaved({ settings, settingsAt });
      setMsg({ text: 'נשמר ✓' });
    } catch (e) {
      setMsg({ error: true, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg">
      <a href="#/admin" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:underline">
        <ArrowRight size={16} /> לכל המוצרים
      </a>
      <h1 className="mb-4 text-2xl font-black">הגדרות האתר</h1>
      <Categories state={state} call={call} onSaved={(categories, categoriesAt) => onSaved({ categories, categoriesAt })} />
      {state.role !== 'client' && <ClientPassword state={state} call={call} onSaved={(clientPassSet) => onSaved({ clientPassSet })} />}
      <Box title="פרטי קשר והודעה">
        <div className="space-y-3">
          <Field label="מספר וואטסאפ לשאלות" hint="עם קידומת מדינה, למשל 972501234567. ריק = בלי כפתור וואטסאפ">
            <input value={form.whatsapp} onChange={(e) => change({ whatsapp: e.target.value })} dir="ltr" inputMode="tel" className={inputClass} />
          </Field>
          <Field label="אינסטגרם" hint="שם המשתמש בלבד">
            <input value={form.instagram} onChange={(e) => change({ instagram: e.target.value })} dir="ltr" placeholder="isport" className={inputClass} />
          </Field>
          <Field label="הודעה בראש האתר" hint="למשל: משלוח חינם בקנייה של 2 חולצות. ריק = בלי הודעה">
            <input value={form.announcement} onChange={(e) => change({ announcement: e.target.value })} maxLength={120} className={inputClass} />
          </Field>
        </div>
        {msg && <p className={`mt-3 rounded-xl p-3 text-sm ${msg.error ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-lime/20'}`}>{msg.text}</p>}
        <button onClick={save} disabled={busy} className="mt-4 w-full rounded-full bg-ink py-3 font-bold text-white disabled:opacity-50 dark:bg-lime dark:text-ink">
          {busy ? 'שומר…' : 'שמירה'}
        </button>
      </Box>
<Costs months={state.usageMonths || []} />
      <Backups dev={state.role !== 'client'} call={call} />
    </div>
  );
}

// ניהול הקטגוריות: שם, סוג (מה הלקוח יכול להתאים), סדר, הסתרה. קטגוריה עם מוצרים לא נמחקת – מסתירים אותה
function Categories({ state, call, onSaved }) {
  const [list, setList] = useState(() => state.categories || DEFAULT_CATEGORIES);
  const [baseAt, setBaseAt] = useState(state.categoriesAt);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!dirty) {
      setList(state.categories || DEFAULT_CATEGORIES);
      setBaseAt(state.categoriesAt);
    }
  }, [state.categories, state.categoriesAt]);
  const count = (id) => state.shirts.filter((s) => (s.category || 'football') === id).length;

  // כל שינוי של המשתמש מסמן שהטופס נערך (רענון מהשרת לא ידרוס אותו)
  const upd = (fn) => {
    setDirty(true);
    setList(fn);
  };
  const edit = (i, patch) => upd((l) => l.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const move = (i, d) =>
    upd((l) => {
      const out = [...l];
      [out[i], out[i + d]] = [out[i + d], out[i]];
      return out;
    });
  const add = () => upd((l) => [...l, { id: `cat-${Math.random().toString(36).slice(2, 8)}`, name: '', template: 'plain', active: true }]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { categories, categoriesAt } = await call('/admin/categories', { categories: list, base: baseAt });
      setList(categories);
      setBaseAt(categoriesAt);
      setDirty(false);
      onSaved(categories, categoriesAt);
      setMsg({ text: 'הקטגוריות נשמרו ✓' });
    } catch (e) {
      setMsg({ error: true, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-5">
      <Box title="קטגוריות" sub="הסדר כאן הוא הסדר באתר. הסוג קובע מה הלקוח יכול להתאים אישית.">
        <div className="space-y-3">
          {list.map((c, i) => (
            <div key={c.id} className={`rounded-xl border border-line p-3 ${c.active ? '' : 'opacity-60'}`}>
              <div className="flex items-center gap-2">
                <input value={c.name} onChange={(e) => edit(i, { name: e.target.value })} placeholder="שם הקטגוריה" maxLength={30} className={`${inputClass} py-2`} aria-label="שם הקטגוריה" />
                <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded-full p-1.5 hover:bg-soft disabled:opacity-30" aria-label="למעלה">
                  <ArrowUp size={16} />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === list.length - 1} className="rounded-full p-1.5 hover:bg-soft disabled:opacity-30" aria-label="למטה">
                  <ArrowDown size={16} />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select value={c.template} onChange={(e) => edit(i, { template: e.target.value })} className="w-full min-w-0 rounded-lg sm:w-auto sm:flex-1 border border-line bg-page px-2 py-1.5 text-sm" aria-label="סוג">
                  {Object.entries(TEMPLATES).map(([id, t]) => (
                    <option key={id} value={id}>{t.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => edit(i, { active: !c.active })}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${c.active ? 'bg-lime text-ink' : 'bg-soft text-muted'}`}
                >
                  {c.active ? <Eye size={14} /> : <EyeOff size={14} />}
                  {c.active ? 'מוצגת' : 'מוסתרת'}
                </button>
                {count(c.id) ? (
                  <span className="text-xs text-muted">{count(c.id)} מוצרים</span>
                ) : (
                  <button onClick={() => upd((l) => l.filter((_, j) => j !== i))} className="rounded-full p-1.5 text-red-600 hover:bg-soft dark:text-red-400" aria-label="מחיקה">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button onClick={add} className="mt-3 flex items-center gap-1 text-sm font-bold text-lime-ink hover:underline">
          <Plus size={16} /> קטגוריה חדשה
        </button>
        {msg && <p className={`mt-3 rounded-xl p-3 text-sm ${msg.error ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-lime/20'}`}>{msg.text}</p>}
        <button onClick={save} disabled={busy} className="mt-4 w-full rounded-full bg-ink py-3 font-bold text-white disabled:opacity-50 dark:bg-lime dark:text-ink">
          {busy ? 'שומר…' : 'שמירת הקטגוריות'}
        </button>
      </Box>
    </div>
  );
}

// עלויות ההשלמה האוטומטית לפי חודש – הערכה לפי המחירון (לגבייה מהלקוח: החשבון המדויק ב-Anthropic Console)
function Costs({ months }) {
  const total = months.reduce((sum, m) => sum + monthCost(m).ils, 0);
  return (
    <section className="mt-5 rounded-2xl bg-card p-4 ring-1 ring-line">
      <h2 className="font-extrabold">עלות ההשלמה האוטומטית</h2>
      <p className="mb-3 mt-0.5 text-sm text-muted">הערכה לפי המחירון של Claude (דולר ≈ {USD_ILS} ₪). התצוגה בלבד – לא נגבה כאן כסף.</p>
      {months.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-right text-muted">
              <tr className="border-b border-line">
                <th className="py-2 font-medium">חודש</th>
                <th className="py-2 font-medium">מוצרים שמולאו</th>
                <th className="py-2 font-medium">חיפושי תמונות</th>
                <th className="py-2 font-medium">חיפושים ברשת</th>
                <th className="py-2 text-left font-medium">עלות</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const c = monthCost(m);
                return (
                  <tr key={m.month} className="border-b border-line last:border-0">
                    <td className="py-2">{monthName(m.month)}</td>
                    <td className="py-2 tabular-nums">{m.enrich ?? m.calls}</td>
                    <td className="py-2 tabular-nums">{m.images ?? '–'}</td>
                    <td className="py-2 tabular-nums">{m.searches ?? '–'}</td>
                    <td className="py-2 text-left font-bold tabular-nums">
                      {money(c.ils)} <span className="font-normal text-muted">({money(c.usd, '$')})</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {months.length > 1 && (
              <tfoot>
                <tr className="border-t-2 border-line">
                  <td className="py-2 font-bold" colSpan={4}>סה"כ</td>
                  <td className="py-2 text-left font-bold tabular-nums">{money(total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted">עוד לא השתמשו בהשלמה האוטומטית.</p>
      )}
    </section>
  );
}

// הסיסמה של בעל החנות – רק מי שבנה את האתר קובע אותה (הסיסמה שלו עצמו נשארת ב-GitHub)
function ClientPassword({ state, call, onSaved }) {
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async (value) => {
    if (value === '' && !window.confirm('לבטל את הגישה של בעל החנות למסך הניהול?')) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await call('/admin/client-password', { password: value });
      onSaved(res.clientPassSet);
      setPassword('');
      setMsg({ text: value ? 'נשמר ✓ הסיסמה הקודמת כבר לא עובדת' : 'הגישה בוטלה ✓' });
    } catch (e) {
      setMsg({ error: true, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-5">
      <Box title="סיסמה לבעל החנות" sub="סיסמה נפרדת משלך. אפשר להחליף או לבטל בכל רגע – ובעל החנות מתנתק מיד. רק אתה רואה את החלק הזה.">
        <p className="mb-3 text-sm">
          מצב: {state.clientPassSet ? <b className="text-lime-ink">יש סיסמה לבעל החנות</b> : <b>עוד לא נקבעה</b>}
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && password.length >= 8) save(password);
          }}
        >
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="סיסמה חדשה (8 תווים לפחות)"
            autoComplete="new-password"
            dir="ltr"
            className={inputClass}
          />
          <button type="submit" disabled={busy || password.length < 8} className="shrink-0 rounded-xl bg-ink px-4 font-bold text-white disabled:opacity-50 dark:bg-lime dark:text-ink">
            שמירה
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">שולחים לבעל החנות את הסיסמה בהודעה פרטית. הסיסמה לא נשמרת באתר אלא בצורה מוצפנת, ואי אפשר לראות אותה שוב.</p>
        {state.clientPassSet && (
          <button onClick={() => save('')} disabled={busy} className="mt-3 text-sm text-red-600 hover:underline dark:text-red-400">
            ביטול הגישה של בעל החנות
          </button>
        )}
        {msg && <p className={`mt-3 rounded-xl p-3 text-sm ${msg.error ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-lime/20'}`}>{msg.text}</p>}
      </Box>
    </div>
  );
}

// תאריך בפורמט קבוע: 18.10.2026 20:09 (בלי פסיק של ה-locale שמתהפך ב-RTL)
const fmtWhen = (at) => {
  const d = new Date(at);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const BACKUP_KIND = (key) => (key.endsWith('-restore.json') ? 'לפני שחזור' : key.includes('T') ? 'ידני' : 'לילי');

// גיבויים: כל לילה אוטומטית (30 יום אחורה) + "גיבוי עכשיו". שחזור – רק למי שבנה את האתר
function Backups({ dev, call }) {
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  const refresh = () =>
    call('/admin/backups')
      .then((r) => setList(r.backups))
      .catch((e) => setMsg({ error: true, text: e.message }));
  useEffect(() => {
    refresh();
  }, []);

  const backupNow = async () => {
    setBusy('now');
    setMsg(null);
    try {
      const r = await call('/admin/backup-now');
      setMsg({ text: `גובה ✓ (${r.shirts} מוצרים)` });
      await refresh();
    } catch (e) {
      setMsg({ error: true, text: e.message });
    } finally {
      setBusy('');
    }
  };

  const restore = async (b) => {
    const when = fmtWhen(b.at);
    if (!window.confirm(`לשחזר את האתר למצב של ${when}?\nהמוצרים, הקטגוריות וההגדרות יוחלפו. המצב הנוכחי יגובה קודם, כך שאפשר לחזור אליו.`)) return;
    setBusy(b.key);
    setMsg(null);
    try {
      const r = await call('/admin/restore', { key: b.key });
      setMsg({ text: `שוחזר ✓ (${r.shirts} מוצרים). טוען מחדש…` });
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setMsg({ error: true, text: e.message });
      setBusy('');
    }
  };

  return (
    <section className="mt-5 rounded-2xl bg-card p-4 ring-1 ring-line">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-extrabold">גיבויים</h2>
          <p className="mt-0.5 text-sm text-muted">כל לילה נשמר גיבוי של המוצרים, הקטגוריות וההגדרות, ל-30 יום. גם תמונות שנמחקו נשמרות 31 יום.</p>
        </div>
        <button onClick={backupNow} disabled={Boolean(busy)} className="shrink-0 rounded-full px-4 py-2 text-sm font-bold ring-1 ring-line hover:bg-soft disabled:opacity-50">
          {busy === 'now' ? 'מגבה…' : 'גיבוי עכשיו'}
        </button>
      </div>
      {msg && <p className={`mt-3 rounded-xl p-3 text-sm ${msg.error ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-lime/20'}`}>{msg.text}</p>}
      <div className="mt-3 max-h-80 divide-y divide-line overflow-y-auto">
        {list === null && <p className="py-3 text-sm text-muted">טוען…</p>}
        {list?.length === 0 && <p className="py-3 text-sm text-muted">עוד אין גיבויים. הראשון ייווצר הלילה (או לחצו "גיבוי עכשיו").</p>}
        {list?.map((b) => (
          <div key={b.key} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div>
              <span dir="ltr" className="inline-block tabular-nums">{fmtWhen(b.at)}</span>
              <span className="ms-2 rounded-full bg-soft px-2 py-0.5 text-xs">{BACKUP_KIND(b.key)}</span>
              <span className="ms-2 text-xs text-muted">{Math.max(1, Math.round(b.size / 1024))}KB</span>
            </div>
            {dev && (
              <button onClick={() => restore(b)} disabled={Boolean(busy)} className="shrink-0 text-xs font-bold text-lime-ink hover:underline disabled:opacity-50">
                {busy === b.key ? 'משחזר…' : 'שחזור'}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
