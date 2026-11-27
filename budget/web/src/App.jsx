// תקציב הבית: מסך חודש, דוח חודשי (כמו האקסל), שנה קדימה, גרפים, תובנות AI, כרטיסי אשראי, כל הרשומות והגדרות.
// ניווט לפי כתובת (#/month/2027-03, #/report/2027-03, #/year, #/charts, #/ai, #/cards, #/items, #/settings, #/fixes, #/transactions, #/more)
// כדי שכפתור "חזרה" יעבוד.
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, ChevronDown, ChevronLeft, Cloud, CloudOff, CreditCard, FileSpreadsheet, FileText, LayoutDashboard, ListChecks, Mail, Menu, Moon, RefreshCw, Settings as Gear, Sparkles, Sun, TrendingUp, Wallet, Wrench } from 'lucide-react';
import { prepare, thisMonth } from './lib/budget';
import { sync, useStore } from './lib/store';
import { isDark, setTheme } from './lib/theme';
import Login from './components/Login';
import DashboardView from './components/DashboardView';
import MonthView from './components/MonthView';
import YearView from './components/YearView';
import ItemsView from './components/ItemsView';
import Settings from './components/Settings';
import ReportView from './components/ReportView';
import ChartsView from './components/ChartsView';
import InsightsView from './components/InsightsView';
import CardsView from './components/CardsView';
import FixesView from './components/FixesView';
import TransactionsView from './components/TransactionsView';
import InvoicesView from './components/InvoicesView';

function parseHash() {
  const [, page = 'home', arg] = window.location.hash.replace(/^#/, '').split('/');
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(arg || '') ? arg : thisMonth();
  return { page: PAGES.includes(page) ? page : 'home', month };
}

const PAGES = ['home', 'month', 'report', 'year', 'charts', 'ai', 'cards', 'items', 'settings', 'fixes', 'transactions', 'invoices', 'more'];

// כל המסכים (בטלפון: רשימת "עוד"; במחשב: לשוניות בכותרת + תפריט "עוד")
const NAV = [
  ['home', 'סקירה', LayoutDashboard],
  ['month', 'חודש', CalendarDays],
  ['report', 'דוח חודשי', FileText],
  ['year', 'שנה קדימה', TrendingUp],
  ['charts', 'גרפים', BarChart3],
  ['ai', 'תובנות AI', Sparkles],
  ['invoices', 'חשבוניות', Mail],
  ['transactions', 'ייבוא תנועות', FileSpreadsheet],
  ['cards', 'כרטיסי אשראי', CreditCard],
  ['items', 'הכול', ListChecks],
  ['settings', 'הגדרות', Gear],
  ['fixes', 'בקשת שינוי', Wrench],
];
// הסרגל התחתון בטלפון – החמישה העיקריים, והשאר תחת "עוד"
const TABS = [
  ['home', 'סקירה', LayoutDashboard],
  ['month', 'חודש', CalendarDays],
  ['report', 'דוח', FileText],
  ['ai', 'תובנות', Sparkles],
  ['more', 'עוד', Menu],
];
// הלשוניות שמוצגות ישר בכותרת במחשב; השאר בתפריט "עוד"
const TOP = ['home', 'month', 'report', 'invoices', 'charts', 'ai'];
const MORE = ['invoices', 'charts', 'transactions', 'year', 'cards', 'items', 'settings', 'fixes'];

function MoreView({ go }) {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-2xl font-bold">עוד</h1>
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
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
  const [menu, setMenu] = useState(false);
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
    window.location.hash = (page === 'home' || page === 'month' || page === 'report') && month ? `#/${page}/${month}` : `#/${page}`;
  };
  const toggleDark = () => {
    setTheme(dark ? 'light' : 'dark');
    setDark(!dark);
  };

  return (
    <div className="min-h-dvh">
      {/* כותרת עליונה במחשב: שם, לשוניות, סנכרון ומצב לילה */}
      <header className="sticky top-0 z-30 hidden border-b border-line bg-card/95 backdrop-blur lg:block print:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-8">
          <div className="flex items-center gap-2 py-4 text-xl font-extrabold">
            <Wallet className="text-navy" /> תקציב הבית
          </div>
          <nav className="flex flex-1 items-center gap-1">
            {NAV.filter(([p]) => TOP.includes(p)).map(([page, label]) => (
              <button
                key={page}
                onClick={() => go(page)}
                className={`border-b-2 px-3 py-4 text-sm font-medium ${route.page === page ? 'border-navy text-ink' : 'border-transparent text-muted hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
            <div className="relative">
              <button
                onClick={() => setMenu(!menu)}
                className={`flex items-center gap-1 border-b-2 px-3 py-4 text-sm font-medium ${!TOP.includes(route.page) ? 'border-navy text-ink' : 'border-transparent text-muted hover:text-ink'}`}
              >
                עוד <ChevronDown size={14} />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                  <div className="absolute start-0 top-full z-50 w-52 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-lg">
                    {NAV.filter(([p]) => !TOP.includes(p)).map(([page, label, Icon]) => (
                      <button
                        key={page}
                        onClick={() => {
                          setMenu(false);
                          go(page);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-right text-sm hover:bg-soft"
                      >
                        <Icon size={17} className="text-muted" /> {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </nav>
          <div className="flex items-center gap-1">
            <SyncIcon status={status} />
            <button onClick={toggleDark} className="rounded-full p-2 hover:bg-soft" aria-label="מצב לילה">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      <div className="min-w-0">
        {/* כותרת בטלפון */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-card/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden print:hidden">
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

        <main className={`mx-auto ${route.page === 'home' ? 'max-w-7xl' : 'max-w-5xl'} px-4 pt-4 pb-28 lg:px-8 lg:pt-8 lg:pb-10 print:p-0`}>
          {route.page === 'home' && <DashboardView data={data} month={route.month} go={go} />}
          {route.page === 'month' && <MonthView data={data} month={route.month} go={(m) => go('month', m)} />}
          {route.page === 'year' && <YearView data={data} open={(m) => go('month', m)} />}
          {route.page === 'report' && <ReportView data={data} month={route.month} go={(m) => go('report', m)} />}
          {route.page === 'charts' && <ChartsView data={data} />}
          {route.page === 'ai' && <InsightsView data={data} />}
          {route.page === 'cards' && <CardsView data={data} />}
          {route.page === 'items' && <ItemsView data={data} />}
          {route.page === 'settings' && <Settings data={data} records={records} />}
          {route.page === 'fixes' && <FixesView />}
          {route.page === 'invoices' && <InvoicesView data={data} />}
          {route.page === 'transactions' && <TransactionsView data={data} />}
          {route.page === 'more' && <MoreView go={go} />}
        </main>
      </div>

      {/* סרגל תחתון בטלפון */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden">
        {TABS.map(([page, label, Icon]) => (
          <button
            key={page}
            onClick={() => go(page)}
            className={`flex flex-col items-center gap-0.5 py-2 text-xs ${route.page === page || (page === 'more' && MORE.includes(route.page)) ? 'text-accent-ink' : 'text-muted'}`}
          >
            <Icon size={22} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
