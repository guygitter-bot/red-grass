// רכיבים קטנים משותפים: כותרת עליונה, כפתור, שדה, כרטיס
import { Moon, Settings as Gear, Sun, Users } from 'lucide-react';
import { useState } from 'react';
import { getTheme, isDark, setTheme } from '../lib/theme';

export function Logo({ small = false }) {
  return (
    <span dir="ltr" className={`pixel text-orange ${small ? 'text-sm' : 'text-xs sm:text-lg lg:text-xl'}`}>
      Promptika<span className="text-turq">_</span>
    </span>
  );
}

export function Header({ route }) {
  const [dark, setDark] = useState(isDark(getTheme()));
  const toggle = () => {
    setTheme(dark ? 'light' : 'dark');
    setDark(!dark);
  };
  const tab = (href, label, Icon, active) => (
    <a
      href={href}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium ${active ? 'bg-night-2 text-orange' : 'text-white/85 hover:text-white'}`}
    >
      <Icon size={16} aria-hidden className="hidden sm:block" />
      {label}
    </a>
  );
  return (
    <header className="sticky top-0 z-10 bg-night text-white shadow-md print:hidden">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
        <a href="#/" aria-label="פרומפטיקה – לקוחות">
          <Logo />
        </a>
        <nav className="ms-auto flex items-center gap-0.5 sm:gap-1">
          {tab('#/', 'לקוחות', Users, route[0] !== 'settings')}
          {tab('#/settings', 'הגדרות', Gear, route[0] === 'settings')}
          <button onClick={toggle} className="rounded-lg p-2 text-white/85 hover:text-white" aria-label={dark ? 'מצב יום' : 'מצב לילה'}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </nav>
      </div>
    </header>
  );
}

export function Button({ kind = 'primary', className = '', ...props }) {
  const look = {
    primary: 'px-shadow bg-orange text-night hover:brightness-105',
    ghost: 'border border-line bg-card text-ink hover:border-turq',
    danger: 'border border-line bg-card text-danger hover:border-danger',
  }[kind];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-bold transition disabled:opacity-50 ${look} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-line bg-card px-3 py-2.5 text-ink placeholder:text-muted focus:border-turq focus:outline-none focus:ring-2 focus:ring-turq/30';

export function Card({ className = '', ...props }) {
  return <div className={`rounded-xl border border-line bg-card p-4 lg:p-5 ${className}`} {...props} />;
}

export function ErrorLine({ text }) {
  if (!text) return null;
  return <p role="alert" className="text-sm font-medium text-danger">{text}</p>;
}
