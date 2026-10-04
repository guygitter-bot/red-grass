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
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-violet-100 pb-safe">
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
