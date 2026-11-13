import { useEffect, useState } from 'react';
import { go } from '../lib/nav';
import { listBooks } from '../lib/store';
import { safeBook, progress } from '../lib/book';
import { subscribe } from '../lib/maker';
import { Cover, ErrorBox } from './ui';

// מסך הבית: מה זה, כפתור לספר חדש, והספרים שכבר נוצרו במכשיר הזה
export default function Home() {
  const [books, setBooks] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = () => {
      listBooks()
        .then((all) => { setBooks(all.map(safeBook).sort((a, b) => b.createdAt - a.createdAt)); })
        .catch(() => { setBooks([]); setError('אי אפשר לשמור ספרים בדפדפן הזה (אולי חלון פרטי).'); });
    };
    load();
    return subscribe(load);
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16">
      <section className="pt-10 pb-8 text-center">
        <div className="text-gold text-sm font-semibold tracking-wide">ספר אישי</div>
        <h1 className="book-title text-4xl lg:text-5xl mt-2 mb-3">ספר שלם, שנכתב רק בשבילם</h1>
        <p className="text-muted max-w-xl mx-auto m-0">
          מספרים לנו על מישהו אהוב, והסופר כותב עליו ספר דיגיטלי שלם – עם כריכה, הקדשה, פרקים ואיורים. קוראים אותו על המסך ושולחים בקישור.
        </p>
        <button type="button" className="btn btn-main mt-6 !px-8 text-lg" onClick={() => go('new')}>ליצור ספר חדש</button>
        <ol className="mt-8 grid gap-3 lg:grid-cols-3 text-right list-none p-0">
          {[
            ['1', 'מספרים עליהם', 'בוחרים אירוע, עונים על כמה שאלות ומוסיפים תמונה.'],
            ['2', 'הסופר כותב ומאייר', 'קודם רואים את הכריכה ואת רשימת הפרקים, ואפשר לשנות.'],
            ['3', 'קוראים ושולחים', 'הספר נפתח על המסך, ואפשר לשלוח אותו בקישור.'],
          ].map(([n, t, d]) => (
            <li key={n} className="bg-card border border-line rounded-2xl p-4">
              <div className="w-8 h-8 rounded-full bg-soft text-accent font-bold flex items-center justify-center">{n}</div>
              <div className="font-bold mt-2">{t}</div>
              <div className="text-sm text-muted">{d}</div>
            </li>
          ))}
        </ol>
      </section>

      <ErrorBox error={error} />

      {books?.length ? (
        <section>
          <h2 className="text-xl font-bold mb-3">הספרים שלי</h2>
          <ul className="grid gap-3 lg:grid-cols-2 list-none p-0 m-0">
            {books.map((b) => {
              const p = progress(b);
              return (
                <li key={b.id}>
                  <button type="button" className="w-full text-right bg-card border border-line rounded-2xl p-3 flex gap-3 items-center" onClick={() => go(`book/${b.id}`)}>
                    <Cover small title={b.title} src={b.thumb} />
                    <span className="min-w-0 flex-1">
                      <span className="block book-title text-lg truncate">{b.title}</span>
                      <span className="block text-sm text-muted truncate">{b.brief.occasion === 'romance' ? `רומן · ${b.brief.name}` : `ל${b.brief.name}`}</span>
                      <span className="block text-sm mt-1">
                        {b.stage === 'outline' ? 'מחכה לאישור המתווה' : p.done ? 'מוכן לקריאה' : `נכתבו ${p.written} מתוך ${p.total} פרקים`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
