// Isport – החנות. הניווט לפי הכתובת אחרי #:
//   #/              דף הבית: חיפוש וכל החולצות
//   #/c/<id>        קטגוריה (חולצות כדורגל, גופיות כדורסל, נעליים…)
//   #/shirt/<id>    דף מוצר: התאמה אישית והערה למוכר
//   #/club, #/national  (קישורים ישנים) חולצות כדורגל של קבוצות / נבחרות
//   #/favorites     החולצות שסימנתי
//   #/admin         ניהול (בסיסמה; נטען רק כשנכנסים אליו)
import { Suspense, lazy, useEffect, useState } from 'react';
import { api, load, store } from './lib/api';
import { useRoute } from './lib/route';
import { DEFAULT_CATEGORIES, withCategories } from './lib/shirt';
import Home from './components/Home';
import Product from './components/Product';
import { Footer, Header } from './components/ui';

const Admin = lazy(() => import('./components/Admin'));

const CACHE = 'isport_catalog';
const FAVS = 'isport_favorites';

export default function App() {
  const route = useRoute();
  const [catalog, setCatalog] = useState(() => load(CACHE, null));
  const [error, setError] = useState('');
  const [favs, setFavs] = useState(() => load(FAVS, []));

  useEffect(() => {
    api('/catalog')
      .then((data) => {
        setCatalog(data);
        store(CACHE, data);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, []);

  const toggleFav = (id) => {
    setFavs((list) => {
      const next = list.includes(id) ? list.filter((x) => x !== id) : [id, ...list];
      store(FAVS, next);
      return next;
    });
  };

  if (route[0] === 'admin') {
    return (
      <Suspense fallback={<div className="p-10 text-center text-muted">טוען…</div>}>
        <Admin route={route.slice(1)} />
      </Suspense>
    );
  }

  // קטלוג ישן במטמון (מלפני הקטגוריות) – ברירת המחדל
  const categories = catalog?.categories || DEFAULT_CATEGORIES;
  const shirts = withCategories(catalog?.shirts || [], categories);
  const settings = catalog?.settings || {};
  const legacyKind = ['club', 'national'].includes(route[0]) ? route[0] : 'all';
  let page;
  if (route[0] === 'shirt') {
    const shirt = shirts.find((s) => s.id === route[1]);
    page = shirt ? (
      <Product key={shirt.id} shirt={shirt} shirts={shirts} settings={settings} fav={favs.includes(shirt.id)} onFav={() => toggleFav(shirt.id)} />
    ) : (
      <Empty loading={!catalog && !error} text="המוצר לא נמצא. אולי הוא כבר לא במלאי." />
    );
  } else {
    page = (
      <Home
        key={route.join('/')}
        shirts={shirts}
        categories={categories}
        category={route[0] === 'c' ? route[1] : legacyKind !== 'all' ? 'football' : ''}
        initialKind={legacyKind}
        loading={!catalog && !error}
        favorites={route[0] === 'favorites'}
        favs={favs}
        onFav={toggleFav}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {settings.announcement && (
        <div className="bg-lime px-4 py-1.5 text-center text-sm font-bold text-ink">{settings.announcement}</div>
      )}
      <Header favCount={favs.filter((id) => shirts.some((s) => s.id === id)).length} categories={categories} />
      {error && !catalog && <div className="mx-auto mt-6 max-w-md rounded-xl bg-card p-4 text-center text-muted">{error}. נסו לרענן את הדף.</div>}
      <main className="flex-1">{page}</main>
      <Footer settings={settings} />
    </div>
  );
}

function Empty({ loading, text }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      {loading ? (
        <p className="text-muted">טוען…</p>
      ) : (
        <>
          <p className="mb-4 text-lg">{text}</p>
          <a href="#/" className="inline-block rounded-full bg-ink px-5 py-2.5 font-bold text-white dark:bg-lime dark:text-ink">
            לכל המוצרים
          </a>
        </>
      )}
    </div>
  );
}
