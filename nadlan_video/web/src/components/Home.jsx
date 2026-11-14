import { logout } from '../lib/api';
import { removeProject } from '../lib/store';
import { readyCount } from '../lib/shots';

// רשימת הסרטונים שנשמרו במכשיר
export default function Home({ projects, error, onOpen, onNew, onChange }) {
  const remove = async (p) => {
    if (!window.confirm(`למחוק את "${p.name || 'סרטון'}" וכל השוטים שלו מהמכשיר?`)) return;
    await removeProject(p);
    onChange();
  };

  return (
    <main className="mx-auto max-w-5xl p-4 pb-24 lg:p-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="icon.svg" alt="" className="h-11 w-11 rounded-xl" />
          <div>
            <h1 className="text-2xl font-bold leading-tight">סרטון נדל״ן</h1>
            <p className="text-sm text-muted">מצילום או שרטוט – לסרטון תדמית</p>
          </div>
        </div>
        <button className="text-sm text-muted underline" onClick={logout}>יציאה</button>
      </header>

      {error && <p role="alert" className="mt-4 rounded-xl bg-bad-soft p-3 text-bad">{error}</p>}

      <button className="btn btn-main mt-6 w-full text-lg lg:w-auto lg:px-10" onClick={onNew}>＋ סרטון חדש</button>

      {projects === null ? (
        <div className="mt-10 flex justify-center"><span className="spinner" /></div>
      ) : projects.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-line bg-card p-6">
          <h2 className="text-lg font-bold">איך זה עובד</h2>
          <ol className="mt-3 list-decimal space-y-2 ps-5 text-muted">
            <li>מעלים צילום של הבניין, הדמיה, או שרטוט (חזית / תוכנית דירה).</li>
            <li>הבמאי מתכנן 4 שוטים: פתיחה, התקרבות, רגע של אווירה וסיום.</li>
            <li>לכל שוט נוצר פריים פוטוריאליסטי – מאשרים אותו, ואז הוא הופך לסרטון.</li>
            <li>מצרפים הכול לסרט אחד עם שם הפרויקט ופרטי הקשר, ומורידים.</li>
          </ol>
        </section>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-2xl border border-line bg-card">
              <button className="block w-full text-start" onClick={() => onOpen(p.id)}>
                {p.thumb ? <img src={p.thumb} alt="" className="aspect-video w-full object-cover" /> : <div className="aspect-video w-full bg-soft" />}
                <div className="p-3">
                  <div className="font-bold">{p.name || 'סרטון בלי שם'}</div>
                  <div className="text-sm text-muted">
                    {p.shots.length ? `${readyCount(p)} מתוך ${p.shots.length} שוטים מוכנים` : 'עוד לא תוכנן'}
                  </div>
                </div>
              </button>
              <div className="border-t border-line px-3 py-2 text-end">
                <button className="text-sm text-muted underline" onClick={() => remove(p)}>מחיקה</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
