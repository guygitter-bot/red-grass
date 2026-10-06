import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Cloud, CloudOff, MessageSquarePlus, Moon, RefreshCw, Search, Settings, Sun } from 'lucide-react';
import { dueReminders, load, save } from './lib/store';
import { todayKey } from './lib/dates';
import BottomNav, { SideNav } from './components/BottomNav';
import Dashboard from './components/Dashboard';
import DayView from './components/DayView';
import AreasView from './components/AreasView';
import LaterView from './components/LaterView';
import TaskEditor from './components/TaskEditor';
import ImportSheet from './components/ImportSheet';
import SettingsSheet from './components/SettingsSheet';
import SearchSheet from './components/SearchSheet';
import RequestsSheet from './components/RequestsSheet';
import { notify } from './lib/notify';
import { AuthError, collectChanges, getToken, logout, resetSync, runSync } from './lib/sync';
import { RELOCK_AFTER_MS } from './lib/lock';
import { enablePush } from './lib/push';
import { setTheme, systemDark, toggledTheme, useTheme } from './lib/theme';
import LockScreen from './components/LockScreen';
import SpacesSheet from './components/SpacesSheet';
import { SPACE, appPath } from './lib/space';
import ErrorBoundary from './components/ErrorBoundary';

const Store = createContext(null);
export const useStore = () => useContext(Store);

// טקסט ששותף לאפליקציה מווטסאפ (share target) מגיע בכתובת: ?text=...&url=...
function sharedText() {
  const params = new URLSearchParams(window.location.search);
  const parts = ['title', 'text', 'url'].map((k) => params.get(k)).filter(Boolean);
  if (!parts.length) return null;
  window.history.replaceState(null, '', appPath() + window.location.hash);
  return [...new Set(parts)].join('\n');
}

export default function App() {
  const [state, setState] = useState(load);
  const [tab, setTab] = useState('home');
  const [day, setDay] = useState(() => todayKey());
  const [area, setArea] = useState(null);
  const [laterSeg, setLaterSeg] = useState('later');
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(sharedText);
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);
  // סנכרון: off (לא מחובר) / syncing / ok / offline / error
  const [syncStatus, setSyncStatus] = useState(() => (getToken() ? 'ok' : 'off'));
  // נעול בכל פתיחה, ושוב אחרי RELOCK_AFTER_MS ברקע
  const [locked, setLocked] = useState(true);
  const lockedRef = useRef(true);
  lockedRef.current = locked;

  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
    save(state);
  }, [state]);

  const act = useCallback((fn, ...args) => setState((s) => fn(s, ...args)), []);

  const syncing = useRef(false);
  const again = useRef(false);
  const sync = useCallback(async () => {
    if (!getToken() || lockedRef.current) return;
    if (syncing.current) {
      again.current = true;
      return;
    }
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }
    syncing.current = true;
    setSyncStatus('syncing');
    try {
      await runSync(() => latest.current, (fn) => setState((s) => {
        const next = fn(s);
        latest.current = next;
        return next;
      }));
      setSyncStatus('ok');
    } catch (e) {
      if (e instanceof AuthError) {
        // הסיסמה הוחלפה – נכנסים מחדש
        logout();
        setState(resetSync);
        setSyncStatus('off');
        setLocked(true);
      } else {
        setSyncStatus(navigator.onLine ? 'error' : 'offline');
      }
    } finally {
      syncing.current = false;
      if (again.current) {
        again.current = false;
        setTimeout(sync, 300);
      }
    }
  }, []);

  // נעילה מחדש אחרי זמן ברקע
  useEffect(() => {
    let hiddenAt = null;
    const onChange = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS) setLocked(true);
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  // סנכרון: בפתיחה, כשחוזרים לאפליקציה, כשהרשת חוזרת, ופעם בדקה
  useEffect(() => {
    sync();
    const onVisible = () => document.visibilityState === 'visible' && sync();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', sync);
    const timer = setInterval(() => document.visibilityState === 'visible' && sync(), 60000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', sync);
      clearInterval(timer);
    };
  }, [sync]);

  // שינוי במכשיר -> נשלח לשרת אחרי שנייה וחצי של שקט
  useEffect(() => {
    if (!getToken() || !collectChanges(state).length) return undefined;
    const t = setTimeout(sync, 1500);
    return () => clearTimeout(t);
  }, [state, sync]);

  // תזכורות: בודקים כל חצי דקה כשהאפליקציה פתוחה (התראה מהיומן מגיעה גם כשהיא סגורה)
  useEffect(() => {
    const check = () => {
      const due = dueReminders(latest.current);
      if (!due.length) return;
      for (const t of due) notify(t);
      setToast(due[0]);
      setState((s) => {
        const notified = { ...s.notified };
        for (const t of due) notified[t.id] = Date.now();
        return { ...s, notified };
      });
    };
    check();
    const timer = setInterval(check, 30000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  // פתיחה מתוך התראה: #task=<id>
  useEffect(() => {
    const open = () => {
      const m = window.location.hash.match(/task=(\w+)/);
      if (!m) return;
      const task = latest.current.tasks.find((t) => t.id === m[1]);
      if (task) setEditing(task);
      window.history.replaceState(null, '', appPath());
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);

  const ctx = useMemo(() => ({
    state,
    act,
    edit: (task) => setEditing(task),
    openDay: (key) => {
      setDay(key);
      setTab('day');
    },
    openArea: (id) => {
      setArea(id);
      setTab('areas');
    },
    openLater: (seg) => {
      setLaterSeg(seg);
      setTab('later');
    },
    importText: (text) => setImporting(text ?? ''),
    syncStatus,
    syncNow: sync,
    lock: () => setLocked(true),
    openRequests: () => setSheet('requests'),
    openSpaces: () => setSheet('spaces'),
  }), [state, act, syncStatus, sync]);

  if (locked) {
    return (
      <LockScreen
        onUnlock={({ online }) => {
          lockedRef.current = false;
          setLocked(false);
          setSyncStatus(online ? 'ok' : 'offline');
          sync();
          // המכשיר נרשם מחדש להתראות (אם הן מופעלות) – כדי שהשרת תמיד יוכל לשלוח אליו
          if (online) enablePush();
        }}
      />
    );
  }

  return (
    <Store.Provider value={ctx}>
      <div className="min-h-screen max-w-xl mx-auto pb-28 lg:max-w-none lg:mr-64 lg:pb-12" dir="rtl">
        <header className="lg:hidden sticky top-0 z-20 bg-page/90 backdrop-blur px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2 flex items-center justify-between">
          <h1 className="text-2xl font-black text-violet-700 tracking-tight whitespace-nowrap">יהיה בסדר</h1>
          <div className="flex gap-1">
            <SyncButton status={syncStatus} onClick={() => (syncStatus === 'off' ? setLocked(true) : sync())} />
            <ThemeButton />
            <button aria-label="חיפוש" onClick={() => setSheet('search')} className="p-2 rounded-full hover:bg-violet-100 text-stone-600"><Search size={22} /></button>
            <button aria-label="הגדרות" onClick={() => setSheet('settings')} className="p-2 rounded-full hover:bg-violet-100 text-stone-600"><Settings size={22} /></button>
          </div>
        </header>

        <main className="px-4 lg:px-10 lg:pt-8 lg:max-w-6xl lg:mx-auto">
          {/* מעבר לשונית מאפס את רשת הביטחון */}
          <ErrorBoundary key={tab} onReset={() => { setArea(null); setTab('home'); }}>
            {tab === 'home' && <Dashboard />}
            {tab === 'day' && <DayView day={day} setDay={setDay} />}
            {tab === 'areas' && <AreasView area={area} setArea={setArea} />}
            {tab === 'later' && <LaterView seg={laterSeg} setSeg={setLaterSeg} />}
          </ErrorBoundary>
        </main>
      </div>

      <BottomNav tab={tab} setTab={(t) => { setTab(t); if (t === 'areas') setArea(null); if (t === 'day') setDay(todayKey()); }} onAdd={() => setEditing({ due: tab === 'day' ? day : null, categoryId: tab === 'areas' ? area : null, type: tab === 'later' ? laterSeg : 'task' })} />
      <SideNav tab={tab} setTab={(t) => { setTab(t); if (t === 'areas') setArea(null); if (t === 'day') setDay(todayKey()); }} onAdd={() => setEditing({ due: tab === 'day' ? day : null, categoryId: tab === 'areas' ? area : null, type: tab === 'later' ? laterSeg : 'task' })}>
        <SyncButton status={syncStatus} onClick={() => (syncStatus === 'off' ? setLocked(true) : sync())} />
        <ThemeButton />
        <button aria-label="חיפוש" onClick={() => setSheet('search')} className="p-2 rounded-full hover:bg-violet-100 text-stone-600"><Search size={22} /></button>
        <button aria-label="הגדרות" onClick={() => setSheet('settings')} className="p-2 rounded-full hover:bg-violet-100 text-stone-600"><Settings size={22} /></button>
        {/* בקשות לשינוי – רק באפליקציה הראשית (לא אצל אדם נוסף) */}
        {!SPACE && <button aria-label="בקשה לשינוי באפליקציה" title="בקשה לשינוי באפליקציה" onClick={() => setSheet('requests')} className="p-2 rounded-full hover:bg-violet-100 text-stone-600"><MessageSquarePlus size={22} /></button>}
      </SideNav>

      {editing && <TaskEditor initial={editing} onClose={() => setEditing(null)} />}
      {importing != null && <ImportSheet text={importing} onClose={() => setImporting(null)} />}
      {sheet === 'settings' && <SettingsSheet onClose={() => setSheet(null)} />}
      {sheet === 'search' && <SearchSheet onClose={() => setSheet(null)} />}
      {sheet === 'requests' && <RequestsSheet onClose={() => setSheet(null)} />}
      {sheet === 'spaces' && <SpacesSheet onClose={() => setSheet(null)} />}

      {toast && (
        <button
          onClick={() => { setEditing(toast); setToast(null); }}
          className="fixed top-3 inset-x-3 z-50 max-w-xl mx-auto rounded-2xl bg-violet-600 text-white shadow-xl p-4 text-right"
        >
          <div className="text-xs opacity-80">🔔 תזכורת{toast.time ? ` · ${toast.time}` : ''}</div>
          <div className="font-bold">{toast.title}</div>
          <span onClick={(e) => { e.stopPropagation(); setToast(null); }} className="absolute top-2 left-3 text-white/70 text-lg">×</span>
        </button>
      )}
    </Store.Provider>
  );
}

const SYNC_LOOK = {
  off: { icon: CloudOff, label: 'לא מסונכרן – לחצי להתחברות', className: 'text-stone-400' },
  syncing: { icon: RefreshCw, label: 'מסנכרן...', className: 'text-violet-500 animate-spin' },
  ok: { icon: Cloud, label: 'מסונכרן', className: 'text-emerald-600' },
  offline: { icon: CloudOff, label: 'אין אינטרנט – יסונכרן כשהרשת תחזור', className: 'text-amber-500' },
  error: { icon: CloudOff, label: 'הסנכרון נכשל – לחצי לנסות שוב', className: 'text-rose-500' },
};

// מעבר מהיר בין יום ללילה (בהגדרות אפשר גם "אוטומטי")
function ThemeButton() {
  const { pref, dark } = useTheme();
  const label = dark ? 'מעבר למצב יום' : 'מעבר למצב לילה';
  return (
    <button aria-label={label} title={label} onClick={() => setTheme(toggledTheme(pref, systemDark()))} className="p-2 rounded-full hover:bg-violet-100 text-stone-600">
      {dark ? <Sun size={22} /> : <Moon size={22} />}
    </button>
  );
}

function SyncButton({ status, onClick }) {
  const look = SYNC_LOOK[status] || SYNC_LOOK.off;
  const Icon = look.icon;
  return (
    <button aria-label={look.label} title={look.label} onClick={onClick} className="p-2 rounded-full hover:bg-violet-100">
      <Icon size={22} className={look.className} />
    </button>
  );
}
