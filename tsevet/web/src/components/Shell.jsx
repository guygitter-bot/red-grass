// מסגרת האפליקציה: בטלפון – סרגל עליון ותפריט תחתון; במחשב – עמודה ימנית עם התפריט והשיחות
import { Users, MessageSquare, Wallet, Settings as Cog, Moon, Sun, Plus, Clock, DoorOpen } from 'lucide-react';
import { go } from '../lib/route';
import { getTheme, isDark, setTheme } from '../lib/theme';
import { useState } from 'react';
import TeamBoard from './TeamBoard';
import ConvList from './ConvList';
import Chat from './Chat';
import Costs from './Costs';
import Settings from './Settings';
import Schedules from './Schedules';
import { newConversation } from '../lib/convs';
import RoomSheet from './RoomSheet';

const NAV = [
  ['team', '/', 'צוות', Users],
  ['chats', '/chats', 'שיחות', MessageSquare],
  ['schedules', '/schedules', 'קבועות', Clock],
  ['costs', '/costs', 'עלויות', Wallet],
  ['settings', '/settings', 'הגדרות', Cog],
];

function ThemeButton() {
  const [, force] = useState(0);
  const dark = isDark(getTheme());
  return (
    <button
      onClick={() => {
        setTheme(dark ? 'light' : 'dark');
        force((n) => n + 1);
      }}
      className="rounded-full p-2 text-muted hover:bg-soft"
      aria-label="מצב לילה / יום"
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}

export default function Shell({ route, team, error, refresh, onLogout }) {
  const inChat = route.name === 'chat';
  const agents = team?.agents || [];
  const convs = team?.convs || [];
  const [roomOpen, setRoomOpen] = useState(false);

  return (
    <div className="flex h-dvh flex-col bg-page lg:flex-row">
      {/* מחשב: עמודה ימנית */}
      <aside className="hidden w-80 shrink-0 flex-col border-l border-line bg-card lg:flex">
        <div className="flex items-center justify-between px-5 pt-5">
          <h1 className="text-xl font-bold">הצוות</h1>
          <ThemeButton />
        </div>
        <nav className="flex gap-1 px-3 pt-3">
          {NAV.filter(([n]) => n !== 'chats').map(([name, path, label, Icon]) => (
            <button
              key={name}
              onClick={() => go(path)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-medium ${route.name === name ? 'bg-soft text-accent-ink' : 'text-muted hover:bg-soft'}`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
        <div className="px-3 pt-3">
          <div className="flex gap-2">
            <button onClick={() => newConversation(null)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 font-medium text-white hover:opacity-90">
              <Plus size={18} /> שיחה חדשה
            </button>
            <button onClick={() => setRoomOpen(true)} className="flex items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2.5 font-medium hover:bg-soft">
              <DoorOpen size={18} /> חדר
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          <ConvList convs={convs} agents={agents} activeId={inChat ? route.id : null} refresh={refresh} compact />
        </div>
      </aside>

      {/* טלפון: סרגל עליון (לא בצ'אט – שם יש כותרת משלו) */}
      {!inChat && (
        <header className="flex shrink-0 items-center justify-between border-b border-line bg-card px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] lg:hidden">
          <h1 className="text-lg font-bold">הצוות</h1>
          <ThemeButton />
        </header>
      )}

      <main className={`min-h-0 flex-1 ${inChat ? 'flex flex-col' : 'overflow-y-auto'}`}>
        {error && !team && <p className="m-4 rounded-xl border border-line bg-card p-3 text-sm text-bad">{error}</p>}
        {route.name === 'team' && <TeamBoard team={team} />}
        {route.name === 'chats' && (
          <div className="mx-auto max-w-2xl p-3">
            <div className="mb-3 flex gap-2">
              <button onClick={() => newConversation(null)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 font-medium text-white">
                <Plus size={18} /> שיחה חדשה
              </button>
              <button onClick={() => setRoomOpen(true)} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-card px-3 py-2.5 font-medium">
                <DoorOpen size={18} /> חדר חדש
              </button>
            </div>
            <ConvList convs={convs} agents={agents} refresh={refresh} />
          </div>
        )}
        {route.name === 'chat' && <Chat key={route.id} id={route.id} agents={agents} refresh={refresh} />}
        {route.name === 'costs' && <Costs agents={agents} />}
        {route.name === 'schedules' && <Schedules agents={agents} />}
        {route.name === 'settings' && <Settings team={team} onLogout={onLogout} />}
      </main>
      {roomOpen && (
        <RoomSheet
          agents={agents}
          onClose={() => {
            setRoomOpen(false);
            refresh();
          }}
        />
      )}

      {/* טלפון: תפריט תחתון (לא בצ'אט, כדי שהשורה לכתיבה לא תוסתר) */}
      {!inChat && (
        <nav className="flex shrink-0 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
          {NAV.map(([name, path, label, Icon]) => (
            <button
              key={name}
              onClick={() => go(path)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${route.name === name ? 'text-accent-ink' : 'text-muted'}`}
            >
              <Icon size={22} />
              {label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
