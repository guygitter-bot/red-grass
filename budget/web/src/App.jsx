// תקציב הבית: מסך חודש, מבט לשנה קדימה, כל הרשומות והגדרות.
// ניווט לפי כתובת (#/month/2027-03, #/year, #/items, #/settings) כדי שכפתור "חזרה" יעבוד.
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Cloud, CloudOff, ListChecks, Moon, RefreshCw, Settings as Gear, Sun, TrendingUp, Wallet } from 'lucide-react';
import { prepare, thisMonth } from './lib/budget';
import { sync, useStore } from './lib/store';
import { isDark, setTheme } from './lib/theme';
import Login from './components/Login';
import MonthView from './components/MonthView';
import YearView from './components/YearView';
import ItemsView from './components/ItemsView';
import Settings from './components/Settings';

function parseHash() {
  const [, page = 'month', arg] = window.location.hash.replace(/^#/, '').split('/');
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(arg || '') ? arg : thisMonth();
  return { page: ['month', 'year', 'items', 'settings'].includes(page) ? page : 'month', month };
}

const NAV = [
  ['month', 'חודש', CalendarDays],
  ['year', 'שנה קדימה', TrendingUp],
  ['items', 'הכול', ListChecks],
  ['settings', 'הגדרות', Gear],
];

function SyncIcon({ status }) {
  const map = {
    ok: [Cloud, 'מסונכרן', 'text-plus'],
    syncing: [RefreshCw, 'מסנכרן…', 'animate-spin text-muted'],
    pending: [RefreshCw, 'ממתין לסנכרון', 'text-muted'],
    offline: [CloudOff, 'אין חיבור – נשמר במכשיר', 'text-minus'],
    error: [CloudOff, 'תקלה בסנכרון – נשמר במכשיר', 'text-minus'],
    idle: [Cloud, '', 'text-muted'],
  };
  const [Icon, label, cls] = map[status] || map.idle;
  return (
    <button onClick={() => sync()} title={label} aria-label={label} className="rounded-full p-2 hover:bg-soft">
      <Icon size={18} className={cls} />
    </button>
  );
}

export default function App() {
  const { records, status, authed } = useStore();
  const [route, setRoute] = useState(parseHash);
  const [dark, setDark] = useState(isDark());
  const data = useMemo(() => prepare(records), [records]);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  if (!authed) return <Login />;

  const go = (page, month) => {
    window.location.hash = page === 'month' && month ? `#/month/${month}` : `#/${page}`;
  };
  const toggleDark = () => {
    setTheme(dark ? 'light' : 'dark');
    setDark(!dark);
  };

  return (
    <div className="min-h-dvh lg:flex">
      {/* תפריט צד במחשב */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-l border-line bg-card p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2 text-xl font-bold">
          <Wallet className="text-accent" /> תקציב הבית
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map(([page, label, Icon]) => (
            <button
              key={page}
              onClick={() => go(page)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right font-medium ${route.page === page ? 'bg-soft text-accent-ink' : 'hover:bg-soft'}`}
            >
              <Icon size={20} /> {label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <SyncIcon status={status} />
          <button onClick={toggleDark} className="rounded-full p-2 hover:bg-soft" aria-label="מצב לילה">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* כותרת בטלפון */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-card/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
          <div className="flex items-center gap-2 py-3 font-bold">
            <Wallet size={20} className="text-accent" /> תקציב הבית
          </div>
          <div className="flex items-center">
            <SyncIcon status={status} />
            <button onClick={toggleDark} className="rounded-full p-2 hover:bg-soft" aria-label="מצב לילה">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pt-4 pb-28 lg:px-8 lg:pt-8 lg:pb-10">
          {route.page === 'month' && <MonthView data={data} month={route.month} go={(m) => go('month', m)} />}
          {route.page === 'year' && <YearView data={data} open={(m) => go('month', m)} />}
          {route.page === 'items' && <ItemsView data={data} />}
          {route.page === 'settings' && <Settings data={data} records={records} />}
        </main>
      </div>

      {/* סרגל תחתון בטלפון */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map(([page, label, Icon]) => (
          <button key={page} onClick={() => go(page)} className={`flex flex-col items-center gap-0.5 py-2 text-xs ${route.page === page ? 'text-accent-ink' : 'text-muted'}`}>
            <Icon size={22} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
