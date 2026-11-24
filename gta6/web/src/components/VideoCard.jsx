import { AlertCircle, KeyRound, Loader2, PlayCircle } from 'lucide-react';
import { codesOf, codesText, isWaiting, isWatching, needsUpload, sourceOf } from '../lib/videos';

// כרטיס של סרטון ברשימה: מאיפה, כותרת (מה יש בסרטון), כמה קודים
export default function VideoCard({ item, emoji, onOpen }) {
  const waiting = isWaiting(item);
  const codes = codesOf(item);
  return (
    <button onClick={() => onOpen(item.id)} className="w-full text-start bg-card border border-line rounded-2xl p-4 shadow-sm hover:border-accent/60 transition flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-muted min-w-0">
        <PlayCircle size={14} className="shrink-0" />
        <span className="truncate" dir="auto">{sourceOf(item.url)}</span>
        {codes.length > 0 && (
          <span className="ms-auto shrink-0 flex items-center gap-1 rounded-full bg-soft text-accent-ink px-2 py-0.5 font-medium">
            <KeyRound size={12} /> {codesText(codes.length)}
          </span>
        )}
      </div>
      <h3 className="font-bold leading-snug line-clamp-2" dir="auto">{item.title}</h3>
      {waiting && (
        <p className="flex items-center gap-1.5 text-sm text-accent-ink">
          <Loader2 size={15} className="animate-spin" /> קורא את הסרטון...
        </p>
      )}
      {!waiting && isWatching(item) && (
        <p className="flex items-center gap-1.5 text-sm text-accent-ink">
          <Loader2 size={15} className="animate-spin" /> צופה בסרטון...
        </p>
      )}
      {!waiting && needsUpload(item) && <p className="text-sm text-amber-700 dark:text-amber-400">אפשר להעלות את הסרטון כדי שאצפה בו</p>}
      {item.status === 'failed' && (
        <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
          <AlertCircle size={15} /> {item.error || 'הקריאה נכשלה'}
        </p>
      )}
      {codes.length > 0 && (
        <ul className="space-y-1">
          {codes.slice(0, 2).map((c) => (
            <li key={c.code} className="text-xs flex gap-2 min-w-0">
              <code className="font-mono bg-page border border-line rounded px-1.5 py-0.5 truncate" dir="ltr">{c.code}</code>
              <span className="text-muted truncate">{c.effect}</span>
            </li>
          ))}
        </ul>
      )}
      {item.category && (
        <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
          <span className="text-xs rounded-full border border-line px-2 py-0.5">{emoji} {item.category}</span>
        </div>
      )}
    </button>
  );
}
