// רכיבים קטנים שחוזרים בכל המסכים
import { X } from 'lucide-react';
import { STATUS_LABELS, STATUS_STYLE, money, savePercent } from '../lib/format';

export function TopBar({ title, sub, back, children }) {
  return (
    <header className="sticky top-0 z-20 bg-navy text-white" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
        {back ? (
          <a href={back} className="rounded-lg px-2 py-1 text-lg text-white/80 hover:bg-white/10" aria-label="חזרה">
            →
          </a>
        ) : (
          <a href="#/" aria-label="הרוכשים – מסך הבית">
            <img src="logo-wide.webp" alt="הרוכשים" className="h-9 w-auto" />
          </a>
        )}
        {title && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold">{title}</div>
            {sub && <div className="truncate text-xs text-white/60">{sub}</div>}
          </div>
        )}
        {!title && <div className="flex-1" />}
        {children}
      </div>
    </header>
  );
}

export function Pill({ status }) {
  return <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[status] || ''}`}>{STATUS_LABELS[status] || status}</span>;
}

export function Price({ offer, big }) {
  const pct = savePercent(offer);
  if (!offer.price && !offer.discount) return null;
  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 tabular-nums ${big ? 'text-lg' : ''}`}>
      {offer.price > 0 && <b className="font-extrabold">{money(offer.price)}</b>}
      {offer.regularPrice > offer.price && offer.price > 0 && <s className="text-sm text-muted">{money(offer.regularPrice)}</s>}
      {pct > 0 && <span className="text-sm font-bold text-coral-ink">חיסכון {pct}%</span>}
      {offer.discount && <span className="text-sm font-bold text-coral-ink">{offer.discount}</span>}
    </div>
  );
}

export function Sheet({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 lg:items-center" onClick={onClose}>
      <div
        className={`flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-card shadow-xl lg:rounded-2xl ${wide ? 'lg:max-w-3xl' : 'lg:max-w-lg'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-soft" aria-label="סגירה">
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass = 'w-full rounded-xl border border-line bg-page px-3 py-2.5 text-base outline-none focus:border-sky';

export function Button({ kind = 'main', className = '', ...props }) {
  const look = {
    main: 'bg-coral text-white hover:brightness-95',
    alt: 'bg-sky text-navy hover:brightness-95',
    ghost: 'border border-line bg-card text-ink hover:bg-soft',
    danger: 'border border-line bg-card text-coral-ink hover:bg-soft',
  }[kind];
  return <button className={`rounded-xl px-4 py-2.5 font-bold disabled:opacity-50 ${look} ${className}`} {...props} />;
}

export function Empty({ children }) {
  return <div className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">{children}</div>;
}

export function ErrorLine({ error }) {
  if (!error) return null;
  return <div className="rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral-ink">{error}</div>;
}

// שלושת הפסים מהלוגו – קישוט קטן לכותרות
export function Stripes() {
  return (
    <span className="inline-flex flex-col gap-[3px]" aria-hidden="true">
      <i className="block h-[4px] w-5 rounded bg-sky" />
      <i className="block h-[4px] w-5 rounded bg-coral" />
      <i className="block h-[4px] w-5 rounded bg-sun" />
    </span>
  );
}
