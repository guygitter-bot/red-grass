// רכיבים קטנים משותפים
import { useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { fmtPct, tone } from '../lib/format';

// מספר בתוך טקסט עברי – תמיד משמאל לימין
export const Num = ({ children, className = '' }) => (
  <bdi dir="ltr" className={className}>{children}</bdi>
);

export function Card({ className = '', children, ...rest }) {
  return <div className={`rounded-2xl border border-line bg-card p-4 ${className}`} {...rest}>{children}</div>;
}

export const SectionTitle = ({ children, right }) => (
  <div className="mb-2 mt-1 flex items-center justify-between gap-2">
    <h2 className="text-base font-bold">{children}</h2>
    {right}
  </div>
);

const BTN = {
  primary: 'bg-accent text-on-accent hover:opacity-90',
  soft: 'bg-soft text-accent-ink hover:opacity-80',
  ghost: 'border border-line bg-card text-ink hover:bg-soft',
  danger: 'bg-down-soft text-down hover:opacity-80',
};

export function Button({ variant = 'primary', className = '', busy, children, ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || busy}
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-medium transition disabled:opacity-50 ${BTN[variant]} ${className}`}
    >
      {busy && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export const Spinner = ({ label = 'טוען...' }) => (
  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
    <Loader2 size={18} className="animate-spin" /> {label}
  </div>
);

export const ErrorBox = ({ children, onRetry }) => (
  <div className="rounded-xl border border-down/40 bg-down-soft p-3 text-sm text-down">
    {children}
    {onRetry && (
      <button type="button" onClick={onRetry} className="ms-2 font-bold underline">נסו שוב</button>
    )}
  </div>
);

export const Empty = ({ children }) => <p className="py-6 text-center text-sm text-muted">{children}</p>;

// אחוז שינוי צבעוני
export const Change = ({ value, digits = 2, className = '' }) => (
  <Num className={`font-medium ${tone(value)} ${className}`}>{fmtPct(value, digits)}</Num>
);

// פסיקות לפי הציון
export const VERDICT = {
  strong_buy: { label: 'קנייה חזקה', cls: 'bg-up text-on-accent' },
  buy: { label: 'קנייה', cls: 'bg-up-soft text-up' },
  hold: { label: 'להחזיק / לחכות', cls: 'bg-soft text-muted' },
  sell: { label: 'מכירה', cls: 'bg-down-soft text-down' },
  strong_sell: { label: 'מכירה חזקה', cls: 'bg-down text-on-accent' },
};

export const verdictOfScore = (s) => (s >= 40 ? 'strong_buy' : s >= 15 ? 'buy' : s <= -40 ? 'strong_sell' : s <= -15 ? 'sell' : 'hold');

export function VerdictBadge({ verdict, label }) {
  const v = VERDICT[verdict] || VERDICT.hold;
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${v.cls}`}>{label || v.label}</span>;
}

export function ScoreBadge({ score }) {
  if (score == null) return null;
  const tn = score >= 15 ? 'bg-up-soft text-up' : score <= -15 ? 'bg-down-soft text-down' : 'bg-soft text-muted';
  return (
    <span className={`inline-block min-w-9 rounded-lg px-1.5 py-0.5 text-center text-xs font-bold ${tn}`}>
      <Num>{score > 0 ? `+${score}` : score}</Num>
    </span>
  );
}

// קו קטן של מחירים
export function Spark({ values, width = 80, height = 28 }) {
  const v = (values || []).filter((x) => Number.isFinite(x));
  if (v.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;
  const d = v.map((x, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * width).toFixed(1)} ${(2 + (1 - (x - min) / span) * (height - 4)).toFixed(1)}`).join('');
  const up = v[v.length - 1] >= v[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0" aria-hidden="true">
      <path d={d} fill="none" stroke={up ? 'var(--color-up)' : 'var(--color-down)'} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// חלון: מלמטה בטלפון, באמצע במחשב
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 lg:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={typeof title === 'string' ? title : undefined}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-card p-4 pb-6 shadow-xl lg:max-w-md lg:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} aria-label="סגירה" className="rounded-lg p-1.5 text-muted hover:bg-soft"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Field = ({ label, children, hint }) => (
  <label className="mb-3 block">
    <span className="mb-1 block text-sm font-medium">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
  </label>
);

export const inputCls = 'w-full min-h-10 rounded-xl border border-line bg-page px-3 text-base text-ink outline-none focus:border-accent';

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 py-2.5 text-start">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${checked ? 'start-[1.375rem]' : 'start-0.5'}`} />
      </span>
    </button>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-4 flex gap-1 rounded-xl bg-soft p-1">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`min-h-9 flex-1 rounded-lg px-2 text-sm font-medium transition ${value === id ? 'bg-card text-accent-ink shadow-sm' : 'text-muted'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export const LiveDot = () => (
  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-up">
    <span className="live-dot inline-block h-2 w-2 rounded-full bg-up" /> חי
  </span>
);
