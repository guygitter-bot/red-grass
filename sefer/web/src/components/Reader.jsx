import { useEffect, useRef, useState } from 'react';
import { back, go } from '../lib/nav';
import { getBook, bookImages } from '../lib/store';
import { safeBook, imageKeys, toShared, toView, pagesOf, paragraphs } from '../lib/book';
import { readShared, sharedImageUrl } from '../lib/api';
import { dataUrl } from '../lib/image';
import { Cover, ErrorBox } from './ui';

const ZOOM = 'sefer-ishi-zoom';
const ZOOMS = [0.9, 1, 1.15, 1.3, 1.5];

// ספר שלי, מהמכשיר
export function LocalReader({ id }) {
  const [view, setView] = useState(null);

  useEffect(() => {
    (async () => {
      const raw = await getBook(id);
      if (!raw) { setView(false); return; }
      const book = safeBook(raw);
      const images = await bookImages(id, imageKeys(book));
      setView(toView(toShared(book), (key) => (images[key] ? dataUrl(images[key]) : '')));
    })();
  }, [id]);

  if (view === null) return <main className="p-10 flex justify-center"><div className="spinner" /></main>;
  if (view === false) return <p className="p-6 text-center text-muted">הספר לא נמצא במכשיר הזה.</p>;
  return <Reader view={view} onClose={back} />;
}

// ספר שקיבלתי בקישור, מהשרת
export function SharedReader({ id }) {
  const [view, setView] = useState(null);
  const [error, setError] = useState('');
  const [adultOk, setAdultOk] = useState(false);

  useEffect(() => {
    readShared(id)
      .then(({ book, images }) => { setView(toView(book, (key) => (images.includes(key) ? sharedImageUrl(id, key) : ''))); })
      .catch((e) => { setError(e.message); });
  }, [id]);

  if (error) return <main className="max-w-md mx-auto p-6 grid gap-4"><ErrorBox error={error} /><button type="button" className="btn" onClick={() => go('')}>לאפליקציה</button></main>;
  if (!view) return <main className="p-10 flex justify-center"><div className="spinner" /></main>;
  // רומן למבוגרים: מי שקיבל את הקישור מאשר קודם שהוא מעל 18
  if (view.adult && !adultOk) {
    return (
      <main className="min-h-screen max-w-md mx-auto p-6 flex flex-col justify-center gap-4 text-center">
        <h1 className="book-title text-3xl m-0">{view.title}</h1>
        <p className="text-muted m-0">זה רומן רומנטי שמיועד למבוגרים בלבד.</p>
        <button type="button" className="btn btn-main" onClick={() => setAdultOk(true)}>אני מעל גיל 18 – לפתוח את הספר</button>
      </main>
    );
  }
  return <Reader view={view} gift />;
}

// הקורא: דף אחרי דף (כריכה, הקדשה, תוכן, פרקים, אלבום). חיצים, מקלדת או החלקה.
// gift = ספר שהתקבל בקישור (בלי כפתור חזרה, ועם הזמנה ליצור ספר בסוף)
function Reader({ view, onClose, gift }) {
  const pages = pagesOf(view);
  const [at, setAt] = useState(0);
  const [zoom, setZoom] = useState(() => {
    const z = Number(localStorage.getItem(ZOOM));
    return ZOOMS.includes(z) ? z : 1;
  });
  const touch = useRef(null);
  const top = useRef(null);

  const turn = (to) => { setAt(Math.max(0, Math.min(pages.length - 1, to))); };

  useEffect(() => {
    top.current?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
  }, [at]);

  useEffect(() => {
    // בספר בעברית מתקדמים שמאלה
    const onKey = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); setAt((a) => Math.min(pages.length - 1, a + 1)); }
      if (e.key === 'ArrowRight' || e.key === 'PageUp') { e.preventDefault(); setAt((a) => Math.max(0, a - 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, [pages.length]);

  const setSize = (step) => {
    const next = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + step))];
    setZoom(next);
    try { localStorage.setItem(ZOOM, String(next)); } catch { /* לא נורא */ }
  };

  // החלקה: ימינה = הדף הבא (כמו שמדפדפים ספר בעברית)
  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(at + (dx > 0 ? 1 : -1));
  };

  const page = pages[at];
  const chapter = page.type === 'chapter' ? view.chapters[page.index] : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ '--book-zoom': zoom }}>
      <header className="sticky top-0 z-10 bg-page/95 backdrop-blur border-b border-line">
        <div className="mx-auto max-w-3xl flex items-center gap-2 px-4 h-14">
          {onClose ? <button type="button" className="btn !min-h-10 !px-3" onClick={onClose} aria-label="סגירת הספר">→</button> : null}
          <div className="flex-1 min-w-0 truncate font-bold">{view.title}</div>
          <button type="button" className="btn !min-h-10 !px-3" onClick={() => setSize(-1)} disabled={zoom === ZOOMS[0]} aria-label="להקטין את הכתב">א−</button>
          <button type="button" className="btn !min-h-10 !px-3" onClick={() => setSize(1)} disabled={zoom === ZOOMS[ZOOMS.length - 1]} aria-label="להגדיל את הכתב">א+</button>
        </div>
      </header>

      <main ref={top} className="flex-1 mx-auto w-full max-w-2xl px-4 pt-5 pb-28" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {page.type === 'cover' ? (
          <div className="max-w-sm mx-auto">
            <Cover title={view.title} subtitle={view.subtitle} src={view.coverSrc} />
            {view.from && !view.adult ? <p className="text-center text-muted mt-4">ספר ל{view.name}, מאת {view.from}</p> : null}
          </div>
        ) : null}

        {page.type === 'dedication' ? (
          <article className="bg-card border border-line rounded-2xl px-6 py-14 text-center min-h-[50vh] flex flex-col justify-center">
            <div className="text-gold text-2xl" aria-hidden="true">❦</div>
            <div className="book-text italic mt-4">{paragraphs(view.dedication).map((t, i) => <p key={i} className="!text-center">{t}</p>)}</div>
          </article>
        ) : null}

        {page.type === 'toc' ? (
          <article className="bg-card border border-line rounded-2xl px-6 py-8">
            <h2 className="book-title text-2xl text-center mt-0 mb-5">תוכן העניינים</h2>
            <ol className="list-none p-0 m-0 grid gap-1">
              {view.chapters.map((c, i) => (
                <li key={i}>
                  <button type="button" className="w-full text-right flex gap-3 items-baseline py-2 border-b border-line book-text !text-lg" onClick={() => turn(pages.findIndex((x) => x.type === 'chapter' && x.index === i))}>
                    <span className="text-gold w-6 flex-none">{i + 1}</span>
                    <span className="flex-1">{c.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </article>
        ) : null}

        {chapter ? (
          <article className="bg-card border border-line rounded-2xl overflow-hidden">
            {chapter.imageSrc ? <img src={chapter.imageSrc} alt="" loading="lazy" className="w-full aspect-[4/3] object-cover" /> : null}
            <div className="px-5 lg:px-8 py-7">
              <div className="text-center text-gold text-sm font-semibold">פרק {page.index + 1}</div>
              <h2 className="book-title text-3xl text-center mt-1 mb-6">{chapter.title}</h2>
              <div className={`book-text ${view.kid ? 'kid-text' : ''}`}>{paragraphs(chapter.text).map((t, i) => <p key={i}>{t}</p>)}</div>
            </div>
          </article>
        ) : null}

        {page.type === 'album' ? (
          <article className="bg-card border border-line rounded-2xl px-4 py-6">
            <h2 className="book-title text-2xl text-center mt-0 mb-4">אלבום</h2>
            <div className="grid grid-cols-2 gap-3">
              {view.photoSrcs.map((src, i) => <img key={i} src={src} alt={`תמונה ${i + 1}`} loading="lazy" className="w-full aspect-square object-cover rounded-xl" />)}
            </div>
          </article>
        ) : null}

        {page.type === 'end' ? (
          <article className="bg-card border border-line rounded-2xl px-6 py-14 text-center min-h-[40vh] flex flex-col justify-center items-center gap-3">
            <div className="text-gold text-2xl" aria-hidden="true">❦</div>
            <div className="book-title text-3xl">סוף</div>
            {view.from && !view.adult ? <p className="text-muted m-0">נכתב באהבה ל{view.name}, מאת {view.from}</p> : null}
            <button type="button" className="btn mt-3" onClick={() => turn(0)}>לקרוא שוב מההתחלה</button>
            {gift ? <button type="button" className="btn btn-main" onClick={() => go('')}>ליצור ספר כזה למישהו</button> : null}
          </article>
        ) : null}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-page/95 backdrop-blur border-t border-line" aria-label="דפדוף">
        <div className="mx-auto max-w-2xl flex items-center gap-3 px-4 py-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <button type="button" className="btn flex-1" disabled={at === 0} onClick={() => turn(at - 1)}>→ הקודם</button>
          <span className="text-sm text-muted tabular-nums" aria-live="polite">{at + 1} / {pages.length}</span>
          <button type="button" className="btn btn-main flex-1" disabled={at === pages.length - 1} onClick={() => turn(at + 1)}>הבא ←</button>
        </div>
      </nav>
    </div>
  );
}
