import { getTheme, setTheme } from '../lib/theme';
import { useState } from 'react';

const ITEMS = [
  { id: 'play', icon: '🥁', label: 'נגינה' },
  { id: 'kits', icon: '⭐', label: 'סטים' },
  { id: 'builder', icon: '🛠️', label: 'בונה' },
  { id: 'song', icon: '🎵', label: 'שיר' },
];
const THEME_ICON = { auto: '🌓', light: '☀️', dark: '🌙' };
const NEXT = { auto: 'light', light: 'dark', dark: 'auto' };

// תפריט תחתון בטלפון לאורך, ופס צדדי במחשב ובטלפון לרוחב
export default function Nav({ screen, onGo }) {
  const [theme, setT] = useState(getTheme());
  return (
    <nav
      className="shrink-0 flex flex-row lg:flex-col short:flex-col lg:w-24 short:w-[68px] bg-card border-t lg:border-t-0 lg:border-s short:border-t-0 short:border-s border-line pb-[env(safe-area-inset-bottom)] lg:pb-0 short:pb-0"
      aria-label="ניווט"
    >
      {ITEMS.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onGo(it.id)}
          aria-current={screen === it.id ? 'page' : undefined}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-14 text-[11px] lg:text-xs short:text-[10px] font-bold ${
            screen === it.id ? 'text-accent bg-soft' : 'text-muted'
          }`}
        >
          <span className="text-xl lg:text-2xl short:text-lg leading-none">{it.icon}</span>
          {it.label}
        </button>
      ))}
      <button
        type="button"
        aria-label="מצב תצוגה: אוטומטי, יום או לילה"
        onClick={() => {
          const n = NEXT[theme];
          setTheme(n);
          setT(n);
        }}
        className="flex flex-col items-center justify-center w-14 lg:w-auto short:w-auto lg:flex-none short:flex-none lg:min-h-14 short:min-h-10 text-muted"
      >
        <span className="text-xl short:text-base">{THEME_ICON[theme]}</span>
      </button>
    </nav>
  );
}
