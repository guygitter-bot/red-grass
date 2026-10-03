import { BookOpen, CalendarDays, Camera, Refrigerator, ShoppingCart } from 'lucide-react';

// ניווט בין המסכים הראשיים, ובאמצע כפתור מצלמה לצילום מתכון (דף מספר, פתק...)
export default function BottomNav({ view, shoppingCount, onPhotos }) {
  const tab = (key, href, label, Icon) => (
    <a
      key={key}
      href={href}
      onClick={key === 'home' ? (e) => { e.preventDefault(); window.location.hash = ''; } : undefined}
      className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] leading-tight ${view === key ? 'text-orange-600 font-bold' : 'text-stone-500'}`}
    >
      <Icon size={22} />
      {label}
      {key === 'shopping' && shoppingCount > 0 && (
        <span className="absolute top-1 left-1/2 ml-2 min-w-4 h-4 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
          {shoppingCount}
        </span>
      )}
    </a>
  );
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-stone-200 pb-[env(safe-area-inset-bottom)] print:hidden">
      <div className="max-w-3xl mx-auto grid grid-cols-5 items-end">
        {tab('home', '#', 'המתכונים', BookOpen)}
        {tab('plan', '#/plan', 'תכנון שבועי', CalendarDays)}
        <label className="flex flex-col items-center gap-0.5 pb-2 text-[11px] leading-tight text-orange-700 font-bold cursor-pointer">
          <span className="-mt-5 w-14 h-14 rounded-full bg-orange-500 text-white shadow-lg ring-4 ring-white flex items-center justify-center">
            <Camera size={26} />
          </span>
          צילום מתכון
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => {
              if (!e.target.files?.length) return;
              onPhotos([...e.target.files]);
              e.target.value = '';
            }}
          />
        </label>
        {tab('fridge', '#/fridge', 'מה יש במקרר', Refrigerator)}
        {tab('shopping', '#/shopping', 'קניות', ShoppingCart)}
      </div>
    </nav>
  );
}
