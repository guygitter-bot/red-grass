import { useCallback, useEffect, useMemo, useState } from 'react';
import { setToken } from './lib/api';
import { useSchool } from './lib/useSchool';
import Login from './components/Login';
import Calendar from './components/Calendar';
import Students from './components/Students';
import Teachers from './components/Teachers';
import Payments from './components/Payments';
import Inbox from './components/Inbox';
import More from './components/More';
import Panels from './components/Panels';
import { Logo, ThemeButton } from './components/ui';

// מורה שפתח את הקישור האישי שלו (#k=<סוד>): שומרים את הסוד במכשיר ומנקים את הכתובת
const fromLink = (() => {
  const m = window.location.hash.match(/k=([\w-]{20,100})/);
  if (!m) return false;
  setToken(m[1]);
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return true;
})();

const TABS = [
  { id: 'calendar', label: 'מערכת שעות', icon: '🗓️' },
  { id: 'students', label: 'תלמידים', icon: '🎒' },
  { id: 'teachers', label: 'מורים', icon: '🎸' },
  { id: 'payments', label: 'תשלומים', icon: '💰', manager: true },
  { id: 'more', label: 'עוד', icon: '⚙️' },
];

export default function App() {
  const school = useSchool();
  const { data, token, error, act, signIn, signOut } = school;
  const [tab, setTab] = useState('calendar');
  const [stack, setStack] = useState([]);
  const [toast, setToast] = useState(null);
  const [linkFailed, setLinkFailed] = useState(false);

  useEffect(() => {
    if (!token && fromLink) setLinkFailed(true);
  }, [token]);

  // קישור כניסה חדש שנפתח בלשונית שכבר פתוחה – טוענים מחדש כדי להשתמש בו
  useEffect(() => {
    const onHash = () => {
      if (/k=[\w-]{20,}/.test(window.location.hash)) window.location.reload();
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.ms || 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const open = useCallback((panel) => setStack((s) => [...s, panel]), []);
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const close = useCallback(() => setStack([]), []);
  const replace = useCallback((panel) => setStack((s) => [...s.slice(0, -1), panel]), []);

  // כל מה שהמסכים צריכים במקום אחד
  const app = useMemo(() => {
    if (!data) return null;
    const me = data.me;
    const isAdmin = me.role === 'admin';
    const isManager = isAdmin || me.level === 'manage';
    const canEdit = isManager || me.level === 'edit';
    const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
    return {
      ...data,
      me,
      isAdmin,
      isManager,
      canEdit,
      teacherMap: byId(data.teachers),
      studentMap: byId(data.students),
      roomMap: byId(data.settings.rooms),
      act,
      open,
      back,
      close,
      replace,
      toast: (text, extra = {}) => setToast({ text, ...extra }),
      setTab,
    };
  }, [data, act, open, back, close, replace]);

  if (!token) {
    return (
      <Login
        linkFailed={linkFailed}
        onToken={(t) => {
          setLinkFailed(false);
          signIn(t);
        }}
      />
    );
  }

  if (!app) {
    return (
      <div className="shards grid min-h-dvh place-items-center p-6 text-center text-white">
        <div>
          <Logo className="mx-auto h-28 animate-pulse" />
          <p className="mt-4 text-white/70">{error || 'טוען...'}</p>
        </div>
      </div>
    );
  }

  const tabs = TABS.filter((t) => !t.manager || app.isManager);
  const unread = app.notes.filter((n) => !n.read).length;
  const pending = app.requests.filter((r) => r.status === 'pending' && (r.to === app.me.id || app.isManager)).length;
  const badge = Math.max(unread, pending);

  const screen = {
    calendar: <Calendar app={app} />,
    students: <Students app={app} />,
    teachers: <Teachers app={app} />,
    payments: app.isManager ? <Payments app={app} /> : null,
    inbox: <Inbox app={app} />,
    more: <More app={app} signOut={signOut} />,
  }[tab];

  return (
    <div className="min-h-dvh pb-20 lg:pb-6">
      <header className="sticky top-0 z-30 bg-bar text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 lg:px-6">
          <button type="button" onClick={() => setTab('calendar')} className="flex items-center gap-2" aria-label="מערכת שעות">
            <Logo className="h-10" />
          </button>
          <nav className="ms-6 hidden gap-1 lg:flex">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${tab === t.id ? 'bg-accent text-black' : 'text-white/80 hover:bg-white/10'}`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
          <span className="ms-auto hidden truncate text-sm text-white/60 sm:block">{app.me.name}</span>
          {error && <span className="rounded-full bg-red-500/30 px-2 py-0.5 text-xs" title={error}>אין חיבור</span>}
          <button
            type="button"
            onClick={() => setTab('inbox')}
            className={`relative grid h-10 w-10 place-items-center rounded-full text-lg hover:bg-white/10 ${tab === 'inbox' ? 'bg-white/10' : ''} ms-auto sm:ms-0`}
            aria-label="התראות ובקשות"
          >
            🔔
            {badge > 0 && <span className="absolute -top-0.5 -end-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-xs font-bold text-black">{badge}</span>}
          </button>
          <ThemeButton />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 pt-3 lg:px-6 lg:pt-5">{screen}</main>

      {/* תפריט תחתון בטלפון */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${tab === t.id ? 'font-bold text-ink' : 'text-muted'}`}
          >
            <span className={`grid h-7 w-12 place-items-center rounded-full text-lg ${tab === t.id ? 'bg-accent' : ''}`}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <Panels app={app} stack={stack} />

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-8">
          <div className="sheet-in flex max-w-md items-center gap-3 rounded-2xl bg-bar px-4 py-3 text-white shadow-xl dark:border dark:border-line">
            <span className="text-sm">{toast.text}</span>
            {toast.action && (
              <a href={toast.action.href} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-black">
                {toast.action.label}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
