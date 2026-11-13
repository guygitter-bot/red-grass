import { useEffect, useState } from 'react';
import { go } from '../lib/nav';
import { getBook, saveBook, getImage, deleteImage, removeBook, bookImages } from '../lib/store';
import { safeBook, progress, imageKeys, coverKey, chapterKey, newId, toShared, pagesEstimate } from '../lib/book';
import { run, stop, getStatus, subscribe } from '../lib/maker';
import { shareBook, unshareBook } from '../lib/api';
import { dataUrl } from '../lib/image';
import { Cover, ErrorBox, TopBar } from './ui';

const DOING = { cover: 'מצייר את הכריכה', chapter: 'כותב את הפרק', art: 'מאייר את הפרק' };
const shareLink = (id) => `${window.location.origin}${window.location.pathname}#/read/${id}`;

// ספר שלי: קודם מאשרים את המתווה (שם, הקדשה, פרקים), אחר כך הוא נכתב, ואז קוראים, עורכים ומשתפים
export default function Book({ id }) {
  const [book, setBook] = useState(null);
  const [cover, setCover] = useState('');
  const [status, setStatus] = useState(getStatus(id));
  const [editing, setEditing] = useState(null); // מזהה הפרק שנערך
  const [sharing, setSharing] = useState({ busy: false, error: '', copied: false });

  const load = () => getBook(id).then((b) => {
    const safe = b ? safeBook(b) : false;
    setBook(safe);
    if (safe) getImage(id, coverKey(safe) || 'cover').then((im) => { setCover(im ? dataUrl(im) : ''); });
  });

  useEffect(() => {
    load();
    return subscribe((changed) => {
      if (changed === id) { setStatus(getStatus(id)); load(); }
    });
  }, [id]);

  // ספר שנסגר באמצע הכתיבה ממשיך מעצמו כשפותחים אותו
  useEffect(() => {
    if (book && book.stage === 'book' && !progress(book).done && !getStatus(id).running && !getStatus(id).error) run(id);
  }, [book?.stage]);

  if (book === null) return <main className="p-10 flex justify-center"><div className="spinner" /></main>;
  if (book === false) return <><TopBar title="הספר לא נמצא" onBack={() => go('')} /><p className="p-6 text-center text-muted">הספר לא נמצא במכשיר הזה.</p></>;

  const p = progress(book);
  const update = async (patch) => { const next = { ...book, ...patch }; setBook(next); await saveBook(next); };
  const setChapter = (cid, patch) => update({ chapters: book.chapters.map((c) => (c.id === cid ? { ...c, ...patch } : c)) });

  async function remove() {
    if (!window.confirm(`למחוק את הספר "${book.title}"? אי אפשר לשחזר.`)) return;
    stop(id);
    if (book.share) await unshareBook(book.share.id, book.share.secret).catch(() => {});
    await removeBook(id, [...imageKeys(book), 'cover']);
    go('');
  }

  // שיתוף בקישור: מעלים עותק לקריאה (טקסט ותמונות, בלי מה שסיפרתם בשאלון)
  async function share() {
    setSharing({ busy: true, error: '', copied: false });
    try {
      const images = await bookImages(id, imageKeys(book));
      const out = await shareBook({ book: toShared(book), images, ...(book.share || {}) });
      await update({ share: { id: out.id, secret: out.secret } });
      setSharing({ busy: false, error: '', copied: false });
    } catch (e) {
      setSharing({ busy: false, error: e.message, copied: false });
    }
  }

  async function unshare() {
    if (!window.confirm('לבטל את הקישור? מי שקיבל אותו לא יוכל לפתוח את הספר.')) return;
    setSharing({ busy: true, error: '', copied: false });
    try {
      await unshareBook(book.share.id, book.share.secret);
      await update({ share: null });
      setSharing({ busy: false, error: '', copied: false });
    } catch (e) {
      setSharing({ busy: false, error: e.message, copied: false });
    }
  }

  async function send() {
    const url = shareLink(book.share.id);
    const text = `כתבתי לך ספר: "${book.title}"`;
    try {
      if (navigator.share) { await navigator.share({ title: book.title, text, url }); return; }
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
    await navigator.clipboard?.writeText(url).catch(() => {});
    setSharing((s) => ({ ...s, copied: true }));
  }

  const editingChapter = book.chapters.find((c) => c.id === editing);

  return (
    <>
      <TopBar title={book.title} onBack={() => go('')}>
        <button type="button" className="btn !min-h-10 !px-3 text-bad" onClick={remove}>מחיקה</button>
      </TopBar>
      <main className="mx-auto max-w-3xl px-4 pt-5 pb-24 grid gap-6 lg:grid-cols-[260px_1fr] lg:items-start">
        <div className="max-w-[260px] w-full mx-auto">
          <Cover title={book.title} subtitle={book.subtitle} src={cover} />
          {status.running && status.doing === 'cover' ? <div className="flex items-center gap-2 text-sm text-muted mt-2 justify-center"><div className="spinner" />מצייר את הכריכה…</div> : null}
        </div>

        <div className="grid gap-5 min-w-0">
          {book.stage === 'outline' ? (
            <section className="grid gap-4">
              <div>
                <h2 className="book-title text-2xl m-0">{book.brief.occasion === 'romance' ? `הנה הסיפור של ${book.brief.name}` : `הנה הספר שתכננו ל${book.brief.name}`}</h2>
                <p className="text-muted mt-1 mb-0">אפשר לשנות כל דבר לפני שהסופר מתחיל לכתוב: את השם, את ההקדשה ואת הפרקים.</p>
              </div>
              <label><span className="label">שם הספר</span><input className="field" value={book.title} maxLength={120} onChange={(e) => update({ title: e.target.value })} /></label>
              <label><span className="label">כותרת משנה</span><input className="field" value={book.subtitle} maxLength={200} onChange={(e) => update({ subtitle: e.target.value })} /></label>
              <label><span className="label">הקדשה</span><textarea className="field" rows={3} maxLength={1200} value={book.dedication} onChange={(e) => update({ dedication: e.target.value })} /></label>
              <div>
                <h3 className="font-bold text-lg mb-2">הפרקים</h3>
                <ol className="grid gap-3 list-none p-0 m-0">
                  {book.chapters.map((c, i) => (
                    <li key={c.id} className="bg-card border border-line rounded-2xl p-3 grid gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 flex-none rounded-full bg-soft text-accent text-sm font-bold flex items-center justify-center">{i + 1}</span>
                        <input className="field !py-2 font-semibold" aria-label={`שם פרק ${i + 1}`} value={c.title} maxLength={120} onChange={(e) => setChapter(c.id, { title: e.target.value })} />
                        {book.chapters.length > 1 ? <button type="button" className="btn !min-h-10 !px-3" aria-label={`מחיקת פרק ${i + 1}`} onClick={() => update({ chapters: book.chapters.filter((x) => x.id !== c.id) })}>✕</button> : null}
                      </div>
                      <textarea className="field text-sm" rows={2} aria-label={`על מה פרק ${i + 1}`} value={c.summary} maxLength={500} onChange={(e) => setChapter(c.id, { summary: e.target.value })} />
                    </li>
                  ))}
                </ol>
                {book.chapters.length < 16 ? (
                  <button type="button" className="btn mt-3" onClick={() => update({ chapters: [...book.chapters, safeBook({ chapters: [{ id: newId(), title: 'פרק חדש' }] }).chapters[0]] })}>+ פרק נוסף</button>
                ) : null}
              </div>
              <button type="button" className="btn btn-main" disabled={!book.title.trim() || book.chapters.some((c) => !c.title.trim())} onClick={async () => { await update({ stage: 'book' }); run(id); }}>
                מעולה, כתבו את הספר
              </button>
            </section>
          ) : (
            <>
              <section className="bg-card border border-line rounded-2xl p-4 grid gap-3">
                {p.done ? (
                  <div>
                    <h2 className="book-title text-2xl m-0">הספר מוכן</h2>
                    <p className="text-muted m-0">{p.total} פרקים · כ-{pagesEstimate(book)} עמודים</p>
                  </div>
                ) : (
                  <div>
                    <h2 className="book-title text-2xl m-0">{status.running ? 'הספר נכתב…' : 'הכתיבה נעצרה'}</h2>
                    <p className="text-muted m-0">
                      {status.running && DOING[status.doing] ? `${DOING[status.doing]}${status.index >= 0 ? ` ${status.index + 1}` : ''} · ` : ''}נכתבו {p.written} מתוך {p.total} פרקים
                    </p>
                    <div className="h-2 rounded-full bg-line mt-2 overflow-hidden" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full bg-accent transition-[width]" style={{ width: `${p.percent}%` }} />
                    </div>
                    {status.running ? <p className="text-sm text-muted mt-2 mb-0">כדאי להשאיר את האפליקציה פתוחה. אם תסגרו – הכתיבה תמשיך מאותה נקודה בפעם הבאה.</p> : null}
                  </div>
                )}
                <ErrorBox error={status.error} detail={status.detail} />
                {status.artError && !status.error ? <ErrorBox error={`חלק מהאיורים לא נוצרו: ${status.artError}`} detail={status.detail} /> : null}
                <div className="flex flex-wrap gap-2">
                  {p.written ? <button type="button" className="btn btn-main flex-1" onClick={() => go(`book/${id}/read`)}>{p.done ? 'לקרוא את הספר' : 'לקרוא את מה שנכתב'}</button> : null}
                  {status.running
                    ? (p.done ? null : <button type="button" className="btn" onClick={() => stop(id)}>עצירה</button>)
                    : (!p.done || book.chapters.some((c) => book.art && !c.hasImage) || (book.coverKind === 'art' && !book.hasCover)
                      ? <button type="button" className="btn" onClick={() => run(id)}>{p.done ? 'להשלים איורים' : 'להמשיך לכתוב'}</button>
                      : null)}
                </div>
              </section>

              {p.written ? (
                <section className="bg-card border border-line rounded-2xl p-4 grid gap-3">
                  <h2 className="font-bold text-lg m-0">לשלוח את הספר</h2>
                  {book.share ? (
                    <>
                      <p className="text-sm text-muted m-0">כל מי שיקבל את הקישור יוכל לקרוא את הספר. אחרי שינוי בספר – לחצו "לעדכן".</p>
                      <input className="field text-sm" dir="ltr" readOnly value={shareLink(book.share.id)} onFocus={(e) => e.target.select()} aria-label="הקישור לספר" />
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn btn-main flex-1" onClick={send}>{sharing.copied ? 'הקישור הועתק ✓' : 'לשלוח את הקישור'}</button>
                        <button type="button" className="btn" disabled={sharing.busy} onClick={share}>לעדכן</button>
                        <button type="button" className="btn" disabled={sharing.busy} onClick={unshare}>לבטל</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted m-0">הספר שמור רק במכשיר הזה. כדי לשלוח אותו, ניצור קישור לקריאה: עולים רק הספר והתמונות שבו, לא מה שכתבתם בשאלון.</p>
                      <button type="button" className="btn btn-main" disabled={sharing.busy} onClick={share}>ליצור קישור לספר</button>
                    </>
                  )}
                  {sharing.busy ? <div className="flex items-center gap-2 text-sm text-muted"><div className="spinner" />רגע…</div> : null}
                  <ErrorBox error={sharing.error} />
                </section>
              ) : null}

              <section>
                <h2 className="font-bold text-lg mb-2">הפרקים</h2>
                <ol className="grid gap-2 list-none p-0 m-0">
                  {book.chapters.map((c, i) => {
                    const now = status.running && status.index === i;
                    return (
                      <li key={c.id} className="bg-card border border-line rounded-2xl p-3 flex items-center gap-3">
                        <span className="w-7 h-7 flex-none rounded-full bg-soft text-accent text-sm font-bold flex items-center justify-center">{i + 1}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-semibold truncate">{c.title}</span>
                          <span className="block text-sm text-muted">{now ? `${DOING[status.doing] || 'עובד'}…` : c.text ? (c.hasImage ? 'נכתב ואויר' : 'נכתב') : 'מחכה'}</span>
                        </span>
                        {now ? <div className="spinner" /> : c.text ? <button type="button" className="btn !min-h-10 !px-3" onClick={() => setEditing(c.id)}>עריכה</button> : null}
                      </li>
                    );
                  })}
                </ol>
              </section>
            </>
          )}
        </div>
      </main>

      {editingChapter ? (
        <ChapterEditor
          book={book} chapter={editingChapter} busy={status.running}
          onClose={() => setEditing(null)}
          onSave={(patch) => setChapter(editingChapter.id, patch)}
          onRewrite={async (note) => { await setChapter(editingChapter.id, { text: '', note }); setEditing(null); run(id); }}
          onRedraw={async () => { await deleteImage(id, chapterKey(editingChapter)); await setChapter(editingChapter.id, { hasImage: false }); setEditing(null); run(id); }}
        />
      ) : null}
    </>
  );
}

// עריכת פרק: לתקן את הטקסט ביד, לבקש מהסופר לכתוב מחדש, או איור חדש
function ChapterEditor({ book, chapter, busy, onClose, onSave, onRewrite, onRedraw }) {
  const [title, setTitle] = useState(chapter.title);
  const [text, setText] = useState(chapter.text);
  const [note, setNote] = useState('');
  const [art, setArt] = useState('');

  useEffect(() => {
    if (chapter.hasImage) getImage(book.id, chapterKey(chapter)).then((im) => { setArt(im ? dataUrl(im) : ''); });
  }, [chapter.id, chapter.hasImage]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, []);

  return (
    <div className="fixed inset-0 z-20 bg-black/50 flex items-end lg:items-center justify-center" role="dialog" aria-modal="true" aria-label={`עריכת הפרק ${chapter.title}`}>
      <div className="bg-page w-full lg:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl lg:rounded-2xl p-4 grid gap-3">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 font-bold text-lg m-0">עריכת פרק</h2>
          <button type="button" className="btn !min-h-10 !px-3" onClick={onClose} aria-label="סגירה">✕</button>
        </div>
        <input className="field font-semibold" aria-label="שם הפרק" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        {art ? <img src={art} alt="האיור של הפרק" className="w-full rounded-xl border border-line" /> : null}
        <textarea className="field book-text !text-base" rows={12} aria-label="הטקסט של הפרק" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="button" className="btn btn-main" disabled={!text.trim() || !title.trim()} onClick={async () => { await onSave({ title: title.trim(), text: text.trim() }); onClose(); }}>שמירה</button>
        <div className="border-t border-line pt-3 grid gap-2">
          <label>
            <span className="label">או: שהסופר יכתוב את הפרק מחדש</span>
            <input className="field" value={note} maxLength={600} onChange={(e) => setNote(e.target.value)} placeholder="מה לשנות? למשל: יותר מצחיק, להזכיר את הטיול לאילת" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn flex-1" disabled={busy} onClick={() => onRewrite(note.trim())}>לכתוב מחדש</button>
            {book.art && chapter.scene ? <button type="button" className="btn flex-1" disabled={busy} onClick={onRedraw}>איור חדש</button> : null}
          </div>
          {busy ? <p className="text-sm text-muted m-0">אפשר אחרי שהסופר מסיים את מה שהוא עושה עכשיו.</p> : null}
        </div>
      </div>
    </div>
  );
}
