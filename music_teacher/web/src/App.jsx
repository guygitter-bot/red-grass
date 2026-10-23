import { useEffect, useRef, useState } from 'react';
import Home from './screens/Home';
import Lesson1 from './screens/Lesson1';
import Lesson2 from './screens/Lesson2';
import Tuner from './screens/Tuner';
import { getGuitarType, setGuitarType as saveGuitarType, getTeacher, setTeacher as saveTeacher } from './lib/storage';
import { TEACHERS, teacherById, teacherUrl } from './lib/teachers';
import { getTheme, setTheme, isDark } from './lib/theme';
import { GUITAR_NAMES } from './lib/parts';
import { IconBack, IconTheme, IconPerson } from './components/Icons';

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

// כפתור קטן בכותרת: בחירת המורה (גבר / אישה). "בקרוב" = עוד אין דמות
function TeacherMenu({ teacher, onPick }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const off = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', off);
    document.addEventListener('keydown', off);
    return () => {
      document.removeEventListener('pointerdown', off);
      document.removeEventListener('keydown', off);
    };
  }, [open]);
  return (
    <div className="relative" ref={boxRef}>
      <button type="button" className="btn !min-h-9 !w-9 !px-0" onClick={() => setOpen(!open)} aria-haspopup="true" aria-expanded={open} aria-label="המורה שלך" title="המורה שלך">
        <IconPerson />
      </button>
      {open && (
        <div role="radiogroup" aria-label="המורה שלך" className="absolute end-0 top-full z-30 mt-2 w-44 rounded-xl border border-line bg-card p-1.5 shadow-lg">
          <div className="px-2 py-1 text-xs font-bold text-muted">המורה שלך</div>
          {TEACHERS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={teacher === t.id}
              disabled={!!t.comingSoon}
              onClick={() => {
                onPick(t.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-lg border-0 px-2.5 py-2 text-start text-[14px] font-bold ${teacher === t.id ? 'bg-accent text-accent-ink' : 'bg-card text-ink'} disabled:opacity-60`}
            >
              <span className="flex-1">{t.label}</span>
              {t.comingSoon && <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-bold text-muted">בקרוב</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const [type, setType] = useState(getGuitarType);
  const [teacher, setTeacherState] = useState(getTeacher);
  const [theme, setThemeState] = useState(getTheme);

  const pickType = (t) => {
    saveGuitarType(t);
    setType(t);
  };
  const pickTeacher = (id) => {
    saveTeacher(id);
    setTeacherState(getTeacher());
  };
  const toggleTheme = () => {
    const next = isDark(theme) ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  };

  // מביאים מראש את קובץ המורה (ברקע, בעדיפות נמוכה) כדי שהשיעור הראשון יפתח עם הדמות מיד
  useEffect(() => {
    const warm = () => {
      try {
        fetch(teacherUrl(teacherById(teacher)), { priority: 'low' }).catch(() => {});
      } catch {
        /* לא קריטי */
      }
    };
    const id = window.requestIdleCallback ? window.requestIdleCallback(warm, { timeout: 3000 }) : setTimeout(warm, 1500);
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }, [teacher]);

  useEffect(() => {
    document.title = TITLES[route] ? `${TITLES[route]} · מורה לגיטרה`.replace('מורה לגיטרה · מורה לגיטרה', 'מורה לגיטרה') : 'מורה לגיטרה';
    window.scrollTo(0, 0);
  }, [route]);

  let screen;
  if (route === '/lesson/1') screen = <Lesson1 type={type} teacher={teacher} />;
  else if (route === '/lesson/2') screen = <Lesson2 type={type} teacher={teacher} />;
  else if (route === '/tuner') screen = <Tuner type={type} />;
  else screen = <Home type={type} onType={pickType} teacher={teacher} onTeacher={pickTeacher} />;
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
          <TeacherMenu teacher={teacher} onPick={pickTeacher} />
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
