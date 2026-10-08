import { useState } from 'react';
import { getTheme, setTheme } from '../lib/theme';
import { TIMES } from '../lib/game';

// כפתור ראשי / משני
export function Button({ kind = 'primary', className = '', ...props }) {
  const look = {
    primary: 'bg-accent text-white shadow-sm hover:brightness-110',
    secondary: 'bg-card text-ink border border-line hover:bg-soft',
    ghost: 'text-muted hover:bg-soft',
  }[kind];
  return (
    <button
      type="button"
      className={`rounded-2xl px-4 py-3 font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${look} ${className}`}
      {...props}
    />
  );
}

export function Card({ className = '', ...props }) {
  return <div className={`rounded-3xl border border-line bg-card p-4 shadow-sm ${className}`} {...props} />;
}

// תמונת שחקן, ואם אין – העיגול עם האות הראשונה של השם
const COLORS = ['#16a34a', '#2563eb', '#db2777', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#65a30d'];
export function Avatar({ player, size = 40, ring = false }) {
  const style = { width: size, height: size, fontSize: size * 0.45 };
  const ringClass = ring ? 'ring-2 ring-accent ring-offset-2 ring-offset-card' : '';
  if (player?.photo) return <img src={player.photo} alt={player.name} style={style} className={`shrink-0 rounded-full object-cover ${ringClass}`} />;
  const n = [...(player?.id || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <div style={{ ...style, background: COLORS[n % COLORS.length] }} className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${ringClass}`}>
      {(player?.name || '?').trim()[0]}
    </div>
  );
}

// בחירת זמן לסיבוב
export function TimePicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {TIMES.map((t) => (
        <button
          key={t.seconds}
          type="button"
          onClick={() => onChange(t.seconds)}
          className={`rounded-full border px-3 py-1.5 text-sm transition ${value === t.seconds ? 'border-accent bg-accent text-white' : 'border-line bg-card text-ink hover:bg-soft'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// מצב לילה: אוטומטי ← לילה ← יום
export function ThemeButton() {
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
      className="grid h-10 w-10 place-items-center rounded-full text-lg hover:bg-soft"
    >
      {icon}
    </button>
  );
}
