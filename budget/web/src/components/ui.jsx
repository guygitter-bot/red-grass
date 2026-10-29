// רכיבים קטנים שחוזרים בכל המסכים
import { useEffect } from 'react';
import { X } from 'lucide-react';

// חלון שעולה מלמטה בטלפון, ובמרכז המסך במחשב
export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 lg:items-center" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl lg:max-w-lg lg:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-soft" aria-label="סגירה">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls = 'w-full rounded-xl border border-line bg-page px-3 py-2.5 text-base outline-none focus:border-accent';

export function Button({ kind = 'primary', className = '', ...props }) {
  const look = {
    primary: 'bg-accent text-white hover:opacity-90',
    ghost: 'border border-line bg-card hover:bg-soft',
    danger: 'border border-line bg-card text-minus hover:bg-soft',
  }[kind];
  return <button {...props} className={`rounded-xl px-4 py-2.5 font-medium disabled:opacity-50 ${look} ${className}`} />;
}

// בחירה אחת מכמה (כפתורים צמודים)
export function Segmented({ value, options, onChange }) {
  return (
    <div className="flex rounded-xl border border-line bg-page p-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`flex-1 rounded-lg px-2 py-2 text-sm font-medium ${value === v ? 'bg-card text-accent-ink shadow-sm' : 'text-muted'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
