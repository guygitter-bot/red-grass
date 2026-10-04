import { CalendarDays, LayoutDashboard, Lightbulb, Plus, Shapes } from 'lucide-react';

const TABS = [
  { id: 'home', label: 'לוח', icon: LayoutDashboard },
  { id: 'day', label: 'יומי', icon: CalendarDays },
  null,
  { id: 'areas', label: 'תחומים', icon: Shapes },
  { id: 'later', label: 'לבדוק', icon: Lightbulb },
];

export default function BottomNav({ tab, setTab, onAdd }) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-violet-100 pb-safe">
      <div className="max-w-xl mx-auto grid grid-cols-5 items-end">
        {TABS.map((t) => {
          if (!t) {
            return (
              <div key="add" className="flex justify-center">
                <button aria-label="משימה חדשה" onClick={onAdd} className="-mt-6 w-14 h-14 rounded-full bg-violet-600 text-white shadow-lg shadow-violet-300 flex items-center justify-center active:scale-95 transition">
                  <Plus size={28} strokeWidth={2.5} />
                </button>
              </div>
            );
          }
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center gap-0.5 pt-2 pb-1 text-xs ${active ? 'text-violet-700 font-bold' : 'text-stone-500'}`}>
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// במחשב: תפריט צד קבוע במקום הסרגל התחתון
export function SideNav({ tab, setTab, onAdd, children }) {
  return (
    <aside className="hidden lg:flex fixed inset-y-0 right-0 z-30 w-64 flex-col border-l border-violet-100 bg-white px-4 py-6">
      <div className="px-3 text-3xl font-black text-violet-700 tracking-tight whitespace-nowrap">יהיה בסדר</div>
      <button onClick={onAdd} className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-violet-600 text-white font-bold py-3 shadow-lg shadow-violet-200 hover:bg-violet-700 transition">
        <Plus size={20} strokeWidth={2.5} />משימה חדשה
      </button>
      <nav className="mt-6 space-y-1">
        {TABS.filter(Boolean).map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-right transition ${active ? 'bg-violet-100 text-violet-800 font-bold' : 'text-stone-600 hover:bg-stone-100'}`}>
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              {SIDE_LABELS[t.id]}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center justify-center gap-1 border-t border-stone-100 pt-4">{children}</div>
    </aside>
  );
}

const SIDE_LABELS = { home: 'לוח משימות', day: 'תצוגה יומית', areas: 'תחומי חיים', later: 'לבדוק ומעקבים' };
