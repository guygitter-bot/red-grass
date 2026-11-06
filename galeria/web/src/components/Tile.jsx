import Thumb from './Thumb.jsx';

// תמונה ברשת: הקשה מסמנת/מבטלת מחיקה, הזכוכית מגדלת פותחת בגדול
export default function Tile({ id, selected, best, onToggle, onView }) {
  return (
    <div className="relative aspect-square">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-pressed={selected}
        aria-label={selected ? 'מסומנת למחיקה' : 'לא מסומנת'}
        className={`block w-full h-full rounded-lg overflow-hidden border-2 ${selected ? 'border-bad' : best ? 'border-good' : 'border-transparent'}`}
      >
        <Thumb id={id} className="w-full h-full" />
        {selected && <span className="absolute inset-0 bg-bad/35" />}
      </button>
      <span
        className={`pointer-events-none absolute top-1 right-1 w-6 h-6 rounded-full grid place-items-center text-xs font-bold ${
          selected ? 'bg-bad text-white' : 'bg-card/90 text-muted border border-line'
        }`}
      >
        {selected ? '🗑' : ''}
      </span>
      {best && !selected && (
        <span className="pointer-events-none absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-good text-white text-[11px] font-bold">⭐ הכי טובה</span>
      )}
      <button
        type="button"
        onClick={() => onView(id)}
        aria-label="הגדלה"
        className="absolute top-1 left-1 w-7 h-7 rounded-full bg-card/85 border border-line text-sm grid place-items-center"
      >
        🔍
      </button>
    </div>
  );
}
