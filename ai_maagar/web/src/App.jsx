import { useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox, LogOut, Moon, Pencil, Search, Sun } from 'lucide-react';
import { AuthError, api, getToken, setToken } from './lib/api';
import { categoryList, downloadFile, filterItems, isWaiting, parsePasted, readFile, sharedText } from './lib/library';
import { isDark, setTheme } from './lib/theme';
import Login from './components/Login';
import AddBox from './components/AddBox';
import ItemCard from './components/ItemCard';
import ItemSheet from './components/ItemSheet';

// טקסט ששותף לאפליקציה (‎?url=...‎) – נכנס לתיבה ומחכה ל"הוספה", ולא נשמר לבד
const SHARED = sharedText(window.location.search);
if (SHARED) window.history.replaceState(null, '', window.location.pathname);

export default function App() {
  const [loggedIn, setLoggedIn] = useState(Boolean(getToken()));
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [dark, setDark] = useState(isDark());

  const fail = useCallback((e) => {
    if (e instanceof AuthError) {
      setToken('');
      setLoggedIn(false);
    }
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
    if (loggedIn) load();
  }, [loggedIn, load]);

  // בזמן מיפוי – רענון כל 3 שניות עד שהכול מוכן
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
      if (document.visibilityState === 'visible' && loggedIn) load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loggedIn, load]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(''), 4000);
    return () => {
      clearTimeout(timer);
    };
  }, [message]);

  const cats = useMemo(() => categoryList(items, categories), [items, categories]);
  const shown = useMemo(() => filterItems(items, filter, query), [items, filter, query]);
  const waitingCount = items.filter((i) => isWaiting(i) || i.status === 'failed').length;
  const open = items.find((i) => i.id === openId);

  // קטגוריה שהתרוקנה (העברה / מחיקה) – חזרה ל"הכול"
  useEffect(() => {
    if (loaded && filter !== 'all' && filter !== 'waiting' && !cats.some((c) => c.name === filter)) setFilter('all');
  }, [loaded, filter, cats]);

  async function add(input) {
    const { links, text, note } = parsePasted(input);
    setBusy(true);
    try {
      let duplicates = 0;
      for (const url of links) {
        const res = await api('/add', { kind: 'link', url, note });
        if (res.duplicate) duplicates += 1;
      }
      if (!links.length && text) await api('/add', { kind: 'text', text });
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

  async function addFiles(files) {
    setBusy(true);
    setMessage(files.length > 1 ? `מעלה ${files.length} קבצים...` : 'מעלה...');
    try {
      for (const f of files) await api('/add', { kind: 'file', file: await readFile(f) });
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
    await act('/category', { from: name, to });
    setFilter(to);
  }

  function toggleTheme() {
    setTheme(dark ? 'light' : 'dark');
    setDark(!dark);
  }

  function logout() {
    setToken('');
    setLoggedIn(false);
    setItems([]);
  }

  if (!loggedIn) return <Login onDone={() => setLoggedIn(true)} />;

  const chip = (key, label, count) => (
    <button
      key={key}
      onClick={() => setFilter(key)}
      className={`shrink-0 lg:w-full flex items-center gap-2 rounded-full lg:rounded-xl px-3 py-1.5 lg:py-2 text-sm border transition ${
        filter === key ? 'bg-accent text-white border-accent' : 'bg-card border-line hover:bg-soft'
      }`}
    >
      <span className="truncate">{label}</span>
      <span className={`ms-auto text-xs ${filter === key ? 'text-white/80' : 'text-muted'}`}>{count}</span>
    </button>
  );

  const current = cats.find((c) => c.name === filter);

  return (
    <div className="min-h-dvh bg-page">
      <header className="sticky top-0 z-30 bg-page/90 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src="icon.svg" alt="" className="w-8 h-8" />
          <h1 className="text-lg font-bold">מאגר AI</h1>
          <button onClick={toggleTheme} className="ms-auto p-2 rounded-full hover:bg-soft" aria-label="מצב לילה">
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={logout} className="p-2 rounded-full hover:bg-soft" aria-label="יציאה"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 lg:grid lg:grid-cols-[15rem_1fr] lg:gap-6">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="flex lg:flex-col gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 pb-3">
            {chip('all', 'הכול', items.length)}
            {waitingCount > 0 && chip('waiting', <span className="flex items-center gap-1.5"><Inbox size={15} /> בטיפול</span>, waitingCount)}
            {cats.map((c) => chip(c.name, `${c.emoji} ${c.name}`, c.count))}
          </div>
        </aside>

        <section className="space-y-4 min-w-0">
          <AddBox initial={SHARED} busy={busy} onAdd={add} onFiles={addFiles} />

          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-card border border-line rounded-xl px-3">
              <Search size={18} className="text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש"
                className="flex-1 bg-transparent py-2.5 outline-none placeholder:text-muted"
              />
            </div>
            {current && (
              <button onClick={() => renameCategory(current.name)} className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2.5 text-sm hover:bg-soft">
                <Pencil size={15} /> שינוי שם
              </button>
            )}
          </div>

          {loaded && !items.length && (
            <div className="text-center text-muted py-16 space-y-2">
              <p className="text-4xl">🧠</p>
              <p>עוד אין כאן כלום.</p>
              <p className="text-sm">הדביקו קישור לכתבה, סרטון או כלי – או העלו קובץ – ואני אסדר אותו לפי הנושא.</p>
            </div>
          )}
          {loaded && items.length > 0 && !shown.length && <p className="text-center text-muted py-10">לא נמצא כלום</p>}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((item) => (
              <ItemCard key={item.id} item={item} emoji={categories[item.category]?.emoji || '📁'} onOpen={setOpenId} />
            ))}
          </div>
        </section>
      </main>

      {open && (
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
