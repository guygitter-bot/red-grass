import { getTheme, setTheme } from '../lib/theme';
import { useState } from 'react';
import Icon from './Icon';

const ITEMS = [
  { id: 'play', icon: 'drum', label: 'נגינה' },
  { id: 'kits', icon: 'sparkle', label: 'סטים' },
  { id: 'builder', icon: 'sliders', label: 'בונה' },
  { id: 'song', icon: 'note', label: 'שיר' },
];
const THEME_ICON = { auto: 'auto', light: 'sun', dark: 'moon' };
const NEXT = { auto: 'light', light: 'dark', dark: 'auto' };

// תפריט תחתון בטלפון לאורך, ופס צדדי במחשב ובטלפון לרוחב. הווילון הכהה (curtain) בשני המצבים
export default function Nav({ screen, onGo }) {
  const [theme, setT] = useState(getTheme());
  return (
    <nav
      className="shrink-0 flex flex-row lg:flex-col short:flex-col lg:w-24 short:w-[68px] bg-curtain border-t lg:border-t-0 lg:border-s short:border-t-0 short:border-s border-line pb-[env(safe-area-inset-bottom)] lg:pb-0 short:pb-0"
      aria-label="ניווט"
    >
      {ITEMS.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onGo(it.id)}
          aria-current={screen === it.id ? 'page' : undefined}
          className="nav-item flex-1 lg:flex-none short:flex-none flex flex-col items-center justify-center gap-1 py-2 lg:py-4 short:py-1.5 min-h-14 short:min-h-0 text-[11px] lg:text-xs short:text-[10px] font-bold"
        >
          <span className="nav-cap">
            <Icon name={it.icon} size={22} />
          </span>
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
        className="nav-item flex flex-col items-center justify-center w-14 lg:w-auto short:w-auto lg:flex-none short:flex-none lg:min-h-14 short:min-h-10 lg:mt-auto short:mt-auto lg:mb-2 short:mb-1"
      >
        <span className="nav-cap">
          <Icon name={THEME_ICON[theme]} size={20} />
        </span>
      </button>
    </nav>
  );
}
