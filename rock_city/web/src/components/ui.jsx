import { useEffect, useState } from 'react';
import { getTheme, setTheme } from '../lib/theme';
import { fullName, whatsapp } from '../lib/schedule';

// כפתור: primary = צהוב עם טקסט שחור (כמו הלוגו), dark = שחור עם טקסט צהוב
export function Button({ kind = 'primary', className = '', ...props }) {
  const look = {
    primary: 'bg-accent text-black shadow-sm hover:brightness-105',
    dark: 'bg-bar text-accent hover:brightness-125 dark:bg-accent dark:text-black',
    secondary: 'bg-card text-ink border border-line hover:bg-soft',
    ghost: 'text-muted hover:bg-soft',
    danger: 'bg-card text-danger border border-line hover:bg-soft',
  }[kind];
  return (
    <button
      type="button"
      className={`rounded-xl px-4 py-2.5 font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${look} ${className}`}
      {...props}
    />
  );
}

export function Card({ className = '', ...props }) {
  return <div className={`rounded-2xl border border-line bg-card p-4 shadow-sm ${className}`} {...props} />;
}

export function Logo({ className = 'h-9' }) {
  return <img src="logo.png" alt="Rock City" className={`w-auto select-none ${className}`} draggable="false" />;
}

// חלון מעל המסך: בטלפון נפתח מלמטה, במחשב באמצע
export function Sheet({ title, onClose, onBack, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 lg:items-center lg:p-6" onClick={onClose}>
      <div
        className={`sheet-in flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-page shadow-2xl lg:rounded-3xl ${wide ? 'lg:max-w-3xl' : 'lg:max-w-xl'}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center gap-2 border-b border-line bg-card px-3 py-2">
          {onBack && (
            <button type="button" onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full text-xl hover:bg-soft" aria-label="חזרה">
              →
            </button>
          )}
          <h2 className="min-w-0 flex-1 truncate px-1 text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full text-xl text-muted hover:bg-soft" aria-label="סגירה">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputClass = 'w-full rounded-xl border border-line bg-card px-3 py-2.5 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30';

export function Input({ className = '', ...props }) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}

// שדה סיסמה עם עין: לחיצה מראה / מסתירה את מה שהוקלד
export function PasswordInput({ className = '', ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} className={`pe-12 ${className}`} {...props} />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute inset-y-0 end-0 grid w-12 place-items-center text-muted hover:text-ink"
        aria-label={show ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
        title={show ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {show && <line x1="3" y1="3" x2="21" y2="21" />}
        </svg>
      </button>
    </div>
  );
}

export function Textarea({ className = '', ...props }) {
  return <textarea rows={3} className={`${inputClass} ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${inputClass} ${className}`} {...props}>
      {children}
    </select>
  );
}

// בחירה מתוך כמה אפשרויות (צ'יפים)
export function Chips({ options, value, onChange, multi = false }) {
  const on = (o) => (multi ? value.includes(o.value) : value === o.value);
  const toggle = (o) => {
    if (!multi) onChange(o.value);
    else onChange(on(o) ? value.filter((x) => x !== o.value) : [...value, o.value]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => toggle(o)}
          className={`rounded-full border px-3 py-1.5 text-sm transition ${on(o) ? 'border-accent bg-accent font-medium text-black' : 'border-line bg-card text-ink hover:bg-soft'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// תמונת מורה, ואם אין – עיגול בצבע שלו עם האות הראשונה
export function Avatar({ person, size = 40 }) {
  const style = { width: size, height: size, fontSize: size * 0.42 };
  if (person?.photo) return <img src={person.photo} alt={fullName(person)} style={style} className="shrink-0 rounded-full object-cover" />;
  return (
    <div style={{ ...style, background: person?.color || '#f5b800' }} className="grid shrink-0 place-items-center rounded-full font-bold text-black/80">
      {(person?.first || '?').trim()[0]}
    </div>
  );
}

// שורה שאפשר ללחוץ עליה (שם מורה / תלמיד בתוך פרטי שיעור וכו')
export function LinkRow({ onClick, children, className = '' }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start transition hover:bg-soft ${className}`}>
      {children}
      <span className="ms-auto text-muted">‹</span>
    </button>
  );
}

// כפתורי חיוג ווטסאפ
export function ContactButtons({ phone, message }) {
  if (!phone) return null;
  const wa = whatsapp(phone, message);
  return (
    <span className="flex shrink-0 gap-1">
      <a href={`tel:${phone}`} className="grid h-9 w-9 place-items-center rounded-full bg-soft text-base" aria-label="חיוג" title="חיוג" onClick={(e) => e.stopPropagation()}>
        📞
      </a>
      <a href={wa} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full bg-soft text-base" aria-label="וואטסאפ" title="וואטסאפ" onClick={(e) => e.stopPropagation()}>
        💬
      </a>
    </span>
  );
}

export function Empty({ children }) {
  return <p className="py-8 text-center text-muted">{children}</p>;
}

// מצב לילה: אוטומטי ← לילה ← יום
export function ThemeButton({ className = '' }) {
  const [theme, set] = useState(getTheme);
  const next = { auto: 'dark', dark: 'light', light: 'auto' }[theme];
  const icon = { auto: '🌗', dark: '🌙', light: '☀️' }[theme];
  const label = { auto: 'לפי המכשיר', dark: 'מצב לילה', light: 'מצב יום' }[theme];
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => {
        setTheme(next);
        set(next);
      }}
      className={`grid h-10 w-10 place-items-center rounded-full text-lg hover:bg-white/10 ${className}`}
    >
      {icon}
    </button>
  );
}
