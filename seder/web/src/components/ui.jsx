import { useEffect, useRef, useState } from 'react';
import { ArrowUp, GripVertical, X } from 'lucide-react';
import { useStore } from '../App';
import { addTask } from '../lib/store';
import { parseQuick } from '../lib/parse';
import { parseTime, timeDraft } from '../lib/dates';

// חלון שעולה מלמטה
export function Sheet({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center lg:items-center lg:p-6" dir="rtl">
      <div className="absolute inset-0 bg-stone-900/40 dark:bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col bg-card rounded-t-3xl shadow-2xl lg:max-w-2xl lg:max-h-[88vh] lg:rounded-3xl">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-bold">{title}</h2>
          <button aria-label="סגירה" onClick={onClose} className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500"><X size={22} /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-4 flex-1">{children}</div>
        {footer && <div className="border-t border-stone-100 px-5 pt-3 pb-safe lg:pb-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Section({ title, action, children }) {
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-stone-500">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }) {
  return <p className="text-sm text-stone-400 bg-card rounded-2xl border border-dashed border-stone-200 p-4 text-center">{children}</p>;
}

// שורת הוספה מהירה: "להתקשר לרופא מחר ב10 !" -> משימה עם תאריך, שעה וחשיבות
export function QuickAdd({ placeholder, defaults = {} }) {
  const { act } = useStore();
  const [text, setText] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const parsed = parseQuick(text);
    act(addTask, { ...defaults, ...parsed });
    setText('');
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-2 bg-card rounded-2xl border border-violet-200 shadow-sm pr-4 pl-1.5 py-1.5 focus-within:border-violet-500">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="done"
        className="flex-1 bg-transparent outline-none py-1.5 placeholder:text-stone-400"
      />
      <button aria-label="הוספה" disabled={!text.trim()} className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center disabled:opacity-30">
        <ArrowUp size={20} />
      </button>
    </form>
  );
}

// רשימה שמשנים את הסדר שלה במשיכה: בטלפון – מושכים בידית (שש הנקודות), במחשב – גוררים את כל השורה בעכבר.
// במקלדת: חץ למעלה / למטה על הידית. onMove(from, to) נקרא רק כשעוזבים את הפריט במקום חדש
export function Sortable({ items, getKey, getLabel, onMove, render }) {
  const rows = useRef([]);
  const drag = useRef(null);
  const [view, setView] = useState(null); // { from, to, dy, step }

  // החישוב: איפה מרכז הפריט שנגרר ביחס למרכזי השאר (בקואורדינטות של הדף, כדי שגלילה לא תבלבל)
  const update = () => {
    const d = drag.current;
    if (!d) return;
    const y = d.clientY + window.scrollY;
    const first = d.mids[0];
    const last = d.mids[d.mids.length - 1];
    const center = Math.min(last, Math.max(first, d.mids[d.from] + y - d.startY));
    const to = d.mids.filter((m, j) => j !== d.from && m < center).length;
    d.to = to;
    setView({ from: d.from, to, dy: center - d.mids[d.from], step: d.step });
  };

  // גלילה אוטומטית כשהאצבע קרובה לקצה המסך
  const tick = () => {
    const d = drag.current;
    if (!d) return;
    const edge = d.clientY < 80 ? -1 : d.clientY > window.innerHeight - 110 ? 1 : 0;
    if (edge) {
      window.scrollBy(0, edge * 10);
      update();
    }
    d.raf = requestAnimationFrame(tick);
  };

  useEffect(() => () => drag.current && cancelAnimationFrame(drag.current.raf), []);

  const start = (e, i) => {
    if (e.button > 0 || items.length < 2) return;
    if (e.pointerType !== 'mouse' && !e.target.closest('[data-grip]')) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rects = items.map((_, j) => rows.current[j].getBoundingClientRect());
    const gap = rects[1].top - rects[0].bottom;
    drag.current = {
      from: i,
      clientY: e.clientY,
      startY: e.clientY + window.scrollY,
      mids: rects.map((r) => r.top + window.scrollY + r.height / 2),
      step: rects[i].height + gap,
    };
    drag.current.raf = requestAnimationFrame(tick);
    update();
  };
  const move = (e) => {
    if (!drag.current) return;
    drag.current.clientY = e.clientY;
    update();
  };
  const end = (drop) => {
    const d = drag.current;
    if (!d) return;
    cancelAnimationFrame(d.raf);
    drag.current = null;
    if (drop && d.to !== undefined && d.to !== d.from) onMove(d.from, d.to);
    setView(null);
  };
  const key = (e, i) => {
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : null;
    if (to === null || to < 0 || to >= items.length) return;
    e.preventDefault();
    onMove(i, to);
  };

  const shift = (i) => {
    if (!view) return 0;
    if (i === view.from) return view.dy;
    if (view.from < i && i <= view.to) return -view.step;
    if (view.to <= i && i < view.from) return view.step;
    return 0;
  };

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const lifted = view?.from === i;
        const grip = (
          <button
            type="button"
            data-grip
            aria-label={`להזיז את ${getLabel(item)} (משיכה, או חצים במקלדת)`}
            onKeyDown={(e) => key(e, i)}
            className="shrink-0 w-10 h-10 -my-1 rounded-xl flex items-center justify-center text-stone-400 touch-none cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={22} />
          </button>
        );
        return (
          <div
            key={getKey(item)}
            ref={(el) => { rows.current[i] = el; }}
            onPointerDown={(e) => start(e, i)}
            onPointerMove={move}
            onPointerUp={() => end(true)}
            onPointerCancel={() => end(false)}
            style={{ transform: `translateY(${shift(i)}px)` }}
            className={`relative select-none lg:cursor-grab ${view ? (lifted ? 'z-10' : 'transition-transform duration-150') : ''}`}
          >
            <div className={lifted ? 'rounded-2xl shadow-lg ring-2 ring-violet-400 scale-[1.02]' : ''}>{render(item, grip)}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Chip({ active, onClick, children, className = '' }) {
  return (
    <button type="button" onClick={onClick} className={`shrink-0 rounded-full px-3 py-1.5 text-sm border transition ${active ? 'bg-violet-600 text-white border-violet-600' : 'bg-card text-stone-600 border-stone-200'} ${className}`}>
      {children}
    </button>
  );
}

// שדה שעה דיגיטלי: מקלידים ספרות (מקלדת מספרים בטלפון) במקום השעון העגול. value/onChange ב-"HH:MM" ('' = בלי שעה)
export function TimeInput({ value, onChange, className = '', ...props }) {
  const [draft, setDraft] = useState(value || '');
  const [editing, setEditing] = useState(false);
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      dir="ltr"
      placeholder="--:--"
      maxLength={5}
      value={editing ? draft : value || ''}
      onFocus={(e) => { setDraft(value || ''); setEditing(true); e.target.select(); }}
      onChange={(e) => {
        const next = timeDraft(e.target.value);
        setDraft(next);
        const t = parseTime(next);
        if (t !== null && t !== (value || '')) onChange(t);
      }}
      onBlur={() => setEditing(false)}
      className={`text-center tabular-nums ${className}`}
      {...props}
    />
  );
}
