import { useState } from 'react';
import { useApp } from '../context';
import { soundOn, setSound, play } from '../lib/sound';
import { isDark, toggleTheme } from '../lib/theme';

// כותרת קבועה: חזרה, שם המסך, כוכבים, צליל ומצב לילה
export default function Layout({ title, back, children, wide = false }) {
  const { stars, toast } = useApp();
  const [snd, setSnd] = useState(soundOn());
  const [dark, setDark] = useState(isDark());

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-night text-white shadow-md">
        <div className="mx-auto max-w-5xl flex items-center gap-1.5 sm:gap-2 px-3 py-2" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
          {back ? (
            <a href={back} className="hbtn px-3 min-w-11 no-underline" aria-label="חזרה">
              <span aria-hidden="true">→</span><span className="hidden sm:inline">חזרה</span>
            </a>
          ) : (
            <span className="text-2xl px-1" aria-hidden="true">🕎</span>
          )}
          <h1 className="flex-1 m-0 text-base sm:text-lg lg:text-xl font-extrabold truncate">{title}</h1>
          <a href="#/badges" className="flex items-center gap-1 min-h-11 px-3 rounded-xl bg-white/10 text-gold font-extrabold no-underline" aria-label={`${stars} כוכבים, לתגים`}>
            <span aria-hidden="true">⭐</span>
            <span>{stars}</span>
          </a>
          <button
            className="hbtn w-11"
            aria-label={snd ? 'כיבוי צליל' : 'הפעלת צליל'}
            aria-pressed={snd}
            onClick={() => {
              const n = !snd;
              setSound(n);
              setSnd(n);
              if (n) play('tap');
            }}
          >
            {snd ? '🔊' : '🔇'}
          </button>
          <button
            className="hbtn w-11"
            aria-label={dark ? 'מעבר למצב יום' : 'מעבר למצב לילה'}
            onClick={() => setDark(toggleTheme())}
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>
      <main className={`flex-1 w-full mx-auto px-4 py-5 lg:py-8 ${wide ? 'max-w-6xl' : 'max-w-5xl'}`}>{children}</main>
      {toast && (
        <div role="status" className="pop fixed bottom-5 inset-x-4 z-30 mx-auto max-w-sm rounded-2xl bg-night text-gold text-center font-extrabold py-3 px-4 shadow-xl border-2 border-gold">
          {toast}
        </div>
      )}
    </div>
  );
}

// כותרת משנה בתוך מסך
export function Section({ children }) {
  return <h2 className="text-xl lg:text-2xl font-extrabold mt-0 mb-3">{children}</h2>;
}
