import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Inbox, KeyRound, Moon, Pencil, Search, Sun } from 'lucide-react';
import { api } from './lib/api';
import { allCodes, categoryList, CODES, codesText, countText, filterFromHash, filterItems, hashFromFilter, isWaiting, newestTitles, parsePasted, sharedText } from './lib/videos';
import { isDark, setTheme } from './lib/theme';
import AddBox from './components/AddBox';
import CategoryTile from './components/CategoryTile';
import CodeRow from './components/CodeRow';
import VideoCard from './components/VideoCard';
import VideoSheet from './components/VideoSheet';

// קישור ששותף לאפליקציה (‎?url=...‎) – נכנס לתיבה ומחכה ל"הוספה", ולא נשמר לבד
const SHARED = sharedText(window.location.search);
if (SHARED) window.history.replaceState(null, '', window.location.pathname);

export default function App() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState(() => filterFromHash(window.location.hash));
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [dark, setDark] = useState(isDark());
  const navigated = useRef(false); // האם נכנסנו למסך מתוך האפליקציה (אפשר לחזור אחורה)
  const renaming = useRef(false);

  const fail = useCallback((e) => {
    setMessage(e.message);
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await api('/list');
      setItems(data.items);
      setCategories(data.categories);
      setLoaded(true);
    } catch (e) {
      fail(e);
    }
  }, [fail]);

  useEffect(() => {
    load();
  }, [load]);

  // בזמן קריאה – רענון כל 3 שניות עד שהכול מוכן
  const waiting = items.some(isWaiting);
  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setInterval(load, 3000);
    return () => {
      clearInterval(timer);
    };
  }, [waiting, load]);

  // חזרה לאפליקציה – רענון (אולי נוסף משהו ממכשיר אחר)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(''), 4000);
    return () => {
      clearTimeout(timer);
    };
  }, [message]);

  // המסך הפתוח נשמר בכתובת (hash), כדי שכפתור "אחורה" בטלפון יחזור למסך הראשי
  useEffect(() => {
    const onHash = () => {
      setFilter(filterFromHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  const cats = useMemo(() => categoryList(items, categories), [items, categories]);
  const shown = useMemo(() => filterItems(items, filter, query), [items, filter, query]);
  const codeList = useMemo(() => allCodes(items, filter === CODES ? query : ''), [items, filter, query]);
  const totalCodes = useMemo(() => allCodes(items).length, [items]);
  const waitingCount = items.filter((i) => isWaiting(i) || i.status === 'failed').length;
  const open = items.find((i) => i.id === openId);

  function openFilter(key) {
    navigated.current = true;
    setQuery('');
    window.location.hash = hashFromFilter(key);
  }

  function goBack() {
    if (navigated.current) window.history.back();
    else window.location.hash = '';
  }

  // קטגוריה שהתרוקנה (העברה / מחיקה) – חזרה למסך הראשי
  useEffect(() => {
    if (renaming.current) return;
    if (loaded && !['all', 'waiting', CODES].includes(filter) && !cats.some((c) => c.name === filter)) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setFilter('all');
    }
  }, [loaded, filter, cats]);

  async function add(input) {
    const { links, note } = parsePasted(input);
    if (!links.length) {
      setMessage('צריך להדביק קישור לסרטון');
      return false;
    }
    setBusy(true);
    try {
      let duplicates = 0;
      let retried = 0;
      for (const url of links) {
        const res = await api('/add', { url, note });
        if (res.retried) retried += 1;
        else if (res.duplicate) duplicates += 1;
      }
      if (retried) setMessage('ניסיתי שוב לקרוא את הסרטון');
      else if (duplicates) setMessage(duplicates === 1 ? 'הסרטון כבר שמור' : `${duplicates} סרטונים כבר שמורים`);
      await load();
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function act(path, body) {
    try {
      const res = await api(path, body);
      await load();
      return res;
    } catch (e) {
      fail(e);
      return null;
    }
  }

  async function renameCategory(name) {
    const to = window.prompt('שם חדש לקטגוריה (שם של קטגוריה קיימת = איחוד)', name)?.trim();
    if (!to || to === name) return;
    renaming.current = true;
    await act('/category', { from: name, to });
    window.history.replaceState(null, '', window.location.pathname + window.location.search + hashFromFilter(to));
    setFilter(to);
    renaming.current = false;
  }

  function toggleTheme() {
    setTheme(dark ? 'light' : 'dark');
    setDark(!dark);
  }

  const current = cats.find((c) => c.name === filter);
  const home = filter === 'all';
  const codesView = filter === CODES;
  const showTiles = home && !query.trim() && items.length > 0;

  return (
    <div className="min-h-dvh bg-page">
      <header className="sticky top-0 z-30 bg-page/90 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src="icon.svg" alt="" className="w-9 h-9" />
          <h1 className="text-lg font-black tracking-tight">
            <span className="brand-text">GTA 6</span> <span className="font-bold">· סרטונים וקודים</span>
          </h1>
          <button onClick={toggleTheme} className="ms-auto p-2 rounded-full hover:bg-soft" aria-label="מצב לילה">
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 space-y-4">
        {home && <AddBox initial={SHARED} busy={busy} onAdd={add} />}

        <div className="flex items-center gap-2 bg-card border border-line rounded-xl px-3">
          <Search size={18} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={codesView ? 'חיפוש קוד (למשל: נשק, רכב, כסף)' : home ? 'חיפוש בכל הסרטונים והקודים' : 'חיפוש בקטגוריה'}
            className="flex-1 bg-transparent py-2.5 outline-none placeholder:text-muted"
          />
        </div>

        {!home && (
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={goBack} className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-sm hover:bg-soft">
              <ArrowRight size={16} /> ראשי
            </button>
            <h2 className="flex items-center gap-2 text-lg font-bold min-w-0" dir="auto">
              {filter === 'waiting' ? <Inbox size={20} /> : codesView ? <KeyRound size={20} className="text-accent-ink" /> : <span>{current?.emoji || '🎮'}</span>}
              <span className="truncate">{filter === 'waiting' ? 'בטיפול' : codesView ? 'כל הקודים' : filter}</span>
            </h2>
            <span className="text-sm text-muted">{codesView ? codesText(codeList.length) : countText(shown.length)}</span>
            {current && (
              <button onClick={() => renameCategory(current.name)} className="ms-auto flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-sm hover:bg-soft">
                <Pencil size={15} /> שינוי שם
              </button>
            )}
          </div>
        )}

        {loaded && !items.length && home && (
          <div className="text-center text-muted py-14 space-y-2">
            <p className="text-4xl">🌴🚗</p>
            <p>עוד אין כאן סרטונים.</p>
            <p className="text-sm">הדביקו קישור לסרטון GTA 6 (פייסבוק, אינסטגרם, טיקטוק, יוטיוב) – ואכתוב מה יש בו ואוציא את הקודים.</p>
          </div>
        )}

        {showTiles && totalCodes > 0 && (
          <button onClick={() => openFilter(CODES)} className="w-full text-start brand-bg text-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:opacity-95 transition">
            <KeyRound size={34} className="shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block font-bold text-lg">כל הקודים</span>
              <span className="block text-sm opacity-90">כל הקודים מכל הסרטונים, ברשימה אחת עם העתקה</span>
            </span>
            <span className="shrink-0 font-bold">{codesText(totalCodes)}</span>
          </button>
        )}

        {codesView ? (
          <>
            {loaded && !codeList.length && <p className="text-center text-muted py-10">{query.trim() ? 'לא נמצא קוד' : 'עוד אין קודים'}</p>}
            <ul className="grid gap-2 lg:grid-cols-2">
              {codeList.map((c) => (
                <CodeRow key={`${c.item.id}-${c.code}`} code={c} from={c.item.title} onFrom={() => setOpenId(c.item.id)} />
              ))}
            </ul>
          </>
        ) : showTiles ? (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {waitingCount > 0 && (
              <CategoryTile icon={<Inbox size={36} />} name="בטיפול" count={waitingCount} busy={waiting} onOpen={() => openFilter('waiting')} />
            )}
            {cats.map((c) => (
              <CategoryTile key={c.name} emoji={c.emoji} name={c.name} count={c.count} previews={newestTitles(items, c.name)} onOpen={() => openFilter(c.name)} />
            ))}
          </div>
        ) : (
          <>
            {loaded && items.length > 0 && !shown.length && <p className="text-center text-muted py-10">לא נמצא כלום</p>}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((item) => (
                <VideoCard key={item.id} item={item} emoji={categories[item.category]?.emoji || '🎮'} onOpen={setOpenId} />
              ))}
            </div>
          </>
        )}
      </main>

      {open && (
        <VideoSheet
          item={open}
          categories={cats}
          onClose={() => setOpenId(null)}
          onUpdate={(patch) => act('/update', { id: open.id, ...patch })}
          onRetry={() => act('/retry', { id: open.id })}
          onDelete={async () => {
            setOpenId(null);
            await act('/delete', { id: open.id });
          }}
        />
      )}

      {message && (
        <div className="fixed bottom-4 inset-x-4 z-50 flex justify-center pointer-events-none">
          <p className="bg-ink text-page rounded-xl px-4 py-2.5 text-sm shadow-lg">{message}</p>
        </div>
      )}
    </div>
  );
}
