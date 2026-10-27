// רכיבים קטנים שחוזרים בכל המסכים: כותרת, תחתית, כרטיס חולצה, שדה
import { useState } from 'react';
import { Camera, Heart, MessageCircle, Moon, Sun } from 'lucide-react';
import { imageUrl } from '../lib/api';
import { displayName, subtitle } from '../lib/shirt';
import { getTheme, isDark, setTheme } from '../lib/theme';
import Logo from './Logo';

export function ThemeButton({ className = '' }) {
  const [dark, setDark] = useState(() => isDark(getTheme()));
  return (
    <button
      onClick={() => {
        setTheme(dark ? 'light' : 'dark');
        setDark(!dark);
      }}
      className={`rounded-full p-2 hover:bg-white/10 ${className}`}
      aria-label={dark ? 'מצב יום' : 'מצב לילה'}
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}

export function Header({ favCount, categories }) {
  return (
    <header className="sticky top-0 z-30 bg-ink text-white" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-1.5">
        <a href="#/" aria-label="Isport – דף הבית">
          <Logo className="h-14 lg:h-16" />
        </a>
        <div className="flex-1" />
        <nav className="hidden items-center gap-1 text-sm font-medium lg:flex">
          {categories.map((c) => (
            <a key={c.id} href={`#/c/${c.id}`} className="whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-white/10">
              {c.name}
            </a>
          ))}
        </nav>
        <a href="#/favorites" className="relative rounded-full p-2 hover:bg-white/10" aria-label="המועדפים שלי">
          <Heart size={20} />
          {favCount > 0 && (
            <span className="absolute -left-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-lime px-1 text-[10px] font-bold text-ink">
              {favCount}
            </span>
          )}
        </a>
        <ThemeButton />
      </div>
    </header>
  );
}

// מספר מקומי שנשמר פעם (050…) -> 972… כדי שהקישור יעבוד
export const waNumber = (number) => {
  const d = String(number || '').replace(/\D/g, '');
  if (d.startsWith('00')) return d.slice(2);
  return d.startsWith('0') ? `972${d.slice(1)}` : d;
};
export const whatsappLink = (number, text = '') => `https://wa.me/${waNumber(number)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export function Footer({ settings }) {
  return (
    <footer className="mt-16 bg-ink text-white/80" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-sm">
          <Logo className="h-28" />
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            חולצות, גופיות, נעליים ותיקים. בוחרים מוצר, מוסיפים שם ומספר, ומשלימים את ההזמנה אצל המוכר.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {settings.whatsapp && (
            <a href={whatsappLink(settings.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10">
              <MessageCircle size={16} /> וואטסאפ
            </a>
          )}
          {settings.instagram && (
            <a href={`https://instagram.com/${settings.instagram}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10">
              <Camera size={16} /> אינסטגרם
            </a>
          )}
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/40">© {new Date().getFullYear()} Isport</div>
    </footer>
  );
}

export function ShirtImage({ shirt, index = 0, className = '' }) {
  const key = shirt.images?.[index];
  if (!key) {
    return (
      <div className={`grid place-items-center bg-soft text-muted ${className}`}>
        <svg viewBox="0 0 64 64" className="h-1/2 w-1/2 opacity-30" aria-hidden="true">
          <path d="M24 10 L13 14.5 L6 26 L13.5 31 L17 27 L17 54 L47 54 L47 27 L50.5 31 L58 26 L51 14.5 L40 10 C38.5 13.5 35.5 15.5 32 15.5 C28.5 15.5 25.5 13.5 24 10 Z" fill="currentColor" />
        </svg>
      </div>
    );
  }
  return <img src={imageUrl(key)} alt={`${shirt.team} ${shirt.type} ${shirt.year}`} loading="lazy" className={`bg-white object-contain ${className}`} />;
}

export function ShirtCard({ shirt, fav, onFav }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-line transition hover:shadow-md">
      <a href={`#/shirt/${shirt.id}`} className="block">
        <div className="relative">
          <ShirtImage shirt={shirt} className="aspect-square w-full transition duration-300 group-hover:scale-[1.03]" />
          {shirt.images?.[1] && (
            <ShirtImage shirt={shirt} index={1} className="absolute inset-0 aspect-square w-full opacity-0 transition duration-300 lg:group-hover:opacity-100" />
          )}
          <div className="absolute right-2 top-2 flex flex-col items-start gap-1">
            {shirt.isNew && <span className="rounded-full bg-lime px-2 py-0.5 text-[11px] font-bold text-ink">חדש</span>}
            {shirt.longSleeve && shirt.template === 'football' && <span className="rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-bold text-white">גם שרוול ארוך</span>}
          </div>
        </div>
        <div className="p-3">
          <div className="truncate font-extrabold">{displayName(shirt)}</div>
          <div className="truncate text-sm text-muted">{subtitle(shirt)}</div>
          <div dir="ltr" className="mt-1 truncate text-right font-mono text-[11px] text-muted">{shirt.code}</div>
        </div>
      </a>
      {onFav && (
        <button
          onClick={onFav}
          className="absolute left-2 top-2 rounded-full bg-card/90 p-1.5 shadow-sm"
          aria-label={fav ? 'הסרה מהמועדפים' : 'הוספה למועדפים'}
        >
          <Heart size={18} className={fav ? 'fill-red-500 text-red-500' : 'text-muted'} />
        </button>
      )}
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

export const inputClass = 'w-full rounded-xl border border-line bg-page px-3 py-2.5 text-base outline-none focus:border-lime-ink';

export function Chip({ active, onClick, children, small }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap rounded-full border font-medium transition ${small ? 'px-3 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'} ${
        active ? 'border-ink bg-ink text-white dark:border-lime dark:bg-lime dark:text-ink' : 'border-line bg-card hover:border-muted'
      }`}
    >
      {children}
    </button>
  );
}

// סרטון הדרכה (נוצר אוטומטית ב-isport/tutorials, נמצא ב-public/tutorials)
// wide = סרטון שהוקלט במסך מחשב (לרוחב)
export function TutorialVideo({ name, className = '', wide = false }) {
  return (
    <video
      src={`tutorials/${name}.mp4`}
      poster={`tutorials/${name}.jpg`}
      controls
      playsInline
      preload="none"
      className={`w-full rounded-2xl bg-ink object-cover shadow-lg ${wide ? 'aspect-[3/2] max-w-2xl' : 'aspect-[390/844] max-w-xs'} ${className}`}
    />
  );
}
