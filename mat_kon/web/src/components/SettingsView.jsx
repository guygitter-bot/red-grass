import { useRef, useState } from 'react';
import { ArrowRight, Download, Loader2, Upload, UserPlus, Users } from 'lucide-react';
import { restoreBackup } from '../lib/api';
import { backupFile } from '../lib/recipes';

// הגדרות: גיבוי ושחזור, הזמנות
export default function SettingsView({ session, isOwner, user, recipes, custom, shopping, plan, onRestored, onBack, onToast }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const run = async (key, fn) => {
    setBusy(key);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const download = () => {
    const blob = new Blob([backupFile({ recipes, categories: custom, shopping, plan })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mat-kon-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const restore = (file) =>
    run('restore', async () => {
      let data;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error('הקובץ הזה לא קובץ גיבוי של mat-kon');
      }
      if (!Array.isArray(data.recipes)) throw new Error('הקובץ הזה לא קובץ גיבוי של mat-kon');
      const res = await restoreBackup(session, { recipes: data.recipes, categories: data.categories || [] });
      onToast(`שוחזרו ${res.restored} מתכונים${res.skipped ? ` (${res.skipped} דולגו)` : ''}`);
      onRestored();
    });

  return (
    <div className="min-h-screen pb-16">
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-2 h-14 flex items-center gap-1">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-100" aria-label="חזרה">
            <ArrowRight size={22} />
          </button>
          <div className="font-bold">הגדרות</div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 space-y-6 mt-4">
        {isOwner && (
          <a href="#/invites" className="flex items-center gap-3 rounded-2xl bg-white shadow-sm p-4">
            <UserPlus className="text-orange-500" size={22} />
            <span className="flex-1 font-bold">הזמנות</span>
            <span className="text-sm text-stone-500">קישורים לספר מתכונים נפרד</span>
          </a>
        )}

        {user?.role === 'member' ? (
          <div className="flex items-center gap-3 rounded-2xl bg-white shadow-sm p-4">
            <Users className="text-orange-500" size={22} />
            <span className="flex-1">
              <span className="block font-bold">ספר משותף</span>
              <span className="text-sm text-stone-500">אתם עובדים על ספר המתכונים של {user.bookName}</span>
            </span>
          </div>
        ) : (isOwner || user) && (
          <a href="#/share" className="flex items-center gap-3 rounded-2xl bg-white shadow-sm p-4">
            <Users className="text-orange-500" size={22} />
            <span className="flex-1 font-bold">שיתוף הספר</span>
            <span className="text-sm text-stone-500">בן/בת זוג ובני משפחה</span>
          </a>
        )}

        <p className="text-sm text-stone-500 px-1">
          קטגוריות משלכם מוסיפים בספר המתכונים, בכפתור "+ קטגוריה" שבשורת הקטגוריות.
        </p>

        <section className="rounded-2xl bg-white shadow-sm p-4">
          <h2 className="font-bold text-lg">גיבוי ושחזור</h2>
          <p className="text-sm text-stone-500 mt-1">
            הגיבוי שומר בקובץ את כל {recipes.length} המתכונים (עם ההערות, הדירוגים והתמונות) ואת הקטגוריות שלכם. שחזור
            מקובץ מוסיף אותם לספר, ומתכון שכבר קיים מתעדכן ולא נכפל. אפשר גם לשחזר לספר אחר (למשל ממכשיר של משתמש מוזמן).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={download} className="rounded-xl bg-orange-500 text-white px-4 py-2.5 font-bold flex items-center gap-1.5">
              <Download size={16} /> הורדת גיבוי
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={busy === 'restore'} className="rounded-xl bg-stone-100 px-4 py-2.5 font-medium flex items-center gap-1.5 disabled:opacity-40">
              {busy === 'restore' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} שחזור מקובץ
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => e.target.files[0] && restore(e.target.files[0])} />
          </div>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
