// הרוכשים – הניווט הראשי:
//   #/            הבית (קטגוריות, חיפוש, הטבות חמות)
//   #/c/<id>      קטגוריה: הספקים וההצעות שלהם
//   #/s/<id>      ספק: ההצעות, העוזר החכם, "שיחזרו אליי"
//   #/my          הפניות שלי
//   #/partner     אזור הספק (#/partner/<סוד> = הקישור האישי)
//   #/admin       אפליקציית המאסטר
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { api, load, store } from './lib/api';
import { useRoute } from './lib/route';
import { getTheme, isDark, setTheme } from './lib/theme';
import { CategoryPage, Home, MyRequests, NotFound, SupplierPage } from './components/Customer';
import Admin from './components/Admin';
import Partner from './components/Partner';

function useCatalog() {
  // הקטלוג האחרון נשמר בטלפון, כדי שהאפליקציה תיפתח מיד גם ברשת איטית
  const [catalog, setCatalog] = useState(() => load('hr_catalog', null));
  const [error, setError] = useState('');
  useEffect(() => {
    api('/catalog')
      .then((c) => {
        setCatalog(c);
        store('hr_catalog', c);
      })
      .catch((e) => setError(e.message));
  }, []);
  return { catalog, error };
}

function ThemeButton() {
  const [dark, setDark] = useState(() => isDark(getTheme()));
  return (
    <button
      onClick={() => {
        setTheme(dark ? 'light' : 'dark');
        setDark(!dark);
      }}
      className="fixed bottom-4 left-4 z-30 rounded-full border border-line bg-card p-2.5 text-muted shadow"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label={dark ? 'מצב יום' : 'מצב לילה'}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function CustomerApp({ parts }) {
  const { catalog, error } = useCatalog();
  if (!catalog) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-navy p-6 text-center text-white">
        <img src="logo-wide.webp" alt="הרוכשים" className="w-64 max-w-full" />
        <div className="text-white/70">{error || 'טוען את ההטבות…'}</div>
      </div>
    );
  }
  const [page, id] = parts;
  if (!page) return <Home catalog={catalog} />;
  if (page === 'c') return <CategoryPage catalog={catalog} id={id} />;
  if (page === 's') return <SupplierPage catalog={catalog} id={id} />;
  if (page === 'my') return <MyRequests />;
  return <NotFound />;
}

export default function App() {
  const parts = useRoute();
  let screen;
  if (parts[0] === 'admin') screen = <Admin />;
  else if (parts[0] === 'partner') screen = <Partner secret={parts[1] || ''} />;
  else screen = <CustomerApp parts={parts} />;
  return (
    <div className="min-h-dvh bg-page pb-16">
      {screen}
      <ThemeButton />
    </div>
  );
}
