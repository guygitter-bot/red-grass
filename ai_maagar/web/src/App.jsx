import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, GraduationCap, Inbox, Loader2, Moon, Pencil, Search, Sun } from 'lucide-react';
import { api } from './lib/api';
import { LEARN, categoryList, countText, downloadFile, filterFromHash, filterItems, hashFromFilter, isLearn, isWaiting, newestTitles, parsePasted, readFile, sharedText } from './lib/library';
import { isDark, setTheme } from './lib/theme';
import AddBox from './components/AddBox';
import CategoryTile from './components/CategoryTile';
import ItemCard from './components/ItemCard';
import ItemSheet from './components/ItemSheet';
import LearnCard from './components/LearnCard';
import LearnSheet from './components/LearnSheet';

// טקסט ששותף לאפליקציה (‎?url=...‎) – נכנס לתיבה ומחכה ל"הוספה", ולא נשמר לבד
const SHARED = sharedText(window.location.search);
if (SHARED) window.history.replaceState(null, '', window.location.pathname);

export default function App() {
  const [allItems, setItems] = useState([]);
  const [categories, setCategories] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState(() => filterFromHash(window.location.hash));
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [dark, setDark] = useState(isDark());
  const navigated = useRef(false); // האם נכנסנו לקטגוריה מתוך האפליקציה (אפשר לחזור אחורה)
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

  // הספרייה הרגילה ופריטי הלימוד נפרדים: פריט לימוד לא מופיע בקטגוריות, ב"בטיפול" ובחיפוש
  const items = useMemo(() => allItems.filter((i) => !isLearn(i)), [allItems]);
  const learnItems = useMemo(() => allItems.filter(isLearn).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [allItems]);
  const learnWaiting = learnItems.some(isWaiting);

  // בזמן מיפוי / לימוד – רענון כל 3 שניות עד שהכול מוכן
  const waiting = items.some(isWaiting);
  const anyWaiting = waiting || learnWaiting;
  useEffect(() => {
    if (!anyWaiting) return undefined;
    const timer = setInterval(load, 3000);
    return () => {
      clearInterval(timer);
    };
  }, [anyWaiting, load]);

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

  const cats = useMemo(() => categoryList(items, categories), [items, categories]);
  const shown = useMemo(() => filterItems(items, filter, query), [items, filter, query]); // במסך הראשי עם חיפוש – כל הפריטים
  const waitingCount = items.filter((i) => isWaiting(i) || i.status === 'failed').length;
  const open = allItems.find((i) => i.id === openId);

  // המסך הפתוח נשמר בכתובת (hash), כדי שכפתור "אחורה" בטלפון יחזור לקטגוריות
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
    if (loaded && filter !== 'all' && filter !== 'waiting' && filter !== LEARN && !cats.some((c) => c.name === filter)) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setFilter('all');
    }
  }, [loaded, filter, cats]);

  async function add(input, mode) {
    const extra = mode ? { mode } : {};
    const { links, text, note } = parsePasted(input);
    setBusy(true);
    try {
      let duplicates = 0;
      for (const url of links) {
        const res = await api('/add', { kind: 'link', url, note, ...extra });
        if (res.duplicate) duplicates += 1;
      }
      if (!links.length && text) await api('/add', { kind: 'text', text, ...extra });
      if (duplicates) setMessage(duplicates === 1 ? 'הקישור כבר שמור' : `${duplicates} קישורים כבר שמורים`);
      await load();
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addFiles(files, mode) {
    setBusy(true);
    setMessage(files.length > 1 ? `מעלה ${files.length} קבצים...` : 'מעלה...');
    try {
      for (const f of files) await api('/add', { kind: 'file', file: await readFile(f), ...(mode ? { mode } : {}) });
      setMessage('');
      await load();
    } catch (e) {
      fail(e);
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

  async function download(item) {
    try {
      const { file } = await api('/file', { id: item.id });
      downloadFile(file);
    } catch (e) {
      fail(e);
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
  const learnView = filter === LEARN;
  const home = filter === 'all';
  const showTiles = home && !query.trim() && items.length > 0;
  const showBanner = home && !query.trim();

  return (
    <div className="min-h-dvh bg-page">
      <header className="sticky top-0 z-30 bg-page/90 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src="icon.svg" alt="" className="w-8 h-8" />
          <h1 className="text-lg font-bold">מאגר AI</h1>
          <button onClick={toggleTheme} className="ms-auto p-2 rounded-full hover:bg-soft" aria-label="מצב לילה">
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4">
        <section className="space-y-4 min-w-0">
          {!learnView && <AddBox initial={SHARED} busy={busy} onAdd={add} onFiles={addFiles} />}

          {!learnView && <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-card border border-line rounded-xl px-3">
              <Search size={18} className="text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={home ? 'חיפוש' : 'חיפוש בקטגוריה'}
                className="flex-1 bg-transparent py-2.5 outline-none placeholder:text-muted"
              />
            </div>
          </div>}

          {!home && !learnView && (
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={goBack} className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-sm hover:bg-soft">
                <ArrowRight size={16} /> כל הקטגוריות
              </button>
              <h2 className="flex items-center gap-2 text-lg font-bold min-w-0" dir="auto">
                {filter === 'waiting' ? <Inbox size={20} /> : <span>{current?.emoji || '📁'}</span>}
                <span className="truncate">{filter === 'waiting' ? 'בטיפול' : filter}</span>
              </h2>
              <span className="text-sm text-muted">{countText(shown.length)}</span>
              {current && (
                <button onClick={() => renameCategory(current.name)} className="ms-auto flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-sm hover:bg-soft">
                  <Pencil size={15} /> שינוי שם
                </button>
              )}
            </div>
          )}

          {learnView && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={goBack} className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-sm hover:bg-soft">
                  <ArrowRight size={16} /> כל הקטגוריות
                </button>
                <h2 className="flex items-center gap-2 text-lg font-bold min-w-0">🎓 לימוד וסקילים</h2>
              </div>
              <div className="space-y-1">
                <p className="leading-relaxed">הדביקו כאן קישור לסרטון, מדריך או פוסט (או העלו קובץ) – ואלמד ממנו: אבנה סקילים ל-Claude, אכתוב פרומפטים מוכנים ואסדר צעד אחר צעד.</p>
                <p className="text-xs text-muted">בסרטון יוטיוב אני קורא את מה שנאמר בו (הכתוביות) – את התמונה עצמה אני לא רואה.</p>
              </div>
              <AddBox busy={busy} placeholder="קישור לסרטון / מדריך, או טקסט ללמוד ממנו" onAdd={(v) => add(v, 'learn')} onFiles={(f) => addFiles(f, 'learn')} />
              {loaded && !learnItems.length && <p className="text-center text-muted py-10">עוד לא למדתי כלום – הדביקו קישור למעלה.</p>}
              <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
                {learnItems.map((item) => <LearnCard key={item.id} item={item} onOpen={setOpenId} />)}
              </div>
            </>
          )}

          {showBanner && (
            <button onClick={() => openFilter(LEARN)} className="w-full text-start bg-soft border border-line rounded-2xl p-4 shadow-sm hover:border-accent/50 transition flex items-center gap-3">
              <GraduationCap size={36} className="text-accent-ink shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block font-bold">🎓 לימוד וסקילים</span>
                <span className="block text-sm text-muted">סרטון, מדריך או פוסט → סקילים, פרומפטים וצעדים</span>
              </span>
              <span className="shrink-0 text-end text-sm">
                <span className="block text-muted">{countText(learnItems.length)}</span>
                {learnWaiting && (
                  <span className="flex items-center gap-1.5 text-accent-ink">
                    <Loader2 size={14} className="animate-spin" /> לומד...
                  </span>
                )}
              </span>
            </button>
          )}

          {loaded && !items.length && home && (
            <div className="text-center text-muted py-16 space-y-2">
              <p className="text-4xl">🧠</p>
              <p>עוד אין כאן כלום.</p>
              <p className="text-sm">הדביקו קישור לכתבה, סרטון או כלי – או העלו קובץ – ואני אסדר אותו לפי הנושא.</p>
            </div>
          )}

          {learnView ? null : showTiles ? (
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
                  <ItemCard key={item.id} item={item} emoji={categories[item.category]?.emoji || '📁'} onOpen={setOpenId} />
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      {open && isLearn(open) && (
        <LearnSheet
          item={open}
          onClose={() => setOpenId(null)}
          onUpdate={(patch) => act('/update', { id: open.id, ...patch })}
          onRetry={() => act('/retry', { id: open.id })}
          onDelete={async () => {
            setOpenId(null);
            await act('/delete', { id: open.id });
          }}
          onDownload={download}
        />
      )}

      {open && !isLearn(open) && (
        <ItemSheet
          item={open}
          categories={cats}
          onClose={() => setOpenId(null)}
          onUpdate={(patch) => act('/update', { id: open.id, ...patch })}
          onRetry={() => act('/retry', { id: open.id })}
          onDelete={async () => {
            setOpenId(null);
            await act('/delete', { id: open.id });
          }}
          onDownload={download}
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
