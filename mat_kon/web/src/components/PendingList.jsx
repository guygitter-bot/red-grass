import { AlertCircle, Loader2, PenLine, RotateCw, X } from 'lucide-react';
import { hostOf, isVideoLink } from '../lib/recipes';
import PasteBox from './PasteBox';

export default function PendingList({ items, onRetry, onDismiss, onPaste }) {
  if (!items.length) return null;
  return (
    <div className="mt-4 space-y-2">
      {items.map((item) => (
        <div
          key={item.key}
          className={`rounded-2xl p-3 flex items-start gap-3 ${item.error ? 'bg-red-50' : 'bg-white shadow-sm'}`}
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
            {item.error && isVideoLink(item.url) && (
              // סייג: לא בכל סרטון יש מתכון – לפעמים רק צילום של ההכנה, בלי מצרכים וכמויות
              <p className="mt-1.5 text-xs text-stone-600 leading-relaxed">
                לא מכל סרטון אפשר לבנות מתכון: לפעמים יש בו רק צילום של ההכנה, בלי מצרכים וכמויות כתובים. אפשר להדביק
                את הטקסט או התגובה עם המתכון, לכתוב בשורת ההוספה את שם המנה ולחפש מתכון דומה, או לכתוב את המתכון בעצמכם.
              </p>
            )}
            {item.error && <PasteBox url={item.url} onSubmit={(text) => onPaste(item, text)} />}
            {item.error && isVideoLink(item.url) && (
              <a href="#/new?manual" className="mt-2 ms-2 inline-flex items-center gap-1.5 rounded-full bg-stone-100 text-stone-700 px-3 py-1.5 text-sm font-medium">
                <PenLine size={15} /> כתיבת מתכון ידנית
              </a>
            )}
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
