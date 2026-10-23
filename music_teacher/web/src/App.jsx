import { useEffect, useState } from 'react';
import Home from './screens/Home';
import Lesson1 from './screens/Lesson1';
import Lesson2 from './screens/Lesson2';
import Tuner from './screens/Tuner';
import { getGuitarType, setGuitarType as saveGuitarType } from './lib/storage';
import { getTheme, setTheme, isDark } from './lib/theme';
import { GUITAR_NAMES } from './lib/parts';
import { IconBack, IconTheme } from './components/Icons';

function useRoute() {
  const read = () => (window.location.hash || '#/').replace(/^#/, '') || '/';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => {
      window.removeEventListener('hashchange', on);
    };
  }, []);
  return route;
}

const TITLES = { '/': 'מורה לגיטרה', '/lesson/1': 'שיעור 1 · הכירו את הגיטרה', '/lesson/2': 'שיעור 2 · אקורד Am', '/tuner': 'מכוון' };

export default function App() {
  const route = useRoute();
  const [type, setType] = useState(getGuitarType);
  const [theme, setThemeState] = useState(getTheme);

  const pickType = (t) => {
    saveGuitarType(t);
    setType(t);
  };
  const toggleTheme = () => {
    const next = isDark(theme) ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  };

  useEffect(() => {
    document.title = TITLES[route] ? `${TITLES[route]} · מורה לגיטרה`.replace('מורה לגיטרה · מורה לגיטרה', 'מורה לגיטרה') : 'מורה לגיטרה';
    window.scrollTo(0, 0);
  }, [route]);

  let screen;
  if (route === '/lesson/1') screen = <Lesson1 type={type} />;
  else if (route === '/lesson/2') screen = <Lesson2 type={type} />;
  else if (route === '/tuner') screen = <Tuner type={type} />;
  else screen = <Home type={type} onType={pickType} />;
  const home = route === '/' || !TITLES[route];

  return (
    <div className="flex h-dvh flex-col bg-page text-ink">
      <header className="flex flex-none items-center gap-2 px-4 py-2">
        {home ? (
          <span className="font-display text-lg font-extrabold text-accent">🎸 מורה לגיטרה</span>
        ) : (
          <a href="#/" className="btn !min-h-9 !px-3 text-sm no-underline" aria-label="חזרה לדף הבית">
            <IconBack width={15} height={15} />
            <span>בית</span>
          </a>
        )}
        <span className="min-w-0 flex-1 truncate text-center text-sm font-bold text-muted">{home ? '' : TITLES[route]}</span>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="סוג הגיטרה" className="flex overflow-hidden rounded-xl border border-line text-[13px] font-bold">
            {['classical', 'electric'].map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => pickType(t)}
                className={`min-h-9 border-0 px-2.5 ${type === t ? 'bg-accent text-accent-ink' : 'bg-card text-ink'}`}
              >
                {t === 'classical' ? 'קלאסית' : 'חשמלית'}
              </button>
            ))}
          </div>
          <button type="button" className="btn !min-h-9 !w-9 !px-0" onClick={toggleTheme} aria-label="מצב לילה / יום" title={`מצב ${isDark(theme) ? 'לילה' : 'יום'}`}>
            <IconTheme />
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden" aria-label={GUITAR_NAMES[type]}>
        {screen}
      </main>
    </div>
  );
}
