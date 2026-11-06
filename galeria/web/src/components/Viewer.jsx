import { useEffect } from 'react';
import Thumb from './Thumb.jsx';
import { bytes, date } from '../lib/format.js';
import { isNative, open } from '../lib/source.js';

// תמונה בגדול, עם מעבר לקודמת/הבאה וסימון למחיקה
export default function Viewer({ ids, index, photo, selected, onToggle, onMove, onClose }) {
  const id = ids[index];

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onMove(1);
      if (e.key === 'ArrowRight') onMove(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, onMove]);

  if (!id) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/95 text-white flex flex-col" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between p-3 gap-2">
        <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg bg-white/10">
          ✕ סגירה
        </button>
        <span className="text-sm opacity-80">
          {index + 1} / {ids.length}
        </span>
        {isNative ? (
          <button type="button" onClick={() => open(id)} className="px-3 py-2 rounded-lg bg-white/10 text-sm">
            פתיחה בגלריה
          </button>
        ) : (
          <span />
        )}
      </div>
      <div className="flex-1 min-h-0 flex items-center gap-2 px-2">
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="הקודמת" className="w-10 h-16 rounded-lg bg-white/10 disabled:opacity-20 shrink-0">
          ›
        </button>
        <Thumb key={id} id={id} size={1080} fit="contain" className="flex-1 h-full !bg-transparent" />
        <button type="button" onClick={() => onMove(1)} disabled={index === ids.length - 1} aria-label="הבאה" className="w-10 h-16 rounded-lg bg-white/10 disabled:opacity-20 shrink-0">
          ‹
        </button>
      </div>
      <div className="p-4 flex flex-col items-center gap-3">
        {photo && (
          <p className="text-sm opacity-80 text-center">
            {date(photo.date)} · {bytes(photo.size)} · {photo.bucket || 'ללא תיקייה'}
          </p>
        )}
        <button
          type="button"
          onClick={() => onToggle(id)}
          className={`w-full max-w-sm py-3 rounded-xl font-bold ${selected ? 'bg-bad text-white' : 'bg-white text-black'}`}
        >
          {selected ? '🗑 מסומנת למחיקה – להשאיר אותה' : 'לסמן למחיקה'}
        </button>
      </div>
    </div>
  );
}
