// יומן סוכר: מסך יום (ארוחות, מדידות, גרף), מחשבון אינסולין, לוח שנה, תפריט קבוע, מעקב ודפוסים, שיחה עם AI והגדרות.
// ניווט לפי כתובת (#/day/2026-11-04, #/calc, #/cal/2026-11, #/menu, #/stats, #/chat, #/settings, #/more) כדי שכפתור "חזרה" יעבוד.
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Calculator as CalcIcon, CalendarDays, CalendarRange, ChevronLeft, Cloud, CloudOff, Droplet, Menu, MessageCircle, Moon, RefreshCw, Settings as Gear, Sun, UtensilsCrossed } from 'lucide-react';
import { prepare, today } from './lib/diary';
import { sync, useStore } from './lib/store';
import { isDark, setTheme } from './lib/theme';
import { getMe } from './lib/me';
import Login from './components/Login';
import DayView from './components/DayView';
import MenuView from './components/MenuView';
import StatsView from './components/StatsView';
import ChatView from './components/ChatView';
import Settings from './components/Settings';
import Calculator from './components/Calculator';
import CalendarView from './components/CalendarView';

const PAGES = ['day', 'calc', 'cal', 'menu', 'stats', 'chat', 'settings', 'more'];

function parseHash() {
  const [, page = 'day', arg] = window.location.hash.replace(/^#/, '').split('/');
  return { page: PAGES.includes(page) ? page : 'day', date: /^\d{4}-\d{2}-\d{2}$/.test(arg || '') ? arg : '', month: /^\d{4}-\d{2}$/.test(arg || '') ? arg : '' };
}

// תפריט הצד במחשב – הכול
const NAV = [
  ['day', 'היום', CalendarDays],
  ['calc', 'מחשבון', CalcIcon],
  ['cal', 'לוח שנה', CalendarRange],
  ['stats', 'מעקב', BarChart3],
  ['chat', 'שאלות ל-AI', MessageCircle],
  ['menu', 'תפריט קבוע', UtensilsCrossed],
  ['settings', 'הגדרות', Gear],
];
// הסרגל התחתון בטלפון – והשאר תחת "עוד"
const TABS = [
  ['day', 'היום', CalendarDays],
  ['calc', 'מחשבון', CalcIcon],
  ['cal', 'לוח', CalendarRange],
  ['stats', 'מעקב', BarChart3],
  ['chat', 'AI', MessageCircle],
  ['more', 'עוד', Menu],
];
const MORE = ['menu', 'settings'];

function MoreView({ go }) {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-2xl font-bold">עוד</h1>
      <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
        {NAV.filter(([p]) => MORE.includes(p)).map(([page, label, Icon]) => (
          <button key={page} onClick={() => go(page)} className="flex w-full items-center gap-3 border-b border-line px-4 py-4 text-right font-medium last:border-0 hover:bg-soft">
            <Icon size={20} className="text-accent" />
            <span className="flex-1">{label}</span>
            <ChevronLeft size={18} className="text-muted" />
          </button>
        ))}
      </div>
    </div>
  );
}

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
  const { records, status } = useStore();
  // מסך פתיחה רק בפעם הראשונה במכשיר (כשעוד אין שם)
  const [welcomed, setWelcomed] = useState(() => !!getMe());
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

  if (!welcomed) return <Login onDone={() => setWelcomed(true)} />;

  const go = (page, arg) => {
    if (page === 'day' && arg && arg !== day) window.location.hash = `#/day/${arg}`;
    else if (page === 'cal' && arg && arg !== day.slice(0, 7)) window.location.hash = `#/cal/${arg}`;
    else window.location.hash = `#/${page}`;
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
          {route.page === 'day' && <DayView data={data} date={route.date || day} go={(d) => go('day', d)} openCal={(m) => go('cal', m)} />}
          {route.page === 'calc' && <Calculator data={data} />}
          {route.page === 'cal' && <CalendarView data={data} month={route.month || day.slice(0, 7)} go={(m) => go('cal', m)} openDay={(d) => go('day', d)} />}
          {route.page === 'more' && <MoreView go={go} />}
          {route.page === 'menu' && <MenuView data={data} />}
          {route.page === 'stats' && <StatsView data={data} openDay={(d) => go('day', d)} openChat={() => go('chat')} />}
          {route.page === 'chat' && <ChatView data={data} />}
          {route.page === 'settings' && <Settings data={data} records={records} />}
        </main>
      </div>

      {/* סרגל תחתון בטלפון */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {TABS.map(([page, label, Icon]) => (
          <button key={page} onClick={() => go(page)} className={`flex flex-col items-center gap-0.5 py-2 text-xs ${route.page === page || (page === 'more' && MORE.includes(route.page)) ? 'text-accent-ink' : 'text-muted'}`}>
            <Icon size={22} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
