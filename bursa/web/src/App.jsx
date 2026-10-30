import { useCallback, useEffect, useState } from 'react';
import { Bell, BookOpen, Home as HomeIcon, MessageCircle, Settings as SettingsIcon, TrendingUp, Wallet } from 'lucide-react';
import { api, getToken } from './lib/api';
import { useLive } from './lib/hooks';
import { parseHash } from './lib/route';
import Login from './components/Login';
import Home from './components/Home';
import Stock from './components/Stock';
import Portfolio from './components/Portfolio';
import Chat from './components/Chat';
import FloatingChat from './components/FloatingChat';
import Alerts from './components/Alerts';
import Learn from './components/Learn';
import Settings from './components/Settings';

const NAV = [
  ['home', '#/', 'בית', HomeIcon],
  ['portfolio', '#/portfolio', 'תיק', Wallet],
  ['chat', '#/chat', "צ'אט", MessageCircle],
  ['alerts', '#/alerts', 'התראות', Bell],
  ['learn', '#/learn', 'לימוד', BookOpen],
  ['settings', '#/settings', 'הגדרות', SettingsIcon],
];

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
    };
  }, []);
  return hash;
}

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [unread, setUnread] = useState(0);
  const [toastText, setToastText] = useState('');
  const hash = useHash();
  const route = parseHash(hash);

  useEffect(() => {
    const out = () => setAuthed(false);
    window.addEventListener('bursa-logout', out);
    return () => {
      window.removeEventListener('bursa-logout', out);
    };
  }, []);

  useEffect(() => {
    const onToast = (e) => setToastText(e.detail);
    window.addEventListener('bursa-toast', onToast);
    return () => {
      window.removeEventListener('bursa-toast', onToast);
    };
  }, []);

  useEffect(() => {
    if (!toastText) return undefined;
    const timer = setTimeout(() => setToastText(''), 3500);
    return () => {
      clearTimeout(timer);
    };
  }, [toastText]);

  // מספר ההתראות שלא נקראו (מתעדכן כל חצי דקה כשהאפליקציה פתוחה)
  const onRead = useCallback(() => setUnread(0), []);
  const loadUnread = useCallback(async () => {
    if (!authed) return;
    const r = await api('/home');
    setUnread(r.unread || 0);
  }, [authed]);
  useLive(loadUnread, 60000, [authed]);

  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  const active = route.name === 'stock' ? 'home' : route.name;
  const fullBleed = route.name === 'chat';

  return (
    <div className="min-h-dvh">
      {/* תפריט צד במחשב */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-56 flex-col border-e border-line bg-card p-4 lg:flex">
        <a href="#/" className="mb-6 flex items-center gap-2 text-xl font-bold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-on-accent"><TrendingUp size={20} /></span>
          בורסאי
        </a>
        <nav className="flex flex-col gap-1">
          {NAV.map(([id, href, label, Icon]) => (
            <a key={id} href={href} aria-current={active === id ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${active === id ? 'bg-soft text-accent-ink' : 'text-muted hover:bg-soft'}`}>
              <Icon size={20} />
              {label}
              {id === 'alerts' && unread > 0 && <span className="ms-auto rounded-full bg-down px-1.5 text-xs font-bold text-on-accent">{unread}</span>}
            </a>
          ))}
        </nav>
      </aside>

      <main className={`lg:ps-56 ${fullBleed ? '' : 'pb-24 lg:pb-8'}`}>
        {fullBleed ? (
          <Chat params={route.params} />
        ) : (
          <div className="mx-auto max-w-5xl px-4 py-4 lg:px-8 lg:py-6">
            {route.name === 'home' && <Home />}
            {route.name === 'stock' && <Stock key={route.symbol} symbol={route.symbol} />}
            {route.name === 'portfolio' && <Portfolio params={route.params} />}
            {route.name === 'alerts' && <Alerts onRead={onRead} />}
            {route.name === 'learn' && <Learn params={route.params} />}
            {route.name === 'settings' && <Settings />}
          </div>
        )}
      </main>

      {/* סרגל תחתון בטלפון */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-card lg:hidden">
        {NAV.map(([id, href, label, Icon]) => (
          <a key={id} href={href} aria-current={active === id ? 'page' : undefined} className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active === id ? 'text-accent-ink' : 'text-muted'}`}>
            <Icon size={21} strokeWidth={active === id ? 2.4 : 1.8} />
            {label}
            {id === 'alerts' && unread > 0 && <span className="absolute start-1/2 top-1.5 ms-1.5 min-w-4 rounded-full bg-down px-1 text-center text-[10px] font-bold leading-4 text-on-accent">{unread}</span>}
          </a>
        ))}
      </nav>

      {/* צ'אט צף: נשאר בין מסכים, מוסתר במסך הצ'אט המלא */}
      {route.name !== 'chat' && <FloatingChat symbol={route.name === 'stock' ? route.symbol : ''} />}

      {toastText && (
        <div role="status" className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-sm rounded-xl bg-ink px-4 py-2.5 text-center text-sm text-page shadow-lg lg:bottom-6">{toastText}</div>
      )}
    </div>
  );
}
