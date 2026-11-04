// יומן סוכר: מסך יום (ארוחות, מדידות, גרף), תפריט קבוע, מעקב ודפוסים, שיחה עם AI והגדרות.
// ניווט לפי כתובת (#/day/2026-11-04, #/menu, #/stats, #/chat, #/settings) כדי שכפתור "חזרה" יעבוד.
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Cloud, CloudOff, Droplet, MessageCircle, Moon, RefreshCw, Settings as Gear, Sun, UtensilsCrossed } from 'lucide-react';
import { prepare, today } from './lib/diary';
import { sync, useStore } from './lib/store';
import { isDark, setTheme } from './lib/theme';
import Login from './components/Login';
import DayView from './components/DayView';
import MenuView from './components/MenuView';
import StatsView from './components/StatsView';
import ChatView from './components/ChatView';
import Settings from './components/Settings';

const PAGES = ['day', 'menu', 'stats', 'chat', 'settings'];

function parseHash() {
  const [, page = 'day', arg] = window.location.hash.replace(/^#/, '').split('/');
  return { page: PAGES.includes(page) ? page : 'day', date: /^\d{4}-\d{2}-\d{2}$/.test(arg || '') ? arg : '' };
}

const NAV = [
  ['day', 'היום', CalendarDays],
  ['menu', 'תפריט קבוע', UtensilsCrossed],
  ['stats', 'מעקב', BarChart3],
  ['chat', 'שאלות ל-AI', MessageCircle],
  ['settings', 'הגדרות', Gear],
];

function SyncIcon({ status }) {
  const map = {
    ok: [Cloud, 'מסונכרן', 'text-ok'],
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
  const day = today();
  const data = useMemo(() => ({ ...prepare(records), today: day }), [records, day]);

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

  const go = (page, date) => {
    window.location.hash = page === 'day' && date && date !== day ? `#/day/${date}` : `#/${page}`;
  };
  const toggleDark = () => {
    setTheme(dark ? 'light' : 'dark');
    setDark(!dark);
  };
  const title = data.settings.person ? `יומן סוכר · ${data.settings.person}` : 'יומן סוכר';

  return (
    <div className="min-h-dvh lg:flex">
      {/* תפריט צד במחשב */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-l border-line bg-card p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2 text-xl font-bold">
          <Droplet className="text-accent" /> {title}
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
        <p className="mb-2 px-2 text-xs text-muted">היומן והחישובים לא מחליפים את הצוות הרפואי.</p>
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
            <Droplet size={20} className="text-accent" /> {title}
          </div>
          <div className="flex items-center">
            <SyncIcon status={status} />
            <button onClick={toggleDark} className="rounded-full p-2 hover:bg-soft" aria-label="מצב לילה">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pt-4 pb-28 lg:px-8 lg:pt-8 lg:pb-10">
          {route.page === 'day' && <DayView data={data} date={route.date || day} go={(d) => go('day', d)} />}
          {route.page === 'menu' && <MenuView data={data} />}
          {route.page === 'stats' && <StatsView data={data} openDay={(d) => go('day', d)} />}
          {route.page === 'chat' && <ChatView data={data} />}
          {route.page === 'settings' && <Settings data={data} records={records} />}
        </main>
      </div>

      {/* סרגל תחתון בטלפון */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map(([page, label, Icon]) => (
          <button key={page} onClick={() => go(page)} className={`flex flex-col items-center gap-0.5 py-2 text-xs ${route.page === page ? 'text-accent-ink' : 'text-muted'}`}>
            <Icon size={22} />
            {label === 'שאלות ל-AI' ? 'AI' : label === 'תפריט קבוע' ? 'תפריט' : label}
          </button>
        ))}
      </nav>
    </div>
  );
}
