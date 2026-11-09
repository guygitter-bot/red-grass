// שלד של המסך בזמן טעינה: צורות אפורות במקום ספינר, כך שהמסך נראה מוכן ולא "קופץ" כשהתוכן מגיע

export function CardsSkeleton({ count = 6 }) {
  return (
    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3" aria-busy="true" aria-label="טוען מתכונים">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
          <div className="aspect-[4/3] bg-stone-200" />
          <div className="p-2.5 space-y-2">
            <div className="h-3.5 bg-stone-200 rounded-full w-4/5" />
            <div className="h-2.5 bg-stone-100 rounded-full w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// מסך שנטען בפעם הראשונה (קובץ המסך עוד בדרך)
export function ScreenSkeleton() {
  return (
    <div className="min-h-screen bg-[#fffbf5]" aria-busy="true" aria-label="טוען">
      <div className="h-14 border-b border-stone-100 pt-[env(safe-area-inset-top)] flex items-center px-4">
        <div className="h-4 w-32 bg-stone-200 rounded-full animate-pulse" />
      </div>
      <div className="max-w-2xl mx-auto px-4 animate-pulse">
        <div className="mt-5 h-12 bg-stone-200 rounded-2xl" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 bg-white rounded-2xl shadow-sm" />)}
        </div>
      </div>
    </div>
  );
}
