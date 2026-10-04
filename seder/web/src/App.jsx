import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Settings } from 'lucide-react';
import { dueReminders, load, save } from './lib/store';
import { todayKey } from './lib/dates';
import BottomNav from './components/BottomNav';
import Dashboard from './components/Dashboard';
import DayView from './components/DayView';
import AreasView from './components/AreasView';
import LaterView from './components/LaterView';
import TaskEditor from './components/TaskEditor';
import ImportSheet from './components/ImportSheet';
import SettingsSheet from './components/SettingsSheet';
import SearchSheet from './components/SearchSheet';
import { notify } from './lib/notify';

const Store = createContext(null);
export const useStore = () => useContext(Store);

// טקסט ששותף לאפליקציה מווטסאפ (share target) מגיע בכתובת: ?text=...&url=...
function sharedText() {
  const params = new URLSearchParams(window.location.search);
  const parts = ['title', 'text', 'url'].map((k) => params.get(k)).filter(Boolean);
  if (!parts.length) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.hash);
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

  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
    save(state);
  }, [state]);

  const act = useCallback((fn, ...args) => setState((s) => fn(s, ...args)), []);

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
      window.history.replaceState(null, '', window.location.pathname);
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
  }), [state, act]);

  return (
    <Store.Provider value={ctx}>
      <div className="min-h-screen max-w-xl mx-auto pb-28" dir="rtl">
        <header className="sticky top-0 z-20 bg-[#faf8ff]/90 backdrop-blur px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2 flex items-center justify-between">
          <h1 className="text-2xl font-black text-violet-700 tracking-tight">סדר</h1>
          <div className="flex gap-1">
            <button aria-label="חיפוש" onClick={() => setSheet('search')} className="p-2 rounded-full hover:bg-violet-100 text-stone-600"><Search size={22} /></button>
            <button aria-label="הגדרות" onClick={() => setSheet('settings')} className="p-2 rounded-full hover:bg-violet-100 text-stone-600"><Settings size={22} /></button>
          </div>
        </header>

        <main className="px-4">
          {tab === 'home' && <Dashboard />}
          {tab === 'day' && <DayView day={day} setDay={setDay} />}
          {tab === 'areas' && <AreasView area={area} setArea={setArea} />}
          {tab === 'later' && <LaterView seg={laterSeg} setSeg={setLaterSeg} />}
        </main>
      </div>

      <BottomNav tab={tab} setTab={(t) => { setTab(t); if (t === 'areas') setArea(null); if (t === 'day') setDay(todayKey()); }} onAdd={() => setEditing({ due: tab === 'day' ? day : null, categoryId: tab === 'areas' ? area : null, type: tab === 'later' ? laterSeg : 'task' })} />

      {editing && <TaskEditor initial={editing} onClose={() => setEditing(null)} />}
      {importing != null && <ImportSheet text={importing} onClose={() => setImporting(null)} />}
      {sheet === 'settings' && <SettingsSheet onClose={() => setSheet(null)} />}
      {sheet === 'search' && <SearchSheet onClose={() => setSheet(null)} />}

      {toast && (
        <button
          onClick={() => { setEditing(toast); setToast(null); }}
          className="fixed top-3 inset-x-3 z-50 max-w-xl mx-auto rounded-2xl bg-violet-700 text-white shadow-xl p-4 text-right"
        >
          <div className="text-xs opacity-80">🔔 תזכורת{toast.time ? ` · ${toast.time}` : ''}</div>
          <div className="font-bold">{toast.title}</div>
          <span onClick={(e) => { e.stopPropagation(); setToast(null); }} className="absolute top-2 left-3 text-white/70 text-lg">×</span>
        </button>
      )}
    </Store.Provider>
  );
}
