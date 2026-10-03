import { AlertCircle, Loader2, RotateCw, X } from 'lucide-react';
import { hostOf } from '../lib/recipes';

export default function PendingList({ items, onRetry, onDismiss }) {
  if (!items.length) return null;
  return (
    <div className="mt-4 space-y-2">
      {items.map((item) => (
        <div
          key={item.key}
          className={`rounded-2xl p-3 flex items-center gap-3 ${item.error ? 'bg-red-50' : 'bg-white shadow-sm'}`}
        >
          {item.error ? (
            <AlertCircle className="text-red-500 shrink-0" size={22} />
          ) : (
            <Loader2 className="text-orange-500 animate-spin shrink-0" size={22} />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" dir="ltr">{hostOf(item.url)}</div>
            <div className={`text-xs ${item.error ? 'text-red-700' : 'text-stone-500'}`}>
              {item.error || 'קוראים את הקישור ומסדרים מתכון… (בסרטון זה יכול לקחת דקה-שתיים)'}
            </div>
          </div>
          {item.error && (
            <>
              <button onClick={() => onRetry(item)} className="p-2 text-red-700" aria-label="נסו שוב" title="נסו שוב">
                <RotateCw size={18} />
              </button>
              <button onClick={() => onDismiss(item)} className="p-2 text-stone-500" aria-label="סגירה" title="סגירה">
                <X size={18} />
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
