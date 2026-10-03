import { BookOpen, CalendarDays, Refrigerator, ShoppingCart } from 'lucide-react';

// ניווט בין המסכים הראשיים
export default function BottomNav({ view, shoppingCount }) {
  const tabs = [
    ['home', '#', 'ספר המתכונים', BookOpen],
    ['plan', '#/plan', 'תכנון שבועי', CalendarDays],
    ['fridge', '#/fridge', 'מה יש במקרר', Refrigerator],
    ['shopping', '#/shopping', 'קניות', ShoppingCart],
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-stone-200 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-3xl mx-auto grid grid-cols-4">
        {tabs.map(([key, href, label, Icon]) => (
          <a
            key={key}
            href={href}
            onClick={key === 'home' ? (e) => { e.preventDefault(); window.location.hash = ''; } : undefined}
            className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${view === key ? 'text-orange-600 font-bold' : 'text-stone-500'}`}
          >
            <Icon size={22} />
            {label}
            {key === 'shopping' && shoppingCount > 0 && (
              <span className="absolute top-1 left-1/2 ml-2 min-w-4 h-4 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                {shoppingCount}
              </span>
            )}
          </a>
        ))}
      </div>
    </nav>
  );
}
