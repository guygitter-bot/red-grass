import { Loader2, X } from 'lucide-react';

export const MEALS = ['בוקר', 'צהריים', 'ערב', 'ביניים'];

export const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-4 ${className}`}>{children}</div>
);

const VARIANTS = {
  primary: 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-600',
  secondary: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
  danger: 'bg-red-50 text-red-500 hover:bg-red-100',
  outline: 'border-2 border-slate-200 text-slate-600 hover:border-emerald-500 hover:text-emerald-500',
  ai: 'bg-violet-500 text-white shadow-lg shadow-violet-200 hover:bg-violet-600',
};

export const Button = ({ children, variant = 'primary', className = '', ...props }) => (
  <button
    className={`px-4 py-3 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none ${VARIANTS[variant]} ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const Input = ({ className = '', ...props }) => (
  <input
    className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${className}`}
    {...props}
  />
);

export const Label = ({ children }) => <label className="text-sm font-bold text-slate-700">{children}</label>;

export const Spinner = ({ text }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-8 text-violet-600">
    <Loader2 className="animate-spin" size={32} />
    {text && <span className="text-sm font-medium">{text}</span>}
  </div>
);

export const ErrorBox = ({ children }) =>
  children ? <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3">{children}</div> : null;

export function MealPicker({ value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {MEALS.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
            value === m ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-center p-5 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            {subtitle && <p className="text-xs text-emerald-600 font-medium">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200" aria-label="סגור">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5 pt-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="grid gap-1 bg-slate-100 p-1 rounded-xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 ${
            value === id ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'
          }`}
        >
          {Icon && <Icon size={16} />}
          {label}
        </button>
      ))}
    </div>
  );
}
