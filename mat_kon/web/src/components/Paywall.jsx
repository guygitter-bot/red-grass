import { Sparkles, X } from 'lucide-react';

// נגמרו המתכונים החינמיים. התשלום עצמו עוד לא מחובר: אם הוגדר PAYMENT_URL בשרת מופיע כפתור אליו,
// ובינתיים בעל האפליקציה מסמן מנוי ידנית במסך ההזמנות.
export default function Paywall({ user, paymentUrl, onClose }) {
  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 left-3 p-2 text-stone-400" aria-label="סגירה">
          <X size={20} />
        </button>
        <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-3">
          <Sparkles size={28} />
        </div>
        <h2 className="text-xl font-black mb-2">נגמרו המתכונים החינמיים</h2>
        <p className="text-stone-600 leading-relaxed">
          הוספת {user?.freeLimit ?? 10} מתכונים בחינם. כדי להמשיך להוסיף מתכונים צריך לשדרג למנוי.
          כל המתכונים שכבר שמרת נשארים זמינים.
        </p>
        {paymentUrl ? (
          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 block rounded-2xl bg-orange-500 text-white font-bold py-3"
          >
            לשדרוג
          </a>
        ) : (
          <p className="mt-5 rounded-2xl bg-stone-100 text-stone-700 p-3 text-sm">
            התשלום עוד לא זמין באפליקציה. פנו למי ששלח לכם את ההזמנה כדי לשדרג.
          </p>
        )}
      </div>
    </div>
  );
}
